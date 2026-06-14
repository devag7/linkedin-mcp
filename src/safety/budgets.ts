/**
 * Budget Tracker
 *
 * Persists per-action-type counters keyed by account-id + local-day and
 * enforces the daily write/read caps, the combined-write hard cap, the
 * warmup ramp, the pending-invite ceiling, the rolling acceptance-rate
 * pause, and the monthly commercial-use search budget from the locked
 * numeric safety policy.
 *
 * Pure logic: only node builtins + the shared Logger type. No network,
 * no browser. The clock is injectable so behaviour is deterministic in
 * tests; core decision logic NEVER calls the system clock directly.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { Logger } from '../types.js';

/** Write actions tracked against daily + combined-write caps. */
export type WriteActionType =
  | 'connections'
  | 'messages'
  | 'likes'
  | 'comments'
  | 'follows'
  | 'endorsements'
  | 'event-invites';

/** Read actions tracked against daily read caps. */
export type ReadActionType = 'profile-views' | 'searches';

/** Every action type the tracker understands. */
export type ActionType = WriteActionType | ReadActionType;

/** Result of a budget check for a single action type. */
export interface BudgetCheck {
  /** Whether one unit of this action is permitted right now. */
  allowed: boolean;
  /** Remaining units before the binding limit is hit (never negative). */
  remaining: number;
  /** Human-readable reason populated only when `allowed` is false. */
  reason?: string;
}

/** Per-account, per-local-day persisted counters. */
interface DayRecord {
  /** Local day key, e.g. "2026-06-13". */
  day: string;
  /** Counts keyed by action type for this day. */
  counts: Record<string, number>;
}

/** Per-account persisted state. */
interface AccountRecord {
  /** Account age in completed weeks (drives the warmup ramp). */
  ageWeek: number;
  /** The single tracked local day (reset when the day rolls over). */
  today: DayRecord;
  /** Monthly commercial-use search counter keyed by "YYYY-MM". */
  monthlySearch: { month: string; count: number };
  /** Outstanding (pending) connection invites. */
  pendingInvites: number;
  /** Connection invites that have been accepted (rolling). */
  acceptedInvites: number;
  /** Connection invites that have been sent (rolling, for acceptance-rate). */
  sentInvites: number;
}

/** On-disk shape: one entry per account id. */
interface PersistedState {
  version: 1;
  accounts: Record<string, AccountRecord>;
}

/** Daily cap configuration. */
export interface DailyCaps {
  connections: number;
  messages: number;
  /** Combined cap shared by likes + comments. */
  likesComments: number;
  follows: number;
  endorsements: number;
  eventInvites: number;
  profileViews: number;
  searches: number;
}

/** A single warmup ramp step. */
export interface WarmupStep {
  connects: number;
  views: number;
  msgs: number;
}

/** Constructor options. All numeric policy is configurable. */
export interface BudgetTrackerOptions {
  /** Storage file path. Defaults to ~/.linkedin-mcp/budgets.json. */
  storagePath?: string;
  /** Injected clock returning epoch milliseconds. Defaults to Date.now. */
  clock?: () => number;
  /** Optional logger. */
  logger?: Logger;
  /** Daily caps. Defaults to the locked numeric policy. */
  dailyCaps?: Partial<DailyCaps>;
  /** Combined writes hard cap per 24h. Default 150. */
  combinedWriteCap?: number;
  /** Pending-invite ceiling: pause connects when outstanding exceeds this. Default 400. */
  pendingInviteCeiling?: number;
  /** Acceptance-rate floor (fraction). Pause connects below this. Default 0.2. */
  acceptanceRateFloor?: number;
  /** Minimum sent invites before the acceptance-rate gate engages. Default 20. */
  acceptanceRateMinSample?: number;
  /** Warmup ramp by account-age-week. Index 0 = week 1. Default per policy. */
  warmupRamp?: WarmupStep[];
  /** Monthly commercial-use search budget for free accounts. Default 250. */
  monthlyCommercialSearchCap?: number;
  /** Whether this account is on a free plan (gates the monthly search budget). Default true. */
  freeAccount?: boolean;
}

/** Default daily caps from the locked numeric policy. */
export const DEFAULT_DAILY_CAPS: DailyCaps = {
  connections: 20,
  messages: 50,
  likesComments: 50,
  follows: 30,
  endorsements: 20,
  eventInvites: 20,
  profileViews: 80,
  searches: 30,
};

/**
 * Default warmup ramp. Index 0 = week 1.
 * W1 {5,10,0}; W2 {10,20,10}; W3 {15,50,15}; W4+ unbounded (full caps apply).
 */
