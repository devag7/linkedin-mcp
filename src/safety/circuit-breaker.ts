/**
 * Circuit breaker for LinkedIn automation safety.
 *
 * Implements the locked NUMERIC POLICY trip detection and soft-vs-hard logic.
 * The breaker is a small state machine with three logical states:
 *   - CLOSED        : everything allowed (subject to per-action soft cooldowns).
 *   - SOFT_OPEN     : one or more action types are cooling down (per-action);
 *                     reads always continue, the cooled-down action is blocked.
 *   - GLOBAL_OPEN   : a hard trip happened (checkpoint / 999 / authwall /
 *                     id-verify). EVERYTHING is blocked until a human re-logs in.
 *
 * Pure logic: no network, no browser. The clock and storage are injected so the
 * module is deterministic and unit-testable offline. The core decision logic
 * NEVER calls the system clock directly — always through the injected `clock`.
 *
 * Captcha / OTP are NEVER auto-solved: detecting them is a hard trip.
 */

import type { Logger } from '../types.js';

/** Classification of an observed response/signal. */
export type SignalClass = 'ok' | 'soft' | 'hard';

/** Trip severity, distinct from {@link SignalClass} (which classifies inputs). */
export type TripKind = 'soft' | 'hard';

/** Action types tracked for per-action soft cooldowns. */
export type ActionType =
  | 'connect'
  | 'message'
  | 'like'
  | 'comment'
  | 'follow'
  | 'endorsement'
  | 'event-invite'
  | 'profile-view'
  | 'search'
  | 'read';

/** A signal observed from an HTTP response or rendered DOM. */
export interface CircuitSignal {
  /** HTTP status code, if available. */
  status?: number;
  /** The final URL after any redirects. */
  finalUrl?: string;
  /** A sample of the response body or visible DOM text (lower/upper-case agnostic). */
  bodySample?: string;
  /**
   * True when the caller expected a JSON endpoint. If the body looks like HTML
   * instead, that is a hard trip (silent redirect to a challenge page).
   */
  expectedJson?: boolean;
}

/** Persisted strike record for a single action type. */
export interface ActionStrikeRecord {
  /** Number of soft strikes accumulated for this action type. */
  strikes: number;
  /** Epoch ms until which this action type is in soft cooldown (0 = none). */
  cooldownUntil: number;
  /** Epoch ms of the most recent strike. */
  lastStrikeAt: number;
}

/** The full persisted breaker state. */
export interface CircuitState {
  /** Global hard-trip flag. When true, everything is blocked. */
  globalOpen: boolean;
  /** Epoch ms when the global trip happened (0 = never). */
  globalTrippedAt: number;
  /** Human-readable reason for the global trip. */
  globalReason: string;
  /** Per-action soft state, keyed by {@link ActionType}. */
  actions: Record<string, ActionStrikeRecord>;
  /** Rolling count of in-session 429 responses (resets on reset/session). */
  rate429Count: number;
}

/** Pluggable persistence for breaker state. Sync to keep core logic simple. */
export interface CircuitStorage {
  load(): CircuitState | null;
  save(state: CircuitState): void;
}

/** Result of a {@link CircuitBreaker.canProceed} check. */
export interface ProceedResult {
  ok: boolean;
  reason?: string;
}

/** Constructor options. All numeric knobs are configurable; defaults match policy. */
export interface CircuitBreakerOptions {
  /** Injected clock returning epoch milliseconds. Defaults to Date.now wrapper. */
  clock?: () => number;
  /** Optional storage for persistence of strikes/state. */
  storage?: CircuitStorage;
  /** Optional logger. */
  logger?: Logger;
  /** Soft cooldown floor in ms (policy: 24h). */
  softCooldownMinMs?: number;
  /** Soft cooldown ceiling in ms (policy: 72h). */
  softCooldownMaxMs?: number;
  /** How many in-session 429s before the breaker treats them as a soft trip. */
  repeated429Threshold?: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_SOFT_COOLDOWN_MIN_MS = 24 * HOUR_MS;
const DEFAULT_SOFT_COOLDOWN_MAX_MS = 72 * HOUR_MS;
const DEFAULT_REPEATED_429_THRESHOLD = 2;

/**
 * URL fragments that indicate a hard challenge / login wall. Matched
 * case-insensitively against the final URL.
 */
const HARD_URL_MARKERS: readonly string[] = [
  '/checkpoint/challenge',
  '/uas/login',
  '/authwall',
  '/checkpoint/lg',
];

/**
 * Body / DOM substrings that indicate a hard security challenge. Matched
 * case-insensitively.
 */
const HARD_BODY_MARKERS: readonly string[] = [
  'security verification',
  'unusual activity',
  'verify your identity',
  'captcha',
];

/** Action types that are reads — always allowed under soft trips. */
const READ_ACTIONS: ReadonlySet<ActionType> = new Set<ActionType>([
  'profile-view',
  'search',
  'read',
]);

/** Heuristic: does this body sample look like an HTML document rather than JSON? */
function looksLikeHtml(bodySample: string): boolean {
  const head = bodySample.trimStart().slice(0, 512).toLowerCase();
  return (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    head.includes('<head') ||
    head.includes('<body') ||
    head.includes('<!doctype')
  );
}

/** Build a fresh, empty persisted state. */
function emptyState(): CircuitState {
  return {
    globalOpen: false,
    globalTrippedAt: 0,
    globalReason: '',
    actions: {},
    rate429Count: 0,
  };
}

/**
 * CircuitBreaker state machine. See file header for state semantics.
 */
export class CircuitBreaker {
  private readonly clock: () => number;
  private readonly storage: CircuitStorage | undefined;
  private readonly logger: Logger | undefined;
  private readonly softCooldownMinMs: number;
  private readonly softCooldownMaxMs: number;
  private readonly repeated429Threshold: number;
  private state: CircuitState;

