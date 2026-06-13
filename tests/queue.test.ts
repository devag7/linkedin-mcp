/**
 * Tests for SerialQueue — ordering, concurrency=1 serialization,
 * rejection isolation, clear(), drain(), and size accounting.
 *
 * Fully offline and deterministic: no real timers, no network. Timing-sensitive
 * scenarios use manually-controlled deferred promises so that interleaving is
 * driven explicitly rather than by the wall clock.
 */

import { describe, it, expect } from 'vitest';
import { SerialQueue, QueueClearedError } from '../src/safety/queue.js';

/** A promise plus its settlers, for deterministic interleaving control. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flush the microtask queue so queued continuations settle. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('SerialQueue', () => {
  describe('construction', () => {
    it('defaults to concurrency 1', async () => {
      const q = new SerialQueue();
      const order: number[] = [];
      await Promise.all([
        q.enqueue(() => {
          order.push(1);
        }),
        q.enqueue(() => {
          order.push(2);
        }),
      ]);
      expect(order).toEqual([1, 2]);
    });

    it('rejects invalid concurrency', () => {
      expect(() => new SerialQueue({ concurrency: 0 })).toThrow(RangeError);
      expect(() => new SerialQueue({ concurrency: -1 })).toThrow(RangeError);
      expect(() => new SerialQueue({ concurrency: 1.5 })).toThrow(RangeError);
    });
  });

  describe('ordering (FIFO)', () => {
    it('runs tasks in the order enqueued', async () => {
      const q = new SerialQueue();
      const order: number[] = [];
      const results = await Promise.all(
        [0, 1, 2, 3, 4].map((n) =>
          q.enqueue(async () => {
            // Yield to prove ordering is enforced by the queue, not luck.
            await Promise.resolve();
            order.push(n);
            return n * 10;
          }),
        ),
      );
      expect(order).toEqual([0, 1, 2, 3, 4]);
      expect(results).toEqual([0, 10, 20, 30, 40]);
    });

    it('returns each task its own resolved value', async () => {
      const q = new SerialQueue();
      const a = q.enqueue(() => 'a');
      const b = q.enqueue(async () => 'b');
      await expect(a).resolves.toBe('a');
      await expect(b).resolves.toBe('b');
    });
  });

  describe('serialization (concurrency = 1)', () => {
    it('never runs two tasks at once', async () => {
      const q = new SerialQueue({ concurrency: 1 });
      let active = 0;
      let maxActive = 0;
      const gateA = defer<void>();
      const gateB = defer<void>();

      const p1 = q.enqueue(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gateA.promise;
        active -= 1;
      });
      const p2 = q.enqueue(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gateB.promise;
        active -= 1;
      });

      await flush();
      // Only the first task may have started; the second must be waiting.
      expect(q.activeCount).toBe(1);
      expect(q.pendingCount).toBe(1);
      expect(maxActive).toBe(1);

      gateA.resolve();
      await flush();
      // Now the second has started, the first done.
      expect(q.activeCount).toBe(1);
      expect(q.pendingCount).toBe(0);
      expect(maxActive).toBe(1);

      gateB.resolve();
      await Promise.all([p1, p2]);
      expect(maxActive).toBe(1);
      expect(q.size).toBe(0);
    });
  });

  describe('concurrency > 1', () => {
    it('runs up to N tasks at once but no more', async () => {
      const q = new SerialQueue({ concurrency: 2 });
      const gates = [defer<void>(), defer<void>(), defer<void>()];
      let active = 0;
      let maxActive = 0;

      const ps = gates.map((g) =>
        q.enqueue(async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await g.promise;
          active -= 1;
        }),
      );

      await flush();
      expect(q.activeCount).toBe(2);
      expect(q.pendingCount).toBe(1);
      expect(maxActive).toBe(2);

      gates[0].resolve();
      await flush();
      // Third task starts as the first frees a slot.
      expect(q.activeCount).toBe(2);
      expect(q.pendingCount).toBe(0);

      gates[1].resolve();
      gates[2].resolve();
      await Promise.all(ps);
      expect(maxActive).toBe(2);
      expect(q.size).toBe(0);
    });
  });

  describe('rejection isolation', () => {
    it('a rejected task does not break the queue', async () => {
      const q = new SerialQueue();
      const order: string[] = [];

      const failing = q.enqueue(async () => {
        order.push('fail-start');
        throw new Error('boom');
      });
      const after = q.enqueue(async () => {
        order.push('after');
        return 'ok';
      });

      await expect(failing).rejects.toThrow('boom');
      await expect(after).resolves.toBe('ok');
      expect(order).toEqual(['fail-start', 'after']);
      expect(q.size).toBe(0);
    });

    it('isolates a synchronous throw from the task factory', async () => {
      const q = new SerialQueue();
      const failing = q.enqueue(() => {
        throw new Error('sync-boom');
      });
      const after = q.enqueue(() => 42);
      await expect(failing).rejects.toThrow('sync-boom');
      await expect(after).resolves.toBe(42);
    });

    it('continues after multiple consecutive failures', async () => {
      const q = new SerialQueue();
      const results = await Promise.allSettled([
        q.enqueue(() => Promise.reject(new Error('e1'))),
        q.enqueue(() => Promise.reject(new Error('e2'))),
        q.enqueue(() => Promise.resolve('survived')),
      ]);
      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');
      expect(results[2]).toEqual({ status: 'fulfilled', value: 'survived' });
      expect(q.size).toBe(0);
    });
  });

  describe('clear()', () => {
    it('drops pending tasks and rejects them with QueueClearedError', async () => {
      const q = new SerialQueue({ concurrency: 1 });
      const gate = defer<void>();

      const running = q.enqueue(async () => {
        await gate.promise;
        return 'first';
      });
      const dropped1 = q.enqueue(() => 'second');
      const dropped2 = q.enqueue(() => 'third');

      await flush();
      expect(q.activeCount).toBe(1);
      expect(q.pendingCount).toBe(2);

      const count = q.clear();
      expect(count).toBe(2);
      expect(q.pendingCount).toBe(0);

      await expect(dropped1).rejects.toBeInstanceOf(QueueClearedError);
      await expect(dropped2).rejects.toBeInstanceOf(QueueClearedError);

      // The already-running task is unaffected and completes normally.
      gate.resolve();
      await expect(running).resolves.toBe('first');
      expect(q.size).toBe(0);
    });

    it('clear with a custom reason rejects with that reason', async () => {
      const q = new SerialQueue();
      const gate = defer<void>();
      // Occupy the single slot so the next task stays pending.
      const blocker = q.enqueue(() => gate.promise);
      const pendingTask = q.enqueue(() => 'never');
      await flush();

      const reason = new Error('custom');
      q.clear(reason);
      await expect(pendingTask).rejects.toBe(reason);

      gate.resolve();
      await blocker;
    });

    it('returns 0 when there is nothing pending', () => {
      const q = new SerialQueue();
      expect(q.clear()).toBe(0);
    });
  });

  describe('drain()', () => {
    it('resolves immediately when the queue is idle', async () => {
      const q = new SerialQueue();
      await expect(q.drain()).resolves.toBeUndefined();
    });

    it('resolves only after all tasks finish', async () => {
      const q = new SerialQueue({ concurrency: 1 });
      const gate = defer<void>();
      let drained = false;

      q.enqueue(() => gate.promise);
      q.enqueue(() => 'x');

      const drainP = q.drain().then(() => {
        drained = true;
      });

      await flush();
      expect(drained).toBe(false);
      expect(q.size).toBeGreaterThan(0);

      gate.resolve();
      await drainP;
      expect(drained).toBe(true);
      expect(q.size).toBe(0);
    });

    it('notifies multiple concurrent drain waiters', async () => {
      const q = new SerialQueue();
      const gate = defer<void>();
      q.enqueue(() => gate.promise);

      const d1 = q.drain();
      const d2 = q.drain();

      gate.resolve();
      await expect(Promise.all([d1, d2])).resolves.toEqual([undefined, undefined]);
    });

    it('resolves when the queue is emptied via clear()', async () => {
      const q = new SerialQueue({ concurrency: 1 });
      const gate = defer<void>();
      const blocker = q.enqueue(() => gate.promise);
      q.enqueue(() => 'pending');

      // Finish the running task, then clear the remaining pending one.
      gate.resolve();
      await blocker;
      // After the running task settles, one task is still pending.
      const drainP = q.drain();
      q.clear();
      await expect(drainP).resolves.toBeUndefined();
      expect(q.size).toBe(0);
    });
  });

  describe('size accounting', () => {
    it('reflects pending + running and returns to zero', async () => {
      const q = new SerialQueue({ concurrency: 1 });
      const gate = defer<void>();
      expect(q.size).toBe(0);

      const p1 = q.enqueue(() => gate.promise);
      const p2 = q.enqueue(() => 'done');
      expect(q.size).toBe(2);

      await flush();
      expect(q.activeCount).toBe(1);
      expect(q.pendingCount).toBe(1);
      expect(q.size).toBe(2);

      gate.resolve();
      await Promise.all([p1, p2]);
      expect(q.size).toBe(0);
    });
  });
});
