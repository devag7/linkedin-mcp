import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BudgetTracker } from '../src/safety/budgets.js';

/**
 * Deterministic, offline tests for the BudgetTracker.
 * A mutable `now` variable drives the injected clock so we never touch
 * the real wall clock, and a unique tmp dir backs persistence.
 */

const ACCOUNT = 'acct-1';

// 2026-06-13 10:00:00 local time (a Saturday). We keep all assertions on
// local-day boundaries so timezone of the test host does not matter.
const BASE = new Date(2026, 5, 13, 10, 0, 0).getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

let tmp: string;
let storagePath: string;
let now: number;
const clock = (): number => now;

function makeTracker(opts: Record<string, unknown> = {}): BudgetTracker {
  return new BudgetTracker(ACCOUNT, { storagePath, clock, ...opts });
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'budgets-'));
  storagePath = join(tmp, 'nested', 'budgets.json');
  now = BASE;
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('daily cap enforcement', () => {
  it('allows up to the connections cap then blocks', () => {
    const t = makeTracker();
    t.setAccountAgeWeek(4); // full caps, no warmup gating

    for (let i = 0; i < 20; i++) {
      const c = t.check('connections');
      expect(c.allowed).toBe(true);
      expect(c.remaining).toBe(20 - i);
      t.record('connections');
    }

    const blocked = t.check('connections');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.reason).toContain('daily cap reached for connections');
  });

  it('treats likes + comments as one combined pool of 50', () => {
    const t = makeTracker();
    t.setAccountAgeWeek(4);

    for (let i = 0; i < 30; i++) t.record('likes');
    for (let i = 0; i < 20; i++) t.record('comments');

    // 30 + 20 = 50 -> pool exhausted for BOTH action types.
    expect(t.check('likes').allowed).toBe(false);
    const c = t.check('comments');
    expect(c.allowed).toBe(false);
    expect(c.reason).toContain('likes+comments');
  });

  it('enforces read caps (searches = 30/day)', () => {
    const t = makeTracker();
    t.setAccountAgeWeek(4);
    for (let i = 0; i < 30; i++) t.record('searches');
    const c = t.check('searches');
    expect(c.allowed).toBe(false);
    expect(c.remaining).toBe(0);
  });
});

describe('reset on a new local day', () => {
  it('clears daily counters when the day rolls over', () => {
    // Disable the acceptance-rate gate (it is rolling, not daily) so this
    // test isolates the daily-counter reset behaviour.
    const t = makeTracker({ acceptanceRateMinSample: 1000 });
    t.setAccountAgeWeek(4);

    for (let i = 0; i < 20; i++) t.record('connections');
    expect(t.check('connections').allowed).toBe(false);

    // Advance one full day -> new local day -> daily counters reset.
    now = BASE + DAY_MS;
    const c = t.check('connections');
    expect(c.allowed).toBe(true);
    expect(c.remaining).toBe(20);
  });

  it('does NOT reset within the same local day', () => {
    // Use profile-views so the assertion is unambiguously about the daily
    // cap (no acceptance-rate / pending-invite gate in play).
    const t = makeTracker();
    t.setAccountAgeWeek(4);
    for (let i = 0; i < 80; i++) t.record('profile-views');
    expect(t.check('profile-views').allowed).toBe(false);

    now = BASE + 3 * 60 * 60 * 1000; // +3h, same day
    expect(t.check('profile-views').allowed).toBe(false);
  });
});

describe('warmup ramp gating', () => {
  it('caps week-1 connects at 5 and messages at 0', () => {
    const t = makeTracker();
    t.setAccountAgeWeek(1);

    for (let i = 0; i < 5; i++) {
      expect(t.check('connections').allowed).toBe(true);
      t.record('connections');
    }
    const connBlocked = t.check('connections');
    expect(connBlocked.allowed).toBe(false);
    expect(connBlocked.reason).toContain('warmup');

    // Messages are 0 in week 1.
    const msg = t.check('messages');
    expect(msg.allowed).toBe(false);
    expect(msg.remaining).toBe(0);
  });

  it('caps week-2 connects at 10 and allows 10 messages', () => {
    const t = makeTracker();
    t.setAccountAgeWeek(2);

    expect(t.check('connections').remaining).toBe(10);
    expect(t.check('messages').remaining).toBe(10);
  });

  it('week-3 views cap at 50, week-4+ restores full 80', () => {
    const t3 = makeTracker();
    t3.setAccountAgeWeek(3);
    expect(t3.check('profile-views').remaining).toBe(50);

    const t4 = new BudgetTracker('acct-week4', { storagePath, clock });
    t4.setAccountAgeWeek(4);
    expect(t4.check('profile-views').remaining).toBe(80);
  });
});

