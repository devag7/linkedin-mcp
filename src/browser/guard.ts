import {
  assertNotCancelled,
  bindCancellation,
  requestCancellation,
} from '../tools/cancellation.js';
/**
 * Guard — the safety gateway every data/action call passes through.
 *
 * Composes the four pure safety primitives (serial queue, human pacer, daily
 * budgets, circuit breaker) into guarded reads and write transactions:
 *
 *   1. circuit breaker — refuse if a challenge/checkpoint tripped it
 *   2. daily budget    — refuse if the per-action cap (or warmup ramp) is hit
 *   3. serial queue    — one action at a time, in order
 *   4. human pacer     — jittered human-like delay before the action
 *   5. reads reserve attempts; writes reserve an attempt, then settle the outcome
 *   6. returned rate limits/restrictions cool down; challenges hard-trip globally
 *
 * Keeps the safety/ modules dependency-free (they never import browser code);
 * this integration layer is the only place that knows about VoyagerError.
 */

import { WritePreviews } from '../safety/write-preview.js';
import { createHash, randomUUID } from 'node:crypto';
import { classifyWrite } from './write-status.js';
import type { RawPostResult } from './voyager.js';
import {
  UNKNOWN_WRITE_DETAIL,
  type OperationOutcome,
  type WriteKind,
  type WriteOutcome,
} from '../safety/write-operation.js';
import type { WriteActionType } from '../safety/budgets.js';
import { SerialQueue } from '../safety/queue.js';
import { HumanPacer, type ActionType as PaceAction } from '../safety/pacer.js';
import { BudgetTracker, type ActionType as BudgetAction } from '../safety/budgets.js';
import { CircuitBreaker, type ActionType as BreakerAction } from '../safety/circuit-breaker.js';
import { VoyagerError } from './voyager.js';
import { BrowserSafetyError, CHECKPOINT_MESSAGE } from './safety.js';
import type { Logger } from '../types.js';

/** Describes how one tool action maps onto the three safety dimensions. */
export interface ActionDescriptor {
  /** Pacing band: reads are quick, writes are slow + working-hours gated. */
  pace: PaceAction;
  /** Daily-cap bucket, or null for reads that are not metered. */
  budget: BudgetAction | null;
  /** Circuit-breaker attribution for the pre-check and any trip. */
  breaker: BreakerAction;
}

/** Canonical action descriptors used by the tool layer. */
export const ACTIONS = {
  getProfile: { pace: 'read', budget: 'profile-views', breaker: 'profile-view' },
  search: { pace: 'read', budget: 'searches', breaker: 'search' },
  readGeneric: { pace: 'read', budget: null, breaker: 'read' },
  connect: { pace: 'write', budget: 'connections', breaker: 'connect' },
  message: { pace: 'write', budget: 'messages', breaker: 'message' },
  like: { pace: 'write', budget: 'likes', breaker: 'like' },
  comment: { pace: 'write', budget: 'comments', breaker: 'comment' },
  follow: { pace: 'write', budget: 'follows', breaker: 'follow' },
} satisfies Record<string, ActionDescriptor>;

/** Thrown when a call is refused before it runs (breaker open / budget hit). */
export class GuardBlockedError extends Error {
  constructor(
    public readonly code: 'CIRCUIT_OPEN' | 'BUDGET_EXHAUSTED',
    message: string,
  ) {
    super(message);
    this.name = 'GuardBlockedError';
  }
}

export class Guard {
  readonly previews = new WritePreviews();
  constructor(
    private readonly queue: SerialQueue,
    private readonly pacer: HumanPacer,
    private readonly budget: BudgetTracker,
    private readonly breaker: CircuitBreaker,
    private readonly logger?: Logger,
    private readonly prepare?: () => Promise<void>,
  ) {}

