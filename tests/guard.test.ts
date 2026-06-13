/**
 * Integration test for the Guard safety gateway.
 *
 * Uses the real SerialQueue / HumanPacer / BudgetTracker / CircuitBreaker, but
 * configures the pacer for instant, gate-free delays and the budget with a
 * tiny tmp store so the full sequence (breaker pre-check → budget → queue →
 * pace → record → breaker feedback) is exercised offline and fast.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { SerialQueue } from '../src/safety/queue.js';
import { HumanPacer, type WorkingHoursConfig } from '../src/safety/pacer.js';
import { BudgetTracker, type DailyCaps } from '../src/safety/budgets.js';
import { CircuitBreaker } from '../src/safety/circuit-breaker.js';
import { Guard, GuardBlockedError, ACTIONS } from '../src/browser/guard.js';
import { VoyagerError } from '../src/browser/voyager.js';

const NO_HOURS: WorkingHoursConfig = {
  enabled: false,
  startHour: 0,
  endHour: 24,
  lunchStartHour: 0,
  lunchEndHour: 0,
  closedDays: [],
  utcOffsetMinutes: 0,
};

const SMALL_CAPS: DailyCaps = {
  connections: 5,
  messages: 5,
  likesComments: 5,
  follows: 5,
  endorsements: 5,
  eventInvites: 5,
  profileViews: 2,
  searches: 5,
};

const STORE = path.join(os.tmpdir(), 'lkdn-guard-test-budget.json');

function makeGuard(): Guard {
  const queue = new SerialQueue();
  const pacer = new HumanPacer({
    readDelay: { minMs: 0, maxMs: 0 },
    writeDelay: { minMs: 0, maxMs: 0 },
    writeFloorMs: 0,
    sleep: () => Promise.resolve(),
    shortBreak: { everyMin: 1e9, everyMax: 1e9, pauseMinMs: 0, pauseMaxMs: 0 },
    longBreak: { everyMin: 1e9, everyMax: 1e9, pauseMinMs: 0, pauseMaxMs: 0 },
    workingHours: NO_HOURS,
  });
  const budget = new BudgetTracker('test-acct', {
    storagePath: STORE,
    dailyCaps: SMALL_CAPS,
  });
  budget.setAccountAgeWeek(4); // past warmup ramp → full caps apply
  const breaker = new CircuitBreaker();
  return new Guard(queue, pacer, budget, breaker);
}

describe('Guard', () => {
  beforeEach(() => {
    fs.rmSync(STORE, { force: true });
  });

  it('runs the task and returns its result', async () => {
    const guard = makeGuard();
    const result = await guard.run(ACTIONS.getProfile, async () => ({ name: 'Ada' }));
    expect(result).toEqual({ name: 'Ada' });
  });

  it('records budget and refuses once the daily cap is hit', async () => {
    const guard = makeGuard();
    await guard.run(ACTIONS.getProfile, async () => 1); // 1/2
    await guard.run(ACTIONS.getProfile, async () => 2); // 2/2
    await expect(guard.run(ACTIONS.getProfile, async () => 3)).rejects.toMatchObject({
      name: 'GuardBlockedError',
      code: 'BUDGET_EXHAUSTED',
    });
  });

  it('does not consume budget when the task throws', async () => {
    const guard = makeGuard();
    await expect(
      guard.run(ACTIONS.getProfile, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // budget untouched → two more reads still allowed
    await guard.run(ACTIONS.getProfile, async () => 'a');
    await guard.run(ACTIONS.getProfile, async () => 'b');
    await expect(guard.run(ACTIONS.getProfile, async () => 'c')).rejects.toBeInstanceOf(
      GuardBlockedError,
    );
  });

  it('soft-trips the breaker on a rate-limit and blocks further writes of that type', async () => {
    const guard = makeGuard();
    await expect(
      guard.run(ACTIONS.connect, async () => {
        throw new VoyagerError('RATE_LIMITED', 'rate limited', 429);
      }),
    ).rejects.toBeInstanceOf(VoyagerError);

    // Breaker soft-tripped 'connect' → next connect refused pre-flight.
    await expect(guard.run(ACTIONS.connect, async () => 'ok')).rejects.toMatchObject({
      code: 'CIRCUIT_OPEN',
    });
  });
});