describe('combined write cap', () => {
  it('blocks all writes once 150 combined writes are reached', () => {
    const t = makeTracker({ dailyCaps: { connections: 1000, follows: 1000 } });
    t.setAccountAgeWeek(4);

    // 100 connections + 50 follows = 150 combined writes.
    for (let i = 0; i < 100; i++) t.record('connections');
    for (let i = 0; i < 50; i++) t.record('follows');

    const c = t.check('follows');
    expect(c.allowed).toBe(false);
    expect(c.reason).toContain('combined daily write cap');

    // Reads remain unaffected by the write cap.
    expect(t.check('searches').allowed).toBe(true);
  });
});

describe('pending-invite ceiling and acceptance-rate pause', () => {
  it('pauses connects when pending invites exceed the ceiling', () => {
    const t = makeTracker({ pendingInviteCeiling: 2 });
    t.setAccountAgeWeek(4);

    t.record('connections'); // pending 1
    t.record('connections'); // pending 2
    expect(t.check('connections').allowed).toBe(true); // 2 is not > 2
    t.record('connections'); // pending 3 -> exceeds ceiling

    const c = t.check('connections');
    expect(c.allowed).toBe(false);
    expect(c.reason).toContain('pending invites');
  });

  it('pauses connects when rolling acceptance rate is below the floor', () => {
    const t = makeTracker({
      acceptanceRateMinSample: 5,
      pendingInviteCeiling: 10_000,
      dailyCaps: { connections: 10_000 },
      combinedWriteCap: 1_000_000,
    });
    t.setAccountAgeWeek(4);

    // Send 5 invites, accept 0 -> 0% < 20% floor.
    for (let i = 0; i < 5; i++) t.record('connections');
    const blocked = t.check('connections');
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('acceptance rate');

    // Accept enough to clear the floor (2/5 = 40%).
    t.recordInviteAccepted(2);
    expect(t.check('connections').allowed).toBe(true);
  });
});

describe('monthly commercial-use search budget', () => {
  it('blocks free accounts after 250 monthly searches even across days', () => {
    const t = makeTracker({ dailyCaps: { searches: 1000 } });
    t.setAccountAgeWeek(4);

    // 250 searches spread across multiple days within the same month.
    for (let d = 0; d < 5; d++) {
      now = BASE + d * DAY_MS;
      for (let i = 0; i < 50; i++) t.record('searches');
    }
    const c = t.check('searches');
    expect(c.allowed).toBe(false);
    expect(c.reason).toContain('monthly commercial-use search budget');
  });

  it('does not apply the monthly cap for paid accounts', () => {
    const t = makeTracker({ dailyCaps: { searches: 1000 }, freeAccount: false });
    t.setAccountAgeWeek(4);
    for (let d = 0; d < 6; d++) {
      now = BASE + d * DAY_MS;
      for (let i = 0; i < 50; i++) t.record('searches');
    }
    expect(t.check('searches').allowed).toBe(true);
  });
});

describe('persistence round-trip', () => {
  it('persists counters to disk and reloads them in a new instance', () => {
    const t1 = makeTracker();
    t1.setAccountAgeWeek(4);
    for (let i = 0; i < 7; i++) t1.record('connections');

    expect(existsSync(storagePath)).toBe(true);

    // New instance, same path -> sees the prior counts.
    const t2 = makeTracker();
    const c = t2.check('connections');
    expect(c.remaining).toBe(20 - 7);

    // Age week and pending invites survived too.
    expect(t2.getPendingInvites()).toBe(7);
  });

  it('writes the file with 0600 permissions', () => {
    const t = makeTracker();
    t.record('likes');
    const mode = statSync(storagePath).mode & 0o777;
    expect(mode).toBe(0o600);

    // Sanity: the JSON is well-formed and keyed by account id.
    const parsed = JSON.parse(readFileSync(storagePath, 'utf8'));
    expect(parsed.accounts[ACCOUNT]).toBeDefined();
  });
});
