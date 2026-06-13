import { describe, it, expect } from 'vitest';
import {
  HumanPacer,
  createPrng,
  type HumanPacerOptions,
  type WorkingHoursConfig,
} from '../src/safety/pacer.js';

const ONE_MINUTE = 60_000;
const ONE_HOUR = 3_600_000;

/**
 * Deterministic test harness: a virtual clock advanced by a recording sleep,
 * plus a scriptable rng. Nothing here touches the wall clock or Math.random,
 * so every assertion is reproducible and offline.
 */
function makeHarness(rngValues: number[], startMs = 0) {
  let now = startMs;
  const slept: number[] = [];

  const clock = () => now;
  const sleep = async (ms: number) => {
    slept.push(ms);
    now += ms; // advance virtual time so working-hours gating can progress
  };

  // Cycle through scripted rng values; falls back to a fixed PRNG if exhausted.
  const fallback = createPrng(123);
  let idx = 0;
  const rng = () => {
    if (idx < rngValues.length) {
      const v = rngValues[idx]!;
      idx += 1;
      return v;
    }
    return fallback();
  };

  return {
    clock,
    sleep,
    rng,
    slept,
    setNow: (ms: number) => {
      now = ms;
    },
    getNow: () => now,
  };
}

/** Build a UTC working-hours config (offset 0) so dates map cleanly. */
function workingHours(overrides: Partial<WorkingHoursConfig> = {}): WorkingHoursConfig {
  return {
    enabled: true,
    startHour: 8,
    endHour: 18,
    lunchStartHour: 12,
    lunchEndHour: 13,
    closedDays: [0, 6],
    utcOffsetMinutes: 0,
    ...overrides,
  };
}

/** A weekday inside the allowed window: Wed 2025-06-11 10:00:00 UTC. */
const WEDNESDAY_10AM = Date.UTC(2025, 5, 11, 10, 0, 0);
/** Same Wednesday but during lunch: 12:30 UTC. */
const WEDNESDAY_LUNCH = Date.UTC(2025, 5, 11, 12, 30, 0);
/** Same Wednesday but after hours: 20:00 UTC. */
const WEDNESDAY_8PM = Date.UTC(2025, 5, 11, 20, 0, 0);
/** A weekend: Saturday 2025-06-14 10:00:00 UTC. */
const SATURDAY_10AM = Date.UTC(2025, 5, 14, 10, 0, 0);

describe('HumanPacer base delays', () => {
  it('produces read delays within the 4000-12000ms band', async () => {
    // rng order per read cycle: [base uniform, gaussian u1, gaussian u2]
    // Use a mid base and zero-ish wobble so result stays in band.
    const h = makeHarness([0.5, 0.5, 0.0]);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: h.rng,
      workingHours: workingHours({ enabled: false }),
    });

    const res = await pacer.waitBefore('read');

    expect(res.baseDelayMs).toBeGreaterThanOrEqual(4_000);
    expect(res.baseDelayMs).toBeLessThanOrEqual(12_000);
    expect(res.workingHoursWaitMs).toBe(0);
    // The first slept value is the base read delay.
    expect(h.slept[0]).toBe(res.baseDelayMs);
  });

  it('produces write delays within the 45000-150000ms band', async () => {
    const h = makeHarness([0.5, 0.5, 0.0]);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: h.rng,
      workingHours: workingHours({ enabled: false }),
    });

    const res = await pacer.waitBefore('write');

    expect(res.baseDelayMs).toBeGreaterThanOrEqual(45_000);
    expect(res.baseDelayMs).toBeLessThanOrEqual(150_000);
  });

  it('clamps write delays to the 30000ms hard floor', () => {
    // Tiny configured band well below the floor; even with min uniform the
    // result must be lifted to the floor.
    const h = makeHarness([0.0, 0.5, 0.0]);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: h.rng,
      writeDelay: { minMs: 1_000, maxMs: 2_000 },
      writeFloorMs: 30_000,
      workingHours: workingHours({ enabled: false }),
    });

    expect(pacer.computeBaseDelay('write')).toBe(30_000);
  });

  it('keeps read delays at or above the band minimum despite negative wobble', () => {
    // gaussian u2 near 0.5 -> cos(pi) = -1 -> maximally negative wobble.
    const h = makeHarness([0.0, 0.99, 0.5]);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: h.rng,
      workingHours: workingHours({ enabled: false }),
    });

    expect(pacer.computeBaseDelay('read')).toBeGreaterThanOrEqual(4_000);
  });

  it('reads are paced faster than writes for the same rng draws', () => {
    const optsBase: HumanPacerOptions = {
      workingHours: workingHours({ enabled: false }),
    };
    const hr = makeHarness([0.5, 0.5, 0.0]);
    const hw = makeHarness([0.5, 0.5, 0.0]);
    const readPacer = new HumanPacer({ ...optsBase, clock: hr.clock, sleep: hr.sleep, rng: hr.rng });
    const writePacer = new HumanPacer({ ...optsBase, clock: hw.clock, sleep: hw.sleep, rng: hw.rng });

    expect(readPacer.computeBaseDelay('read')).toBeLessThan(
      writePacer.computeBaseDelay('write'),
    );
  });
});

