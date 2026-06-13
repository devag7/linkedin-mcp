/**
 * Human Pacer
 *
 * Inserts human-like delays between LinkedIn actions to avoid bot detection.
 *
 * Responsibilities:
 *  - Jittered per-action delays (reads vs writes) per the locked NUMERIC POLICY.
 *  - An action counter that triggers periodic "long breaks" and "idle" pauses.
 *  - A working-hours gate that makes writes wait/queue until an allowed window.
 *
 * Everything that touches time or randomness is injected via constructor
 * options (`clock`, `sleep`, `rng`) so the module is fully deterministic and
 * offline-testable. Core decision logic NEVER reads the system clock or the
 * global RNG directly — it always goes through the injected functions.
 *
 * Self-contained: depends only on node builtins and the (optional) Logger type.
 */

import type { Logger } from '../types.js';

/** Kind of action being paced. */
export type ActionType = 'read' | 'write';

/** Returns the current time as epoch milliseconds. */
export type ClockFn = () => number;

/** Resolves after roughly `ms` milliseconds. */
export type SleepFn = (ms: number) => Promise<void>;

/** Returns a pseudo-random float in the half-open interval [0, 1). */
export type RngFn = () => number;

/** Inclusive-min / inclusive-max millisecond delay band. */
export interface DelayBand {
  /** Lower bound of the base delay, in milliseconds. */
  minMs: number;
  /** Upper bound of the base delay, in milliseconds. */
  maxMs: number;
}

/** A "take a break every N actions for D time" rule. */
export interface BreakRule {
  /** Lower bound (inclusive) of actions between breaks. */
  everyMin: number;
  /** Upper bound (inclusive) of actions between breaks. */
  everyMax: number;
  /** Lower bound (inclusive) of the pause duration, in milliseconds. */
  pauseMinMs: number;
  /** Upper bound (inclusive) of the pause duration, in milliseconds. */
  pauseMaxMs: number;
}

/** Local-time working-hours gate for writes. */
export interface WorkingHoursConfig {
  /** Enable the gate. When false, writes are never delayed for hours. */
  enabled: boolean;
  /** First allowed local hour (0-23), inclusive. */
  startHour: number;
  /** End local hour (0-23), exclusive. */
  endHour: number;
  /** Local hour at which the lunch pause begins (0-23), inclusive. */
  lunchStartHour: number;
  /** Local hour at which the lunch pause ends (0-23), exclusive. */
  lunchEndHour: number;
  /** Day-of-week numbers (0 = Sunday .. 6 = Saturday) on which writes pause entirely. */
  closedDays: number[];
  /**
   * Local time zone offset, in minutes ahead of UTC (e.g. -300 for US Eastern
   * standard time). Injected so tests are independent of the host time zone.
   */
  utcOffsetMinutes: number;
}

/** Construction options for {@link HumanPacer}. All timing knobs are configurable. */
export interface HumanPacerOptions {
  /** Base delay band for reads. Default 4000-12000ms. */
  readDelay?: DelayBand;
  /** Base delay band for writes. Default 45000-150000ms. */
  writeDelay?: DelayBand;
  /** Hard floor applied to write delays after jitter. Default 30000ms. */
  writeFloorMs?: number;
  /** Fraction of the base delay used as the gaussian wobble sigma. Default 0.15. */
  jitterFraction?: number;
  /** Short-break rule (every 8-15 actions -> 2-8 min). */
  shortBreak?: BreakRule;
  /** Long-idle rule (every 40-60 actions -> 15-45 min). */
  longBreak?: BreakRule;
  /** Working-hours gate for writes. */
  workingHours?: WorkingHoursConfig;
  /** Epoch-millisecond clock. Defaults to `Date.now`. */
  clock?: ClockFn;
  /** Sleep function. Defaults to a `setTimeout` wrapper. */
  sleep?: SleepFn;
  /** Random source in [0,1). Defaults to a deterministic-seedable PRNG. */
  rng?: RngFn;
  /** Optional logger. */
  logger?: Logger;
}

