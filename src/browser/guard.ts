/**
 * Guard — the safety gateway every data/action call passes through.
 *
 * Composes the four pure safety primitives (serial queue, human pacer, daily
 * budgets, circuit breaker) into a single `run()` that wraps a Voyager call:
 *
 *   1. circuit breaker — refuse if a challenge/checkpoint tripped it
 *   2. daily budget    — refuse if the per-action cap (or warmup ramp) is hit
 *   3. serial queue    — one action at a time, in order
 *   4. human pacer     — jittered human-like delay before the action
 *   5. on success       — record the action against the budget
 *   6. on Voyager error — feed the breaker (429 / Cloudflare → soft trip)
 *
 * Keeps the safety/ modules dependency-free (they never import browser code);
 * this integration layer is the only place that knows about VoyagerError.
 */

import { SerialQueue } from '../safety/queue.js';
import { HumanPacer, type ActionType as PaceAction } from '../safety/pacer.js';
import { BudgetTracker, type ActionType as BudgetAction } from '../safety/budgets.js';
import { CircuitBreaker, type ActionType as BreakerAction } from '../safety/circuit-breaker.js';
import { VoyagerError } from './voyager.js';
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
  constructor(
    private readonly queue: SerialQueue,
    private readonly pacer: HumanPacer,
    private readonly budget: BudgetTracker,
    private readonly breaker: CircuitBreaker,
    private readonly logger?: Logger,
  ) {}

  /**
   * Run `fn` under the full safety stack. Throws GuardBlockedError if refused
   * before running; rethrows any error from `fn` (after feeding the breaker).
   */
  async run<T>(action: ActionDescriptor, fn: () => Promise<T>): Promise<T> {
    const proceed = this.breaker.canProceed(action.breaker);
    if (!proceed.ok) {
      throw new GuardBlockedError('CIRCUIT_OPEN', proceed.reason ?? 'Circuit breaker is open.');
    }
    if (action.budget) {
      const check = this.budget.check(action.budget);
      if (!check.allowed) {
        throw new GuardBlockedError(
          'BUDGET_EXHAUSTED',
          check.reason ?? `Daily budget for ${action.budget} exhausted.`,
        );
      }
    }

    try {
      return await this.queue.enqueue(async () => {
        await this.pacer.waitBefore(action.pace);
        const result = await fn();
        if (action.budget) this.budget.record(action.budget);
        return result;
      });
    } catch (err) {
      if (err instanceof VoyagerError) {
        if (err.code === 'RATE_LIMITED') {
          this.breaker.trip('soft', action.breaker, 'HTTP 429');
          this.logger?.warn('Guard: breaker soft-tripped on rate limit', { action: action.breaker });
        } else if (err.code === 'CLOUDFLARE_BLOCKED') {
          this.breaker.trip('soft', action.breaker, 'Cloudflare block');
          this.logger?.warn('Guard: breaker soft-tripped on Cloudflare block', { action: action.breaker });
        }
        // AUTH_REQUIRED == not logged in, not a ban — do not trip.
      }
      throw err;
    }
  }
}