describe('HumanPacer long-break cadence', () => {
  it('inserts a short break exactly when the action counter hits the threshold', async () => {
    // Force a deterministic threshold of exactly 3 short-break actions.
    // pickThreshold uses one rng draw: everyMin + round(rng*(max-min)).
    // With everyMin=everyMax=3 the span is 0 so any rng works.
    const h = makeHarness([]);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: () => 0.5, // deterministic mid value for every draw
      readDelay: { minMs: 1_000, maxMs: 1_000 },
      shortBreak: { everyMin: 3, everyMax: 3, pauseMinMs: 120_000, pauseMaxMs: 120_000 },
      longBreak: { everyMin: 999, everyMax: 999, pauseMinMs: 0, pauseMaxMs: 0 },
      workingHours: workingHours({ enabled: false }),
    });

    const r1 = await pacer.waitBefore('read');
    const r2 = await pacer.waitBefore('read');
    const r3 = await pacer.waitBefore('read');

    expect(r1.shortBreakMs).toBe(0);
    expect(r2.shortBreakMs).toBe(0);
    // Third action crosses the threshold -> short break fires.
    expect(r3.shortBreakMs).toBe(120_000);
    expect(r3.longBreakMs).toBe(0);
    expect(r3.totalMs).toBe(r3.baseDelayMs + 120_000);
  });

  it('inserts a long idle on the long-break cadence and re-arms thresholds', async () => {
    const h = makeHarness([]);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: () => 0.5,
      readDelay: { minMs: 1_000, maxMs: 1_000 },
      // Never trip a short break in this window.
      shortBreak: { everyMin: 100, everyMax: 100, pauseMinMs: 60_000, pauseMaxMs: 60_000 },
      longBreak: { everyMin: 2, everyMax: 2, pauseMinMs: 900_000, pauseMaxMs: 900_000 },
      workingHours: workingHours({ enabled: false }),
    });

    const r1 = await pacer.waitBefore('read');
    const r2 = await pacer.waitBefore('read');

    expect(r1.longBreakMs).toBe(0);
    expect(r2.longBreakMs).toBe(900_000);
    expect(pacer.getActionCount()).toBe(2);

    // After the long idle, the next long break should be ~2 actions out again.
    const r3 = await pacer.waitBefore('read');
    const r4 = await pacer.waitBefore('read');
    expect(r3.longBreakMs).toBe(0);
    expect(r4.longBreakMs).toBe(900_000);
  });

  it('uses break durations inside the configured min/max band', async () => {
    const h = makeHarness([]);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: () => 0.5, // midpoint -> duration is exactly the band midpoint
      readDelay: { minMs: 1_000, maxMs: 1_000 },
      shortBreak: { everyMin: 1, everyMax: 1, pauseMinMs: 2 * ONE_MINUTE, pauseMaxMs: 8 * ONE_MINUTE },
      longBreak: { everyMin: 999, everyMax: 999, pauseMinMs: 0, pauseMaxMs: 0 },
      workingHours: workingHours({ enabled: false }),
    });

    const r1 = await pacer.waitBefore('read');
    // Midpoint of [2min, 8min] is 5min.
    expect(r1.shortBreakMs).toBe(5 * ONE_MINUTE);
    expect(r1.shortBreakMs).toBeGreaterThanOrEqual(2 * ONE_MINUTE);
    expect(r1.shortBreakMs).toBeLessThanOrEqual(8 * ONE_MINUTE);
  });
});