export const DEFAULT_WARMUP_RAMP: WarmupStep[] = [
  { connects: 5, views: 10, msgs: 0 },
  { connects: 10, views: 20, msgs: 10 },
  { connects: 15, views: 50, msgs: 15 },
];

const WRITE_ACTIONS: readonly WriteActionType[] = [
  'connections',
  'messages',
  'likes',
  'comments',
  'follows',
  'endorsements',
  'event-invites',
];

/**
 * Tracks and enforces per-account action budgets, persisting to a JSON file.
 */
export class BudgetTracker {
  private readonly storagePath: string;
  private readonly clock: () => number;
  private readonly logger: Logger | undefined;
  private readonly dailyCaps: DailyCaps;
  private readonly combinedWriteCap: number;
  private readonly pendingInviteCeiling: number;
  private readonly acceptanceRateFloor: number;
  private readonly acceptanceRateMinSample: number;
  private readonly warmupRamp: WarmupStep[];
  private readonly monthlyCommercialSearchCap: number;
  private readonly freeAccount: boolean;
  private readonly accountId: string;

  private state: PersistedState;

  /**
   * @param accountId Stable account identifier; counters are keyed by this id.
   * @param options Configuration overrides; all numeric policy is configurable.
   */
  constructor(accountId: string, options: BudgetTrackerOptions = {}) {
    this.accountId = accountId;
    this.storagePath =
      options.storagePath ?? join(homedir(), '.linkedin-mcp', 'budgets.json');
    this.clock = options.clock ?? (() => Date.now());
    this.logger = options.logger;
    this.dailyCaps = { ...DEFAULT_DAILY_CAPS, ...options.dailyCaps };
    this.combinedWriteCap = options.combinedWriteCap ?? 150;
    this.pendingInviteCeiling = options.pendingInviteCeiling ?? 400;
    this.acceptanceRateFloor = options.acceptanceRateFloor ?? 0.2;
    this.acceptanceRateMinSample = options.acceptanceRateMinSample ?? 20;
    this.warmupRamp = options.warmupRamp ?? DEFAULT_WARMUP_RAMP;
    this.monthlyCommercialSearchCap = options.monthlyCommercialSearchCap ?? 250;
    this.freeAccount = options.freeAccount ?? true;

    this.state = this.load();
  }

  /**
   * Check whether one unit of `actionType` is permitted right now.
   * Does not mutate counters; call {@link record} after a successful action.
   */
  check(actionType: ActionType): BudgetCheck {
    this.rollOverIfNeeded();
    const account = this.getAccount();

    // 1) Per-action daily cap (respecting warmup ramp for gated actions).
    const dailyCap = this.effectiveDailyCap(actionType, account.ageWeek);
    const used = this.count(account, actionType);
    let remaining = Math.max(0, dailyCap - used);

    if (used >= dailyCap) {
      return {
        allowed: false,
        remaining: 0,
        reason: this.dailyCapReason(actionType, dailyCap, account.ageWeek),
      };
    }

    // 2) Combined-write hard cap (applies to all write actions collectively).
    if (this.isWriteAction(actionType)) {
      const combinedUsed = this.combinedWriteCount(account);
      const combinedRemaining = Math.max(0, this.combinedWriteCap - combinedUsed);
      remaining = Math.min(remaining, combinedRemaining);
      if (combinedUsed >= this.combinedWriteCap) {
        return {
          allowed: false,
          remaining: 0,
          reason: `combined daily write cap reached (${this.combinedWriteCap})`,
        };
      }
    }

    // 3) Monthly commercial-use search budget (free accounts only).
    if (actionType === 'searches' && this.freeAccount) {
      const month = this.monthKey();
      const monthlyUsed =
        account.monthlySearch.month === month ? account.monthlySearch.count : 0;
      const monthlyRemaining = Math.max(
        0,
        this.monthlyCommercialSearchCap - monthlyUsed,
      );
      remaining = Math.min(remaining, monthlyRemaining);
      if (monthlyUsed >= this.monthlyCommercialSearchCap) {
        return {
          allowed: false,
          remaining: 0,
          reason: `monthly commercial-use search budget reached (${this.monthlyCommercialSearchCap})`,
        };
      }
    }

    // 4) Connection-specific gates: pending-invite ceiling + acceptance-rate.
    if (actionType === 'connections') {
      if (account.pendingInvites > this.pendingInviteCeiling) {
        return {
          allowed: false,
          remaining: 0,
          reason: `pending invites (${account.pendingInvites}) exceed ceiling (${this.pendingInviteCeiling})`,
        };
      }
      if (account.sentInvites >= this.acceptanceRateMinSample) {
        const rate = account.acceptedInvites / account.sentInvites;
        if (rate < this.acceptanceRateFloor) {
          return {
            allowed: false,
            remaining: 0,
            reason: `acceptance rate ${(rate * 100).toFixed(1)}% below floor ${(
              this.acceptanceRateFloor * 100
            ).toFixed(0)}%`,
          };
        }
      }
    }

    return { allowed: true, remaining };
  }

