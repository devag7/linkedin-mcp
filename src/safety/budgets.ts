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

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  fsyncSync,
  fstatSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { canonicalPath, withStateLock, SafetyStateError } from './state-lock.js';
import { z } from 'zod';
import {
  UNKNOWN_WRITE_DETAIL,
  type WriteOutcome,
  type OperationOutcome,
} from './write-operation.js';
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
  /** First verified use by this tool, not the age of the LinkedIn account. */
  warmupStartedAt?: number;
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
  operations?: Record<string, WriteRecord>;
}

/** On-disk shape: one entry per account id. */
interface PersistedState {
  version: 1;
  accounts: Record<string, AccountRecord>;
}

interface WriteRecord {
  fingerprint: string;
  action: WriteActionType;
  day: string;
  status: WriteOutcome['status'];
  httpStatus: number;
}

export interface WriteCounters {
  attempted: number;
  successful: number;
  uncertain: number;
}

const counter = z.number().finite().int().nonnegative();
const counters = z.record(counter);
const writeRecordSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  action: z.enum([
    'connections',
    'messages',
    'likes',
    'comments',
    'follows',
    'endorsements',
    'event-invites',
  ]),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum([
    'ok',
    'duplicate',
    'already_connected',
    'restricted',
    'quota_exhausted',
    'not_allowed',
    'failed',
    'unknown',
  ]),
  httpStatus: counter.max(999),
});
const budgetSchema = z.object({
  version: z.literal(1),
  accounts: z.record(
    z.object({
      ageWeek: counter,
      warmupStartedAt: counter.optional(),
      today: z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), counts: counters }),
      monthlySearch: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), count: counter }),
      pendingInvites: counter,
      acceptedInvites: counter,
      sentInvites: counter,
      operations: z.record(writeRecordSchema).optional(),
    }),
  ),
});

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