describe('HumanPacer working-hours gate', () => {
  it('does not gate reads even outside working hours', async () => {
    const h = makeHarness([0.5, 0.5, 0.0], WEDNESDAY_8PM);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: h.rng,
      workingHours: workingHours(),
    });

    const res = await pacer.waitBefore('read');
    expect(res.workingHoursWaitMs).toBe(0);
  });

  it('allows writes immediately inside the window', async () => {
    const h = makeHarness([0.5, 0.5, 0.0], WEDNESDAY_10AM);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: h.rng,
      workingHours: workingHours(),
    });

    expect(pacer.isWithinWorkingHours(WEDNESDAY_10AM)).toBe(true);
    const res = await pacer.waitBefore('write');
    expect(res.workingHoursWaitMs).toBe(0);
  });

  it('makes writes wait until the window opens when after hours', async () => {
    const h = makeHarness([0.5, 0.5, 0.0], WEDNESDAY_8PM);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: h.rng,
      workingHours: workingHours(),
    });

    expect(pacer.isWithinWorkingHours(WEDNESDAY_8PM)).toBe(false);

    const res = await pacer.waitBefore('write');

    // From Wed 20:00 the next open hour is Thu 08:00 -> 12 hours.
    expect(res.workingHoursWaitMs).toBe(12 * ONE_HOUR);
    // The virtual clock advanced past the wait, so we are now in-window.
    expect(pacer.isWithinWorkingHours(h.getNow())).toBe(true);
  });

  it('treats the lunch hour as closed and waits past it', () => {
    const h = makeHarness([], WEDNESDAY_LUNCH);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: () => 0.5,
      workingHours: workingHours(),
    });

    expect(pacer.isWithinWorkingHours(WEDNESDAY_LUNCH)).toBe(false);
    // From 12:30 the next window opens at 13:00 -> 30 minutes.
    expect(pacer.msUntilNextWindow(WEDNESDAY_LUNCH)).toBe(30 * ONE_MINUTE);
  });

  it('treats weekends as closed and waits to Monday', () => {
    const h = makeHarness([], SATURDAY_10AM);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: () => 0.5,
      workingHours: workingHours(),
    });

    expect(pacer.isWithinWorkingHours(SATURDAY_10AM)).toBe(false);
    // Sat 10:00 -> Mon 08:00 = 46 hours.
    expect(pacer.msUntilNextWindow(SATURDAY_10AM)).toBe(46 * ONE_HOUR);
  });

  it('respects a non-zero utc offset when computing the gate', () => {
    // Offset +60 min: an instant that is 07:30 UTC becomes 08:30 local (open).
    const utc0730 = Date.UTC(2025, 5, 11, 7, 30, 0);
    const h = makeHarness([], utc0730);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: () => 0.5,
      workingHours: workingHours({ utcOffsetMinutes: 60 }),
    });

    expect(pacer.isWithinWorkingHours(utc0730)).toBe(true);
  });

  it('skips the gate entirely when working hours are disabled', async () => {
    const h = makeHarness([0.5, 0.5, 0.0], WEDNESDAY_8PM);
    const pacer = new HumanPacer({
      clock: h.clock,
      sleep: h.sleep,
      rng: h.rng,
      workingHours: workingHours({ enabled: false }),
    });

    const res = await pacer.waitBefore('write');
    expect(res.workingHoursWaitMs).toBe(0);
  });
});

describe('HumanPacer determinism', () => {
  it('produces identical delay sequences for identical seeds', () => {
    const mk = () =>
      new HumanPacer({
        rng: createPrng(42),
        workingHours: workingHours({ enabled: false }),
      });
    const a = mk();
    const b = mk();
    for (let i = 0; i < 5; i += 1) {
      expect(a.computeBaseDelay('write')).toBe(b.computeBaseDelay('write'));
    }
  });
});