/** Result describing a single `waitBefore` cycle (useful for tests / telemetry). */
export interface PaceResult {
  /** The base jittered delay applied for the action itself, in ms. */
  baseDelayMs: number;
  /** Extra ms spent in a short break, if one fired this cycle. */
  shortBreakMs: number;
  /** Extra ms spent in a long idle, if one fired this cycle. */
  longBreakMs: number;
  /** Extra ms spent waiting for the working-hours window (writes only). */
  workingHoursWaitMs: number;
  /** Total ms slept this cycle (sum of the above). */
  totalMs: number;
  /** The action counter value after this action. */
  actionCount: number;
}

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 86_400_000;

const DEFAULT_READ_DELAY: DelayBand = { minMs: 4_000, maxMs: 12_000 };
const DEFAULT_WRITE_DELAY: DelayBand = { minMs: 45_000, maxMs: 150_000 };
const DEFAULT_WRITE_FLOOR_MS = 30_000;
const DEFAULT_JITTER_FRACTION = 0.15;

const DEFAULT_SHORT_BREAK: BreakRule = {
  everyMin: 8,
  everyMax: 15,
  pauseMinMs: 2 * ONE_MINUTE_MS,
  pauseMaxMs: 8 * ONE_MINUTE_MS,
};

const DEFAULT_LONG_BREAK: BreakRule = {
  everyMin: 40,
  everyMax: 60,
  pauseMinMs: 15 * ONE_MINUTE_MS,
  pauseMaxMs: 45 * ONE_MINUTE_MS,
};

const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  enabled: true,
  startHour: 8,
  endHour: 18,
  lunchStartHour: 12,
  lunchEndHour: 13,
  closedDays: [0, 6], // Sunday + Saturday
  utcOffsetMinutes: 0,
};

/**
 * Build a small deterministic PRNG (mulberry32). Returned function yields
 * floats in [0, 1). Used as the default RNG so behaviour is reproducible
 * without ever touching `Math.random`.
 */