  constructor(options: CircuitBreakerOptions = {}) {
    this.clock = options.clock ?? ((): number => Date.now());
    this.storage = options.storage;
    this.logger = options.logger;
    this.softCooldownMinMs = options.softCooldownMinMs ?? DEFAULT_SOFT_COOLDOWN_MIN_MS;
    this.softCooldownMaxMs = options.softCooldownMaxMs ?? DEFAULT_SOFT_COOLDOWN_MAX_MS;
    this.repeated429Threshold = options.repeated429Threshold ?? DEFAULT_REPEATED_429_THRESHOLD;

    const loaded = this.storage?.load() ?? null;
    this.state = loaded ? this.normalize(loaded) : emptyState();
  }

  /**
   * Classify a single observed signal into 'ok' | 'soft' | 'hard'.
   * Pure: does not mutate state. The caller decides whether to {@link trip}.
   */
  classify(signal: CircuitSignal): SignalClass {
    const { status, finalUrl, bodySample, expectedJson } = signal;

    // --- HARD signals (global kill) ---

    // HTTP 999 — LinkedIn's "request denied" bot wall.
    if (status === 999) return 'hard';

    if (finalUrl) {
      const url = finalUrl.toLowerCase();
      for (const marker of HARD_URL_MARKERS) {
        if (url.includes(marker)) return 'hard';
      }
    }

    if (bodySample) {
      const body = bodySample.toLowerCase();
      for (const marker of HARD_BODY_MARKERS) {
        if (body.includes(marker)) return 'hard';
      }
    }

    // A JSON endpoint that returned HTML => silent redirect to a challenge page.
    if (expectedJson === true && bodySample && looksLikeHtml(bodySample)) {
      return 'hard';
    }

    // --- SOFT signals (per-action cooldown; reads continue) ---

    // A single 429 is soft (honor Retry-After upstream). Repeated 429s in a
    // session are escalated by the caller via the rolling counter, but each
    // individual 429 classifies as soft here.
    if (status === 429) return 'soft';

    return 'ok';
  }

  /**
   * Trip the breaker.
   *
   * - `kind === 'hard'` => GLOBAL_OPEN: everything blocked until a human
   *   re-logs in (call {@link resetGlobal}). `actionType` is recorded as
   *   context only.
   * - `kind === 'soft'` => the given `actionType` enters a 24-72h cooldown.
   *   Reads continue regardless.
   *
   * @param kind       Trip severity.
   * @param actionType Action type for a soft trip (required for soft).
   * @param reason     Optional human-readable reason (for hard trips / logs).
   */
  trip(kind: TripKind, actionType?: ActionType, reason?: string): void {
    const now = this.clock();

    if (kind === 'hard') {
      this.state.globalOpen = true;
      this.state.globalTrippedAt = now;
      this.state.globalReason = reason ?? 'hard trip';
      this.logger?.error('circuit-breaker: HARD trip — global kill', {
        reason: this.state.globalReason,
        actionType: actionType ?? null,
        at: now,
      });
      this.persist();
      return;
    }

    // soft trip — requires an action type to scope the cooldown.
    if (!actionType) {
      this.logger?.warn('circuit-breaker: soft trip without actionType ignored', {
        reason: reason ?? null,
      });
      return;
    }

    const rec = this.getOrCreate(actionType);
    rec.strikes += 1;
    rec.lastStrikeAt = now;
    rec.cooldownUntil = now + this.cooldownDurationFor(rec.strikes);

    this.logger?.warn('circuit-breaker: SOFT trip', {
      actionType,
      strikes: rec.strikes,
      cooldownUntil: rec.cooldownUntil,
      reason: reason ?? null,
    });
    this.persist();
  }

  /**
   * Record an in-session 429 and report whether the repeated-429 threshold has
   * been crossed (caller may then escalate to a soft trip for the action type).
   * Honors Retry-After upstream — this only tracks the rolling count.
   *
   * @returns the current rolling 429 count after incrementing.
   */
  record429(): number {
    this.state.rate429Count += 1;
    this.persist();
    return this.state.rate429Count;
  }

