/**
 * SerialQueue — a concurrency-bounded async task runner.
 *
 * Runs async tasks in strict FIFO order with a configurable concurrency
 * (default 1, i.e. fully serial). Each enqueued task returns a promise that
 * settles with that task's result or rejection. A single task's rejection is
 * isolated: it never breaks the queue or prevents subsequent tasks from
 * running. Supports `drain()` (await until idle), `clear()` (drop pending,
 * not-yet-started tasks), and a `size` getter.
 *
 * Pure logic: no network, no browser, no timers. Deterministic and offline
 * unit-testable.
 */

import type { Logger } from '../types.js';

/** A unit of asynchronous work scheduled on the queue. */
export type QueueTask<T> = () => Promise<T> | T;

/** Construction options for {@link SerialQueue}. */
export interface SerialQueueOptions {
  /** Maximum number of tasks allowed to run at once. Must be >= 1. Default 1. */
  readonly concurrency?: number;
  /** Optional logger for diagnostics. Never used for control flow. */
  readonly logger?: Logger;
}

/** Internal record pairing a task with its external promise settlers. */
interface PendingEntry<T> {
  readonly task: QueueTask<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
}

/**
 * Error used to reject pending tasks dropped by {@link SerialQueue.clear}.
 */
export class QueueClearedError extends Error {
  constructor(message = 'Task was cleared from the queue before it started.') {
    super(message);
    this.name = 'QueueClearedError';
  }
}

/**
 * A FIFO async task queue with bounded concurrency.
 *
 * @typeParam never — tasks are individually typed at `enqueue` call sites.
 */
export class SerialQueue {
  private readonly concurrency: number;
  private readonly logger?: Logger;

  /** Tasks waiting to start, in FIFO order. */
  private readonly pending: Array<PendingEntry<unknown>> = [];

  /** Number of tasks currently executing. */
  private running = 0;

  /** Resolvers waiting on {@link drain} to complete. */
  private drainWaiters: Array<() => void> = [];

  constructor(options: SerialQueueOptions = {}) {
    const concurrency = options.concurrency ?? 1;
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new RangeError(
        `SerialQueue concurrency must be an integer >= 1, got ${String(concurrency)}`,
      );
    }
    this.concurrency = concurrency;
    this.logger = options.logger;
  }

  /**
   * Number of tasks not yet completed: those waiting plus those running.
   */
  get size(): number {
    return this.pending.length + this.running;
  }

  /** Number of tasks waiting to start (not yet running). */
  get pendingCount(): number {
    return this.pending.length;
  }

  /** Number of tasks currently executing. */
  get activeCount(): number {
    return this.running;
  }

  /**
   * Schedule a task to run on the queue. Returns a promise that settles with
   * the task's result, or rejects with its error / a {@link QueueClearedError}
   * if it is removed by {@link clear} before starting.
   *
   * A task's rejection is isolated: it never affects other tasks or the queue.
   */
  enqueue<T>(task: QueueTask<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const entry: PendingEntry<T> = { task, resolve, reject };
      // Store as `unknown` internally; types are preserved at the boundary.
      this.pending.push(entry as PendingEntry<unknown>);
      this.logger?.debug('SerialQueue: task enqueued', {
        pending: this.pending.length,
        running: this.running,
      });
      this.pump();
    });
  }

  /**
   * Drop every pending (not-yet-started) task, rejecting each with a
   * {@link QueueClearedError}. Tasks already running are NOT cancelled — they
   * run to completion. Returns the number of tasks dropped.
   */
  clear(reason?: unknown): number {
    const dropped = this.pending.splice(0, this.pending.length);
    for (const entry of dropped) {
      entry.reject(reason ?? new QueueClearedError());
    }
    if (dropped.length > 0) {
      this.logger?.debug('SerialQueue: cleared pending tasks', {
        dropped: dropped.length,
      });
    }
    // Clearing may bring the queue to idle (no pending, none running).
    this.maybeNotifyDrained();
    return dropped.length;
  }

  /**
   * Resolve once the queue is fully idle — no pending and no running tasks.
   * Resolves immediately if already idle. Multiple concurrent callers are all
   * notified. Does not reject.
   */
  drain(): Promise<void> {
    if (this.size === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.drainWaiters.push(resolve);
    });
  }

  /**
   * Start as many pending tasks as concurrency permits, preserving FIFO order.
   */
  private pump(): void {
    while (this.running < this.concurrency && this.pending.length > 0) {
      const entry = this.pending.shift();
      if (entry === undefined) {
        break;
      }
      this.run(entry);
    }
  }

  /**
   * Execute a single task, isolating any synchronous throw or async rejection,
   * then advance the queue.
   */
  private run(entry: PendingEntry<unknown>): void {
    this.running += 1;
    // Wrap synchronously so a thrown error in the task factory is captured.
    void (async (): Promise<void> => {
      try {
        const result = await entry.task();
        entry.resolve(result);
      } catch (error: unknown) {
        // Isolation: a task failure must never break the queue.
        this.logger?.debug('SerialQueue: task rejected (isolated)', {
          error: error instanceof Error ? error.message : String(error),
        });
        entry.reject(error);
      } finally {
        this.running -= 1;
        // Schedule next work, then settle drain waiters if idle.
        this.pump();
        this.maybeNotifyDrained();
      }
    })();
  }

  /** Notify and clear drain waiters if the queue has reached idle. */
  private maybeNotifyDrained(): void {
    if (this.size > 0) {
      return;
    }
    if (this.drainWaiters.length === 0) {
      return;
    }
    const waiters = this.drainWaiters;
    this.drainWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }
}