  /**
   * Record one unit of `actionType` against today's counters and persist.
   * Always increments — call {@link check} first to enforce policy.
   */
  record(actionType: ActionType): void {
    this.rollOverIfNeeded();
    const account = this.getAccount();

    account.today.counts[actionType] = this.count(account, actionType) + 1;

    if (actionType === 'searches' && this.freeAccount) {
      const month = this.monthKey();
      if (account.monthlySearch.month !== month) {
        account.monthlySearch = { month, count: 0 };
      }
      account.monthlySearch.count += 1;
    }

    if (actionType === 'connections') {
      account.pendingInvites += 1;
      account.sentInvites += 1;
    }

    this.persist();
  }

  /** Set the account-age in completed weeks (drives the warmup ramp). */
  setAccountAgeWeek(week: number): void {
    if (!Number.isFinite(week) || week < 0) {
      throw new RangeError(`account age week must be a non-negative number, got ${week}`);
    }
    const account = this.getAccount();
    account.ageWeek = Math.floor(week);
    this.persist();
  }

  /**
   * Record that a previously-sent invite was accepted. Decrements the
   * pending-invite count and feeds the rolling acceptance-rate.
   */
  recordInviteAccepted(count = 1): void {
    const account = this.getAccount();
    account.acceptedInvites += count;
    account.pendingInvites = Math.max(0, account.pendingInvites - count);
    this.persist();
  }

  /**
   * Record that a previously-sent invite was withdrawn/expired/declined.
   * Decrements the pending-invite count without crediting acceptance.
   */
  recordInviteResolved(count = 1): void {
    const account = this.getAccount();
    account.pendingInvites = Math.max(0, account.pendingInvites - count);
    this.persist();
  }

  /** Current outstanding (pending) invite count for this account. */
  getPendingInvites(): number {
    return this.getAccount().pendingInvites;
  }

  /**
   * A read-only snapshot of today's budget state for surfacing in health_check:
   * account age, pending invites, and per-action used/cap/remaining. Does not
   * mutate counters.
   */
  snapshot(): {
    day: string;
    ageWeek: number;
    pendingInvites: number;
    actions: Record<ActionType, { used: number; cap: number; remaining: number }>;
  } {
    // Read-only: do NOT call rollOverIfNeeded() (it persists). Instead derive the
    // rolled-over view in memory — if the stored day is stale, today's counts are
    // all zero — so a diagnostic health_check never mutates persisted state.
    const today = this.dayKey();
    const stored = this.state.accounts[this.accountId];
    const account: AccountRecord = stored
      ? stored.today.day === today
        ? stored
        : { ...stored, today: { day: today, counts: {} } }
      : this.freshAccount();
    const types: ActionType[] = [
      'connections',
      'messages',
      'likes',
      'comments',
      'follows',
      'endorsements',
      'event-invites',
      'profile-views',
      'searches',
    ];
    const actions = {} as Record<ActionType, { used: number; cap: number; remaining: number }>;
    for (const t of types) {
      const cap = this.effectiveDailyCap(t, account.ageWeek);
      const used = this.count(account, t);
      actions[t] = { used, cap, remaining: Math.max(0, cap - used) };
    }
    return {
      day: account.today.day,
      ageWeek: account.ageWeek,
      pendingInvites: account.pendingInvites,
      actions,
    };
  }

  // --- internal helpers -----------------------------------------------------

  /** Effective daily cap for an action, applying the warmup ramp where relevant. */
  private effectiveDailyCap(actionType: ActionType, ageWeek: number): number {
    const baseCap = this.baseDailyCap(actionType);
    const step = this.warmupStep(ageWeek);
    if (!step) return baseCap; // week 4+ => full caps.

    switch (actionType) {
      case 'connections':
        return Math.min(baseCap, step.connects);
      case 'profile-views':
        return Math.min(baseCap, step.views);
      case 'messages':
        return Math.min(baseCap, step.msgs);
      default:
        return baseCap;
    }
  }