export function budgetStatePath(override?: string): string {
  return canonicalPath(override ?? join(homedir(), '.linkedin-mcp', 'budgets.json'));
}

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
  private accountId: string | null;
  private readonly inheritLegacy: boolean;
  private fileSeen = false;

  private state: PersistedState;
  private storageFailed = false;

  /**
   * @param accountId Stable account identifier; counters are keyed by this id.
   * @param options Configuration overrides; all numeric policy is configurable.
   */
  constructor(accountId: string | null, options: BudgetTrackerOptions = {}) {
    this.accountId = accountId;
    this.inheritLegacy = accountId === null;
    this.storagePath = budgetStatePath(options.storagePath);
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
  bindAccount(accountKey: string): void {
    if (!/^acct_[a-f0-9]{64}$/.test(accountKey))
      throw new SafetyStateError('ACCOUNT_UNRESOLVED', 'A verified account key is required.');
    if (this.accountId !== null && this.accountId !== accountKey)
      throw new SafetyStateError(
        'ACCOUNT_CHANGED',
        'The signed-in account changed. Stop this runtime and restart after reviewing the account.',
      );
    this.accountId = accountKey;
    if (this.inheritLegacy)
      this.transaction(() => {
        const account = this.getAccount();
        if (account.warmupStartedAt === undefined) {
          account.warmupStartedAt = this.clock();
          // Unknown historical age cannot grant a wider allowance. Counters and
          // operation history are preserved during this additive migration.
          account.ageWeek = 0;
          this.persist();
        }
      });
  }

  get accountResolved(): boolean {
    return this.accountId !== null;
  }

  check(actionType: ActionType): BudgetCheck {
    this.refreshState();
    return this.checkCurrent(actionType);
  }

  private checkCurrent(actionType: ActionType): BudgetCheck {
    this.rollOverIfNeeded();
    const account = this.effectiveAccount();

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
      const monthlyUsed = account.monthlySearch.month === month ? account.monthlySearch.count : 0;
      const monthlyRemaining = Math.max(0, this.monthlyCommercialSearchCap - monthlyUsed);
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
      // Unknown invitations may exist remotely, including from previous days.
      const uncertainInvites = this.uncertainInvites(account);
      const possiblePending = account.pendingInvites + uncertainInvites;
      if (possiblePending > this.pendingInviteCeiling) {
        return {
          allowed: false,
          remaining: 0,
          reason: `pending invites including uncertain outcomes (${possiblePending}) exceed ceiling (${this.pendingInviteCeiling})`,
        };
      }
      const possibleSent = account.sentInvites + uncertainInvites;
      if (possibleSent >= this.acceptanceRateMinSample) {
        const rate = account.acceptedInvites / possibleSent;
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
    this.transaction(() => this.recordCurrent(actionType));
  }

  private recordCurrent(actionType: ActionType): void {
    this.rollOverIfNeeded();
    const account = this.getAccount();

    account.today.counts[actionType] = (account.today.counts[actionType] ?? 0) + 1;

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

  reserveAction(actionType: ReadActionType): void {
    this.transaction(() => {
      const check = this.checkCurrent(actionType);
      if (!check.allowed)
        throw new SafetyStateError('BUDGET_EXHAUSTED', check.reason ?? 'Read budget exhausted.');
      this.recordCurrent(actionType);
    });
  }

  /** A repeated ID is a lookup, even if the current budget/breaker is closed. */
  previousWrite(operationId: string, fingerprint: string): OperationOutcome | undefined {
    this.refreshState();
    return this.previousWriteCurrent(operationId, fingerprint);
  }

  private previousWriteCurrent(
    operationId: string,
    fingerprint: string,
  ): OperationOutcome | undefined {
    const key = this.operationKey(operationId);
    const own = this.getAccount().operations?.[key];
    const legacy = this.inheritLegacy
      ? this.state.accounts['default']?.operations?.[key]
      : undefined;
    const record = own ?? legacy;
    if (!record) return undefined;
    if (record.fingerprint !== fingerprint) {
      throw new Error('Operation ID already belongs to different inputs. No request was sent.');
    }
    return {
      operationId,
      replayed: true,
      status: own ? record.status : 'unknown',
      ok: !!own && record.status === 'ok',
      httpStatus: own ? record.httpStatus : 0,
      detail:
        !own || record.status === 'unknown'
          ? UNKNOWN_WRITE_DETAIL
          : 'Stored outcome; no request was sent again.',
    };
  }

  /** Persist the conservative debit and unknown outcome BEFORE dispatch. */
  reserveWrite(
    action: WriteActionType,
    operationId: string,
    fingerprint: string,
  ): OperationOutcome | undefined {
    return this.transaction(() => this.reserveWriteCurrent(action, operationId, fingerprint));
  }

  private reserveWriteCurrent(
    action: WriteActionType,
    operationId: string,
    fingerprint: string,
  ): OperationOutcome | undefined {
    this.assertAvailable();
    if (!/^[a-f0-9]{64}$/.test(fingerprint))
      throw new SafetyStateError(
        'STATE_INVALID',
        'Invalid operation fingerprint. No action was submitted.',
      );
    const key = this.operationKey(operationId);
    const existing = this.previousWriteCurrent(operationId, fingerprint);
    if (existing) return existing;
    const check = this.checkCurrent(action);
    if (!check.allowed)
      throw new SafetyStateError('BUDGET_EXHAUSTED', check.reason ?? 'Write budget exhausted.');
    const account = this.getAccount();
    const operations = (account.operations ??= {});
    // Never silently evict IDs: eviction would permit accidental resubmission.
    if (Object.keys(operations).length >= 10000) {
      throw new Error('Write journal is full. Stop and review retained operation state.');
    }
    operations[key] = { fingerprint, action, day: this.dayKey(), status: 'unknown', httpStatus: 0 };
    account.today.counts[action] = (account.today.counts[action] ?? 0) + 1;
    this.persist();
  }

  /** Only confirmed connections feed pending-invite and acceptance analytics. */
  finishWrite(operationId: string, outcome: WriteOutcome): void {
    this.transaction(() => this.finishWriteCurrent(operationId, outcome));
  }

  private finishWriteCurrent(operationId: string, outcome: WriteOutcome): void {
    this.assertAvailable();
    const account = this.getAccount();
    const record = account.operations?.[this.operationKey(operationId)];
    if (!record || record.status !== 'unknown') throw new Error('Write operation is not reserved.');
    record.status = outcome.status;
    record.httpStatus = outcome.httpStatus;
    if (outcome.status === 'ok' && record.action === 'connections') {
      account.pendingInvites += 1;
      account.sentInvites += 1;
    }
    try {
      this.persist();
    } catch (error) {
      // The durable reservation remains unknown; never expose a cached success.
      record.status = 'unknown';
      record.httpStatus = 0;
      if (outcome.status === 'ok' && record.action === 'connections') {
        account.pendingInvites -= 1;
        account.sentInvites -= 1;
      }
      throw error;
    }
  }

  private operationKey(operationId: string): string {
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(operationId)) throw new Error('Invalid operation ID.');
    return `op_${operationId}`;
  }

  /** Set the account-age in completed weeks (drives the warmup ramp). */
  setAccountAgeWeek(week: number): void {
    this.transaction(() => this.setAccountAgeWeekCurrent(week));
  }

  private setAccountAgeWeekCurrent(week: number): void {
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
    this.transaction(() => this.recordInviteAcceptedCurrent(count));
  }

  private recordInviteAcceptedCurrent(count: number): void {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new RangeError('Invite count must be a non-negative integer.');
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
    this.transaction(() => this.recordInviteResolvedCurrent(count));
  }

  private recordInviteResolvedCurrent(count: number): void {
    if (!Number.isSafeInteger(count) || count < 0)
      throw new RangeError('Invite count must be a non-negative integer.');
    const account = this.getAccount();
    account.pendingInvites = Math.max(0, account.pendingInvites - count);
    this.persist();
  }

  /** Current outstanding (pending) invite count for this account. */
  getPendingInvites(): number {
    this.refreshState();
    return this.effectiveAccount().pendingInvites;
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
    uncertainInvites: number;
    storageHealthy: boolean;
    accountResolved: boolean;
    legacyAllowanceApplied: boolean;
    /** Journaled writes only; legacy counters remain in actions.used. */
    writes: Partial<Record<WriteActionType, WriteCounters>>;
    actions: Record<ActionType, { used: number; cap: number; remaining: number }>;
  } {
    try {
      this.refreshState();
    } catch {
      /* Diagnostics report the latched storage failure. */
    }
    const today = this.dayKey();
    const account = this.accountId === null ? this.freshAccount() : this.effectiveAccount();
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
    const writes: Partial<Record<WriteActionType, WriteCounters>> = {};
    const journal = this.accountId === null ? {} : (this.getAccount().operations ?? {});
    for (const record of Object.values(journal)) {
      if (record.day !== today) continue;
      const totals = (writes[record.action] ??= { attempted: 0, successful: 0, uncertain: 0 });
      totals.attempted++;
      if (record.status === 'ok') totals.successful++;
      if (record.status === 'unknown') totals.uncertain++;
    }
    return {
      writes,
      storageHealthy: !this.storageFailed,
      accountResolved: this.accountResolved,
      legacyAllowanceApplied: this.inheritLegacy && !!this.state.accounts['default'],
      day: account.today.day,
      ageWeek: account.ageWeek,
      pendingInvites: account.pendingInvites,
      uncertainInvites: this.uncertainInvites(account),
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
      return (account.today.counts['likes'] ?? 0) + (account.today.counts['comments'] ?? 0);
    }
    return account.today.counts[actionType] ?? 0;
  }

  private uncertainInvites(account: AccountRecord): number {
    return Object.values(account.operations ?? {}).filter(
      (operation) => operation.action === 'connections' && operation.status === 'unknown',
    ).length;
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

  private dailyCapReason(actionType: ActionType, cap: number, ageWeek: number): string {
    const ramped =
      this.warmupStep(ageWeek) !== null &&
      (actionType === 'connections' || actionType === 'profile-views' || actionType === 'messages');
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
    if (this.accountId === null)
      throw new SafetyStateError(
        'ACCOUNT_UNRESOLVED',
        'Account identity has not been verified. No action was submitted.',
      );
    let account = this.state.accounts[this.accountId];
    if (!account) {
      account = this.freshAccount();
      this.state.accounts[this.accountId] = account;
    }
    return account;
  }

  private effectiveAccount(): AccountRecord {
    const stored = this.getAccount();
    const own = {
      ...stored,
      ageWeek:
        this.inheritLegacy && stored.warmupStartedAt !== undefined
          ? Math.floor(
              Math.max(0, this.clock() - stored.warmupStartedAt) / (7 * 24 * 60 * 60 * 1000),
            ) + 1
          : stored.ageWeek,
      today: stored.today.day === this.dayKey() ? stored.today : { day: this.dayKey(), counts: {} },
    };
    const legacy = this.inheritLegacy ? this.state.accounts['default'] : undefined;
    if (!legacy) return own;
    const counts = { ...own.today.counts };
    if (legacy.today.day === this.dayKey())
      for (const [action, count] of Object.entries(legacy.today.counts))
        counts[action] = (counts[action] ?? 0) + count;
    const monthly =
      (own.monthlySearch.month === this.monthKey() ? own.monthlySearch.count : 0) +
      (legacy.monthlySearch.month === this.monthKey() ? legacy.monthlySearch.count : 0);
    return {
      ...own,
      today: { day: this.dayKey(), counts },
      monthlySearch: { month: this.monthKey(), count: monthly },
      pendingInvites: own.pendingInvites + legacy.pendingInvites + this.uncertainInvites(legacy),
      // Unattributed successes cannot improve this account's acceptance rate.
      sentInvites: own.sentInvites + legacy.sentInvites + this.uncertainInvites(legacy),
    };
  }

  private transaction<T>(fn: () => T): T {
    this.assertAvailable();
    return withStateLock(this.storagePath, () => {
      this.refreshState();
      this.rollOverIfNeeded();
      return fn();
    });
  }

  verifyStorage(): void {
    this.refreshState();
  }

  private refreshState(): void {
    this.assertAvailable();
    try {
      this.state = this.load();
    } catch (error) {
      this.storageFailed = true;
      throw error;
    }
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
    if (this.accountId === null) return;
    const account = this.state.accounts[this.accountId];
    if (!account) return;
    const today = this.dayKey();
    if (account.today.day !== today) {
      account.today = { day: today, counts: {} };
    }
  }

  // --- persistence ----------------------------------------------------------

  private load(): PersistedState {
    try {
      const fd = openSync(this.storagePath, 'r');
      try {
        if (fstatSync(fd).size > 8 * 1024 * 1024) throw new Error('oversized');
        const loaded = budgetSchema.parse(JSON.parse(readFileSync(fd, 'utf8')));
        this.fileSeen = true;
        return loaded;
      } finally {
        closeSync(fd);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && !this.fileSeen)
        return { version: 1, accounts: {} };
      throw new Error(
        'Budget state is unreadable or invalid. Restore safety state before restarting; counters were not reset.',
      );
    }
  }

  /** All guarded work must stop after a persistence failure, including unmetered reads. */
  assertAvailable(): void {
    if (this.storageFailed)
      throw new Error(
        'Budget storage failed. Stop automation and repair safety state before restarting.',
      );
  }

  /** Atomic replacement keeps counters and the operation reservation together. */
  private persist(): void {
    this.assertAvailable();
    const temp = `${this.storagePath}.${randomUUID()}.tmp`;
    try {
      mkdirSync(dirname(this.storagePath), { recursive: true, mode: 0o700 });
      const body = JSON.stringify(this.state);
      if (Buffer.byteLength(body) > 8 * 1024 * 1024) throw new Error('oversized');
      const fd = openSync(temp, 'wx', 0o600);
      try {
        writeFileSync(fd, body, 'utf8');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      renameSync(temp, this.storagePath);
      this.fileSeen = true;
    } catch {
      this.storageFailed = true;
      this.logger?.error('Budget storage failed; automation stopped.');
      throw new Error(
        'Budget state could not be saved. Stop automation and repair safety-state storage before restarting.',
      );
    } finally {
      try {
        unlinkSync(temp);
      } catch {
        /* Renamed or never created. */
      }
    }
  }
}