export function createPrng(seed = 0x9e3779b9): RngFn {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Default sleep: a thin wrapper over `setTimeout`. */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Paces LinkedIn actions to look human.
 *
 * Usage:
 * ```ts
 * const pacer = new HumanPacer();
 * await pacer.waitBefore('write'); // resolves after a jittered, gated delay
 * ```
 */
export class HumanPacer {
  private readonly readDelay: DelayBand;
  private readonly writeDelay: DelayBand;
  private readonly writeFloorMs: number;
  private readonly jitterFraction: number;
  private readonly shortBreak: BreakRule;
  private readonly longBreak: BreakRule;
  private readonly workingHours: WorkingHoursConfig;

  private readonly clock: ClockFn;
  private readonly sleep: SleepFn;
  private readonly rng: RngFn;
  private readonly logger: Logger | undefined;

  /** Total actions paced since construction. */
  private actionCount = 0;
  /** Action count at which the next short break should fire. */
  private nextShortBreakAt: number;
  /** Action count at which the next long idle should fire. */
  private nextLongBreakAt: number;

  constructor(options: HumanPacerOptions = {}) {
    this.readDelay = options.readDelay ?? DEFAULT_READ_DELAY;
    this.writeDelay = options.writeDelay ?? DEFAULT_WRITE_DELAY;
    this.writeFloorMs = options.writeFloorMs ?? DEFAULT_WRITE_FLOOR_MS;
    this.jitterFraction = options.jitterFraction ?? DEFAULT_JITTER_FRACTION;
    this.shortBreak = options.shortBreak ?? DEFAULT_SHORT_BREAK;
    this.longBreak = options.longBreak ?? DEFAULT_LONG_BREAK;
    this.workingHours = options.workingHours ?? DEFAULT_WORKING_HOURS;

    this.clock = options.clock ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
    this.rng = options.rng ?? createPrng();
    this.logger = options.logger;

    this.nextShortBreakAt = this.pickThreshold(this.shortBreak);
    this.nextLongBreakAt = this.pickThreshold(this.longBreak);
  }

  /**
   * Wait the appropriate human-like amount of time before performing an action.
   *
   * Order of operations:
   *  1. For writes, block until inside an allowed working-hours window.
   *  2. Sleep the jittered base delay for the action type.
   *  3. Increment the action counter and, if a break/idle threshold is hit,
   *     sleep an additional pause.
   *
   * Resolves with a {@link PaceResult} describing the time spent (handy for
   * deterministic assertions in tests).
   */
  async waitBefore(actionType: ActionType): Promise<PaceResult> {
    let workingHoursWaitMs = 0;
    if (actionType === 'write') {
      workingHoursWaitMs = await this.gateForWorkingHours();
    }

    const baseDelayMs = this.computeBaseDelay(actionType);
    await this.sleep(baseDelayMs);

    this.actionCount += 1;

    const { shortBreakMs, longBreakMs } = await this.maybeBreak();

    const totalMs = workingHoursWaitMs + baseDelayMs + shortBreakMs + longBreakMs;
    this.logger?.debug('pacer.waitBefore', {
      actionType,
      actionCount: this.actionCount,
      baseDelayMs,
      workingHoursWaitMs,
      shortBreakMs,
      longBreakMs,
      totalMs,
    });

    return {
      baseDelayMs,
      shortBreakMs,
      longBreakMs,
      workingHoursWaitMs,
      totalMs,
      actionCount: this.actionCount,
    };
  }

  /** Current number of actions paced since construction. */
  getActionCount(): number {
    return this.actionCount;
  }

  /**
   * Compute the jittered base delay for an action without sleeping.
   * Exposed (and deterministic given the injected rng) so it can be unit-tested
   * and reused by callers that want to schedule rather than block.
   *
   * delay = min + rand*(max-min) + gaussianWobble(~jitterFraction of base)
   * Writes are additionally clamped to the configured hard floor.
   */
  computeBaseDelay(actionType: ActionType): number {
    const band = actionType === 'write' ? this.writeDelay : this.readDelay;
    const span = Math.max(0, band.maxMs - band.minMs);
    const base = band.minMs + this.rng() * span;

    // ~15% gaussian wobble derived from the injected rng (Box-Muller).
    const sigma = base * this.jitterFraction;
    const wobble = this.gaussian() * sigma;

    let delay = base + wobble;

    // Never go below the band minimum; clamp writes to the hard floor.
    delay = Math.max(band.minMs, delay);
    if (actionType === 'write') {
      delay = Math.max(this.writeFloorMs, delay);
    }

    return Math.round(delay);
  }

  /**
   * Returns true when `nowMs` (epoch ms) falls inside an allowed write window
   * for the configured working hours. Pure function of its argument + config.
   */
  isWithinWorkingHours(nowMs: number): boolean {
    if (!this.workingHours.enabled) return true;

    const local = this.toLocal(nowMs);
    if (this.workingHours.closedDays.includes(local.day)) return false;

    const hour = local.hour;
    if (hour < this.workingHours.startHour || hour >= this.workingHours.endHour) {
      return false;
    }
    if (hour >= this.workingHours.lunchStartHour && hour < this.workingHours.lunchEndHour) {
      return false;
    }
    return true;
  }

  /**
   * Milliseconds from `nowMs` until the next allowed write window opens.
   * Returns 0 when already inside a window. Walks forward hour-by-hour, which
   * is cheap and avoids fragile calendar math.
   */
  msUntilNextWindow(nowMs: number): number {
    if (this.isWithinWorkingHours(nowMs)) return 0;

    const local = this.toLocal(nowMs);
    // Snap to the start of the next whole local hour, then scan forward.
    const msIntoHour =
      local.minute * ONE_MINUTE_MS + local.second * 1_000 + local.millis;
    let cursor = nowMs - msIntoHour + ONE_HOUR_MS;

    // Bounded scan: at most ~10 days of hours so we never spin forever.
    const maxSteps = 24 * 10;
    for (let i = 0; i < maxSteps; i += 1) {
      if (this.isWithinWorkingHours(cursor)) {
        return cursor - nowMs;
      }
      cursor += ONE_HOUR_MS;
    }
    // Fallback (should be unreachable with sane config): one day out.
    return ONE_DAY_MS;
  }

  /**
   * Block until inside a working-hours window (writes only). Returns the total
   * milliseconds waited. Loops because the injected clock may advance in tests.
   */
  private async gateForWorkingHours(): Promise<number> {
    if (!this.workingHours.enabled) return 0;

    let waited = 0;
    // Re-check after each sleep; the clock is injected so tests control it.
    // Bounded to avoid an infinite loop if a clock never advances.
    for (let i = 0; i < 64; i += 1) {
      const now = this.clock();
      const wait = this.msUntilNextWindow(now);
      if (wait <= 0) break;
      this.logger?.info('pacer.workingHours.wait', { waitMs: wait });
      await this.sleep(wait);
      waited += wait;
    }
    return waited;
  }

  /**
   * Check the action counter against the break thresholds. If a threshold is
   * crossed, sleep the corresponding pause and re-arm the threshold.
   */
  private async maybeBreak(): Promise<{ shortBreakMs: number; longBreakMs: number }> {
    let shortBreakMs = 0;
    let longBreakMs = 0;

    if (this.actionCount >= this.nextLongBreakAt) {
      longBreakMs = this.pickDuration(this.longBreak);
      this.logger?.info('pacer.longBreak', {
        actionCount: this.actionCount,
        pauseMs: longBreakMs,
      });
      await this.sleep(longBreakMs);
      this.nextLongBreakAt = this.actionCount + this.pickThreshold(this.longBreak);
      // A long idle also satisfies/refreshes the short-break cadence.
      this.nextShortBreakAt = this.actionCount + this.pickThreshold(this.shortBreak);
    } else if (this.actionCount >= this.nextShortBreakAt) {
      shortBreakMs = this.pickDuration(this.shortBreak);
      this.logger?.info('pacer.shortBreak', {
        actionCount: this.actionCount,
        pauseMs: shortBreakMs,
      });
      await this.sleep(shortBreakMs);
      this.nextShortBreakAt = this.actionCount + this.pickThreshold(this.shortBreak);
    }

    return { shortBreakMs, longBreakMs };
  }

  /** Pick an integer threshold in [everyMin, everyMax] using the injected rng. */
  private pickThreshold(rule: BreakRule): number {
    const span = Math.max(0, rule.everyMax - rule.everyMin);
    return rule.everyMin + Math.round(this.rng() * span);
  }

  /** Pick a pause duration in [pauseMinMs, pauseMaxMs] using the injected rng. */
  private pickDuration(rule: BreakRule): number {
    const span = Math.max(0, rule.pauseMaxMs - rule.pauseMinMs);
    return Math.round(rule.pauseMinMs + this.rng() * span);
  }

  /**
   * Standard-normal sample via Box-Muller, drawing from the injected rng.
   * Guards against log(0) by flooring the uniform draw.
   */
  private gaussian(): number {
    const u1 = Math.max(this.rng(), Number.EPSILON);
    const u2 = this.rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Convert epoch ms to local wall-clock components using the configured
   * fixed UTC offset. Avoids `Date#getHours` so results never depend on the
   * host machine's time zone.
   */
  private toLocal(nowMs: number): {
    day: number;
    hour: number;
    minute: number;
    second: number;
    millis: number;
  } {
    const shifted = nowMs + this.workingHours.utcOffsetMinutes * ONE_MINUTE_MS;
    const d = new Date(shifted);
    return {
      day: d.getUTCDay(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      millis: d.getUTCMilliseconds(),
    };
  }
}