  /** The static (non-warmup) daily cap for an action type. */
  private baseDailyCap(actionType: ActionType): number {
    switch (actionType) {
      case 'connections':
        return this.dailyCaps.connections;
      case 'messages':
        return this.dailyCaps.messages;
      case 'likes':
      case 'comments':
        return this.dailyCaps.likesComments;
      case 'follows':
        return this.dailyCaps.follows;
      case 'endorsements':
        return this.dailyCaps.endorsements;
      case 'event-invites':
        return this.dailyCaps.eventInvites;
      case 'profile-views':
        return this.dailyCaps.profileViews;
      case 'searches':
        return this.dailyCaps.searches;
      default: {
        // Exhaustiveness guard.
        const never: never = actionType;
        throw new Error(`unknown action type: ${String(never)}`);
      }
    }
  }

  /** Warmup step for a given age-week, or null when past the ramp (week 4+). */
  private warmupStep(ageWeek: number): WarmupStep | null {
    if (ageWeek <= 0) return this.warmupRamp[0] ?? null;
    const idx = ageWeek - 1;
    if (idx >= this.warmupRamp.length) return null;
    return this.warmupRamp[idx] ?? null;
  }

  /** Used count for an action on the current day (likes/comments share a pool). */
  private count(account: AccountRecord, actionType: ActionType): number {
    if (actionType === 'likes' || actionType === 'comments') {
      return (
        (account.today.counts['likes'] ?? 0) +
        (account.today.counts['comments'] ?? 0)
      );
    }
    return account.today.counts[actionType] ?? 0;
  }

  /** Sum of all write-action counts for the current day. */
  private combinedWriteCount(account: AccountRecord): number {
    let total = 0;
    for (const action of WRITE_ACTIONS) {
      total += account.today.counts[action] ?? 0;
    }
    return total;
  }

  private isWriteAction(actionType: ActionType): actionType is WriteActionType {
    return (WRITE_ACTIONS as readonly string[]).includes(actionType);
  }

  private dailyCapReason(
    actionType: ActionType,
    cap: number,
    ageWeek: number,
  ): string {
    const ramped =
      this.warmupStep(ageWeek) !== null &&
      (actionType === 'connections' ||
        actionType === 'profile-views' ||
        actionType === 'messages');
    if (ramped) {
      return `daily warmup cap reached for ${actionType} (${cap}, week ${ageWeek})`;
    }
    if (actionType === 'likes' || actionType === 'comments') {
      return `daily likes+comments cap reached (${cap})`;
    }
    return `daily cap reached for ${actionType} (${cap})`;
  }

  /** Local-day key "YYYY-MM-DD" derived from the injected clock. */
  private dayKey(): string {
    return this.formatLocalDay(new Date(this.clock()));
  }

  /** Local-month key "YYYY-MM" derived from the injected clock. */
  private monthKey(): string {
    const d = new Date(this.clock());
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}`;
  }

  private formatLocalDay(d: Date): string {
    return `${d.getFullYear()}-${this.pad(d.getMonth() + 1)}-${this.pad(d.getDate())}`;
  }

  private pad(n: number): string {
    return n < 10 ? `0${n}` : `${n}`;
  }

  /** Get (creating if absent) the record for this tracker's account. */
  private getAccount(): AccountRecord {
    let account = this.state.accounts[this.accountId];
    if (!account) {
      account = this.freshAccount();
      this.state.accounts[this.accountId] = account;
    }
    return account;
  }

  private freshAccount(): AccountRecord {
    return {
      ageWeek: 0,
      today: { day: this.dayKey(), counts: {} },
      monthlySearch: { month: this.monthKey(), count: 0 },
      pendingInvites: 0,
      acceptedInvites: 0,
      sentInvites: 0,
    };
  }

  /** Reset the daily counters when the local day has rolled over. */
  private rollOverIfNeeded(): void {
    const account = this.state.accounts[this.accountId];
    if (!account) return;
    const today = this.dayKey();
    if (account.today.day !== today) {
      account.today = { day: today, counts: {} };
      this.persist();
    }
  }

  // --- persistence ----------------------------------------------------------

  private load(): PersistedState {
    try {
      if (!existsSync(this.storagePath)) {
        return { version: 1, accounts: {} };
      }
      const raw = readFileSync(this.storagePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (!parsed || typeof parsed !== 'object' || !parsed.accounts) {
        return { version: 1, accounts: {} };
      }
      return { version: 1, accounts: parsed.accounts };
    } catch (err) {
      this.logger?.warn('failed to load budget state; starting fresh', {
        path: this.storagePath,
        error: err instanceof Error ? err.message : String(err),
      });
      return { version: 1, accounts: {} };
    }
  }

  /** Write the full state to disk with 0600 permissions on the file + dir. */
  private persist(): void {
    const dir = dirname(this.storagePath);
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    } catch {
      // Directory may already exist; ignore.
    }
    const body = JSON.stringify(this.state, null, 2);
    writeFileSync(this.storagePath, body, { encoding: 'utf8', mode: 0o600 });
  }
}