  /**
   * Run `fn` under the full safety stack. Throws GuardBlockedError if refused
   * before running; rethrows any error from `fn` (after feeding the breaker).
   */
  async run<T>(action: ActionDescriptor, fn: () => Promise<T>): Promise<T> {
    assertNotCancelled();
    this.assertBreaker(action);
    this.budget.verifyStorage();
    return this.queue.enqueue(
      bindCancellation(async () => {
        assertNotCancelled();
        this.budget.verifyStorage();
        await this.prepare?.();
        // A previous queued action may have tripped the breaker or spent the cap.
        this.assertAllowed(action);
        await this.pacer
          .waitBefore(action.pace, requestCancellation.getStore())
          .catch((error: unknown) => {
            assertNotCancelled();
            throw error;
          });
        assertNotCancelled();
        this.budget.verifyStorage();
        await this.prepare?.();
        this.assertAllowed(action);
        if (action.budget === 'searches' || action.budget === 'profile-views')
          this.budget.reserveAction(action.budget);
        try {
          return await fn();
        } catch (err) {
          this.observeError(action, err);
          throw err;
        }
      }),
    );
  }

  /** Lookup is not authorization for a new action. Cold identity work is allowed
   * only for an ID actually present in retained storage. */
  async lookupWrite(
    action: ActionDescriptor,
    kind: WriteKind,
    inputs: unknown,
    operationId: string,
  ): Promise<OperationOutcome | undefined> {
    assertNotCancelled();
    if (!this.budget.hasRecordedOperation(operationId)) return undefined;
    if (!this.budget.accountResolved) {
      this.assertBreaker(ACTIONS.readGeneric);
      await this.queue.enqueue(
        bindCancellation(async () => {
          assertNotCancelled();
          this.budget.verifyStorage();
          await this.prepare?.();
        }),
      );
    }
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([kind, action.budget, inputs]))
      .digest('hex');
    return this.budget.previousWrite(operationId, fingerprint);
  }

  /** Reserve once, submit once, classify and settle before the next queued action. */
  async runWrite(
    action: ActionDescriptor,
    kind: WriteKind,
    inputs: unknown,
    operationId: string = randomUUID(),
    fn: (beforeDispatch: () => void) => Promise<RawPostResult>,
    authorization?: { assert: () => void; consume: () => void },
  ): Promise<OperationOutcome> {
    assertNotCancelled();
    if (
      action.pace !== 'write' ||
      !action.budget ||
      action.budget === 'searches' ||
      action.budget === 'profile-views'
    ) {
      throw new Error('A write requires a write budget.');
    }
    const bucket: WriteActionType = action.budget;
    // Tool code supplies a fixed-order, normalized object. Random transport
    // tokens and caller approval are deliberately excluded from the fingerprint.
    const fingerprint = createHash('sha256')
      .update(JSON.stringify([kind, bucket, inputs]))
      .digest('hex');
    if (!this.budget.accountResolved) {
      // Identity resolution is a read; an action cooldown must not prevent
      // retrieving that account's previously stored outcome after restart.
      this.assertBreaker(ACTIONS.readGeneric);
      assertNotCancelled();
      this.budget.verifyStorage();
      await this.prepare?.();
    }
    const previous = () => this.budget.previousWrite(operationId, fingerprint);
    const existing = previous();
    if (existing) return existing;
    authorization?.assert();
    this.assertAllowed(action);
    return this.queue.enqueue(
      bindCancellation(async () => {
        assertNotCancelled();
        this.budget.verifyStorage();
        await this.prepare?.();
        const cached = previous();
        if (cached) return cached;
        authorization?.assert();
        this.assertAllowed(action);
        await this.pacer
          .waitBefore(action.pace, requestCancellation.getStore())
          .catch((error: unknown) => {
            assertNotCancelled();
            throw error;
          });
        assertNotCancelled();
        this.budget.verifyStorage();
        await this.prepare?.();
        const afterPacing = previous();
        if (afterPacing) return afterPacing;
        authorization?.assert();
        this.assertAllowed(action);
        let dispatched = false;
        let replay: OperationOutcome | undefined;
        let outcome: WriteOutcome;
        try {
          const raw = await fn(() => {
            assertNotCancelled();
            if (dispatched) throw new Error('A write transaction may submit only once.');
            // Also protects the callback boundary if queue concurrency is > 1.
            replay = previous();
            if (replay) throw new Error('Operation already reserved.');
            this.assertAllowed(action);
            authorization?.assert();
            replay = this.budget.reserveWrite(bucket, operationId, fingerprint);
            if (replay) throw new Error('Operation already reserved.');
            dispatched = true;
            authorization?.consume();
          });
          if (!dispatched) throw new Error('Write provider did not reserve before dispatch.');
          outcome = classifyWrite(raw, kind);
        } catch (err) {
          if (replay) return replay;
          let stopStorageFailed = false;
          try {
            this.observeError(action, err);
          } catch (stopError) {
            if (!dispatched) throw stopError;
            stopStorageFailed = true;
          }
          // Browser launch, auth preflight and mailbox lookup failures did not
          // submit a write and must not create an uncertain attempt.
          if (!dispatched) throw err;
          outcome = {
            status: 'unknown',
            ok: false,
            httpStatus: 0,
            detail: UNKNOWN_WRITE_DETAIL,
          };
          if (err instanceof VoyagerError && err.code === 'AUTH_REQUIRED' && err.status === 401) {
            outcome = {
              status: 'failed',
              ok: false,
              httpStatus: 401,
              detail: 'LinkedIn rejected authentication. Run --login.',
            };
          } else if (err instanceof BrowserSafetyError) {
            outcome.detail = `${UNKNOWN_WRITE_DETAIL} ${err.message}`;
          } else if (err instanceof VoyagerError && err.code === 'CLOUDFLARE_BLOCKED') {
            outcome.detail = `${UNKNOWN_WRITE_DETAIL} ${CHECKPOINT_MESSAGE}`;
          }
          if (stopStorageFailed)
            outcome.detail = `${UNKNOWN_WRITE_DETAIL} Safety-stop storage failed; stop automation and repair storage.`;
        }
        try {
          this.budget.finishWrite(operationId, outcome);
        } catch {
          // Reservation is durable and remains unknown; no retry is attempted.
          return {
            operationId,
            replayed: false,
            status: 'unknown',
            ok: false,
            httpStatus: outcome.httpStatus,
            detail: `${UNKNOWN_WRITE_DETAIL} Outcome storage failed; stop and repair safety state.`,
          };
        }
        if (outcome.status === 'quota_exhausted' || outcome.status === 'restricted') {
          try {
            this.breaker.trip('soft', action.breaker, `Write ${outcome.status}`);
          } catch {
            // The breaker latches a global in-memory stop on persistence failure.
            // Preserve the known write outcome and ID so it can be looked up.
            outcome.detail =
              'Safety-stop storage failed; stop automation and repair storage before restarting.';
          }
        }
        return { ...outcome, operationId, replayed: false };
      }),
    );
  }

  private observeError(action: ActionDescriptor, err: unknown): void {
    // Trip before the queue starts the next task, even for legacy callers
    // that throw a challenge error without a shared BrowserSafety observer.
    if (
      (err instanceof BrowserSafetyError && err.code === 'CHECKPOINT_REQUIRED') ||
      (err instanceof VoyagerError && err.code === 'CLOUDFLARE_BLOCKED')
    ) {
      if (!this.breaker.isGlobalOpen()) this.breaker.trip('hard', undefined, CHECKPOINT_MESSAGE);
    } else if (err instanceof VoyagerError && err.code === 'RATE_LIMITED') {
      this.breaker.trip('soft', action.breaker, 'HTTP 429');
      this.logger?.warn('Guard: breaker soft-tripped on rate limit', {
        action: action.breaker,
      });
    }
  }

  private assertBreaker(action: ActionDescriptor): void {
    const proceed = this.breaker.canProceed(action.breaker);
    if (!proceed.ok) {
      throw new GuardBlockedError('CIRCUIT_OPEN', proceed.reason ?? 'Circuit breaker is open.');
    }
  }

  private assertAllowed(action: ActionDescriptor): void {
    this.assertBreaker(action);
    this.budget.verifyStorage();
    if (action.budget) {
      const check = this.budget.check(action.budget);
      if (!check.allowed) {
        throw new GuardBlockedError(
          'BUDGET_EXHAUSTED',
          check.reason ?? `Daily budget for ${action.budget} exhausted.`,
        );
      }
    }
  }
}