  /** True once repeated in-session 429s cross the configured threshold. */
  isRepeated429(): boolean {
    return this.state.rate429Count >= this.repeated429Threshold;
  }

  /**
   * Can the given action type proceed right now?
   *
   * - Global hard trip blocks everything (including reads).
   * - Otherwise, reads always proceed.
   * - A non-read action in active soft cooldown is blocked until it expires.
   */
  canProceed(actionType: ActionType): ProceedResult {
    const now = this.clock();

    if (this.state.globalOpen) {
      return {
        ok: false,
        reason: this.state.globalReason
          ? `global circuit open: ${this.state.globalReason}`
          : 'global circuit open: human re-login required',
      };
    }

    if (READ_ACTIONS.has(actionType)) {
      return { ok: true };
    }

    const rec = this.state.actions[actionType];
    if (rec && rec.cooldownUntil > now) {
      const remainingMs = rec.cooldownUntil - now;
      return {
        ok: false,
        reason: `action '${actionType}' cooling down for ${remainingMs}ms (strikes=${rec.strikes})`,
      };
    }

    return { ok: true };
  }

  /** Convenience: is the global hard trip currently engaged? */
  isGlobalOpen(): boolean {
    return this.state.globalOpen;
  }

  /**
   * Clear a single action's soft cooldown (and strikes), or all soft cooldowns
   * when `actionType` is omitted. Does NOT clear a global hard trip — use
   * {@link resetGlobal} for that. Resets the rolling 429 counter.
   */
  reset(actionType?: ActionType): void {
    if (actionType) {
      delete this.state.actions[actionType];
    } else {
      this.state.actions = {};
    }
    this.state.rate429Count = 0;
    this.logger?.info('circuit-breaker: soft reset', {
      actionType: actionType ?? 'all',
    });
    this.persist();
  }

  /**
   * Clear the global hard trip. This represents a human having re-logged in.
   * Soft cooldowns are left intact unless `clearSoft` is true.
   */
  resetGlobal(clearSoft = false): void {
    this.state.globalOpen = false;
    this.state.globalTrippedAt = 0;
    this.state.globalReason = '';
    this.state.rate429Count = 0;
    if (clearSoft) {
      this.state.actions = {};
    }
    this.logger?.info('circuit-breaker: global reset (human re-login)', {
      clearSoft,
    });
    this.persist();
  }

  /** Return a defensive copy of the current state (for inspection / tests). */
  getState(): CircuitState {
    return {
      globalOpen: this.state.globalOpen,
      globalTrippedAt: this.state.globalTrippedAt,
      globalReason: this.state.globalReason,
      rate429Count: this.state.rate429Count,
      actions: Object.fromEntries(
        Object.entries(this.state.actions).map(([k, v]) => [k, { ...v }]),
      ),
    };
  }

  // --- internals ---

  /**
   * Compute the soft cooldown duration for the n-th strike. Scales linearly
   * from the min toward the max as strikes accumulate, clamped at the max.
   * Deterministic (no RNG) so persistence/tests stay reproducible.
   */
  private cooldownDurationFor(strikes: number): number {
    const span = this.softCooldownMaxMs - this.softCooldownMinMs;
    if (span <= 0 || strikes <= 1) return this.softCooldownMinMs;
    // strike 1 -> min; each additional strike adds half the span, clamped.
    const extra = Math.min(span, Math.floor((span / 2) * (strikes - 1)));
    return this.softCooldownMinMs + extra;
  }

  private getOrCreate(actionType: ActionType): ActionStrikeRecord {
    const existing = this.state.actions[actionType];
    if (existing) return existing;
    const rec: ActionStrikeRecord = { strikes: 0, cooldownUntil: 0, lastStrikeAt: 0 };
    this.state.actions[actionType] = rec;
    return rec;
  }

  /** Coerce a possibly-partial loaded state into a well-formed CircuitState. */
  private normalize(loaded: Partial<CircuitState>): CircuitState {
    const base = emptyState();
    const actions: Record<string, ActionStrikeRecord> = {};
    const loadedActions = loaded.actions ?? {};
    for (const [key, value] of Object.entries(loadedActions)) {
      actions[key] = {
        strikes: Number(value?.strikes ?? 0),
        cooldownUntil: Number(value?.cooldownUntil ?? 0),
        lastStrikeAt: Number(value?.lastStrikeAt ?? 0),
      };
    }
    return {
      globalOpen: Boolean(loaded.globalOpen ?? base.globalOpen),
      globalTrippedAt: Number(loaded.globalTrippedAt ?? base.globalTrippedAt),
      globalReason: String(loaded.globalReason ?? base.globalReason),
      rate429Count: Number(loaded.rate429Count ?? base.rate429Count),
      actions,
    };
  }

  private persist(): void {
    this.storage?.save(this.getState());
  }
}
