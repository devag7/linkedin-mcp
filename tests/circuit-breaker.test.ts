import { describe, it, expect, beforeEach } from 'vitest';
import {
  CircuitBreaker,
  type CircuitState,
  type CircuitStorage,
} from '../src/safety/circuit-breaker.js';

const HOUR = 60 * 60 * 1000;

/** Deterministic, mutable clock for tests. */
function makeClock(start = 1_000_000_000_000): { now: () => number; advance: (ms: number) => void } {
  let t = start;
  return {
    now: (): number => t,
    advance: (ms: number): void => {
      t += ms;
    },
  };
}

/** In-memory storage that records the last saved state. */
function makeStorage(initial: CircuitState | null = null): CircuitStorage & { saved: CircuitState | null } {
  const store: { saved: CircuitState | null } = { saved: initial };
  return {
    saved: initial,
    load(): CircuitState | null {
      return store.saved;
    },
    save(state: CircuitState): void {
      store.saved = state;
      // expose on the returned object too
      (this as { saved: CircuitState | null }).saved = state;
    },
  };
}

describe('CircuitBreaker.classify', () => {
  let cb: CircuitBreaker;
  beforeEach(() => {
    cb = new CircuitBreaker({ clock: makeClock().now });
  });

  it('classifies HTTP 999 as hard', () => {
    expect(cb.classify({ status: 999 })).toBe('hard');
  });

  it('classifies checkpoint/challenge URL as hard', () => {
    expect(
      cb.classify({ finalUrl: 'https://www.linkedin.com/checkpoint/challenge/AbC123' }),
    ).toBe('hard');
  });

  it('classifies uas/login URL as hard', () => {
    expect(cb.classify({ finalUrl: 'https://www.linkedin.com/uas/login?session_redirect=x' })).toBe(
      'hard',
    );
  });

  it('classifies authwall URL as hard', () => {
    expect(cb.classify({ finalUrl: 'https://www.linkedin.com/authwall?trk=foo' })).toBe('hard');
  });

  it('classifies checkpoint/lg URL as hard', () => {
    expect(cb.classify({ finalUrl: 'https://www.linkedin.com/checkpoint/lg/login-submit' })).toBe(
      'hard',
    );
  });

  it('classifies body marker "security verification" as hard (case-insensitive)', () => {
    expect(cb.classify({ bodySample: 'Please complete the Security Verification below' })).toBe(
      'hard',
    );
  });

  it('classifies body marker "unusual activity" as hard', () => {
    expect(cb.classify({ bodySample: "We've detected unusual activity on your account" })).toBe(
      'hard',
    );
  });

  it('classifies body marker "verify your identity" as hard', () => {
    expect(cb.classify({ bodySample: 'Verify your identity to continue' })).toBe('hard');
  });

  it('classifies captcha mention as hard', () => {
    expect(cb.classify({ bodySample: 'solve this CAPTCHA' })).toBe('hard');
  });

  it('classifies a JSON endpoint that returns HTML as hard', () => {
    expect(
      cb.classify({ expectedJson: true, bodySample: '<!DOCTYPE html><html><head></head></html>' }),
    ).toBe('hard');
  });

  it('does NOT treat HTML as hard when JSON was not expected', () => {
    expect(cb.classify({ bodySample: '<!DOCTYPE html><html></html>' })).toBe('ok');
  });

  it('classifies a single 429 as soft', () => {
    expect(cb.classify({ status: 429 })).toBe('soft');
  });

  it('classifies a normal 200 JSON response as ok', () => {
    expect(cb.classify({ status: 200, expectedJson: true, bodySample: '{"ok":true}' })).toBe('ok');
  });
});

describe('CircuitBreaker soft cooldown', () => {
  it('blocks the cooled-down action but lets reads through', () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({ clock: clock.now });

    cb.trip('soft', 'connect', 'out of quota');

    expect(cb.canProceed('connect').ok).toBe(false);
    // reads always proceed under a soft trip
    expect(cb.canProceed('profile-view').ok).toBe(true);
    expect(cb.canProceed('search').ok).toBe(true);
    expect(cb.canProceed('read').ok).toBe(true);
    // an unrelated write action is unaffected
    expect(cb.canProceed('message').ok).toBe(true);
  });

  it('expires after the cooldown window (default 24h floor)', () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({ clock: clock.now });

    cb.trip('soft', 'connect');
    expect(cb.canProceed('connect').ok).toBe(false);

    clock.advance(24 * HOUR - 1);
    expect(cb.canProceed('connect').ok).toBe(false);

    clock.advance(2); // now just past 24h
    expect(cb.canProceed('connect').ok).toBe(true);
  });

  it('escalates cooldown length with repeated strikes, capped at the max', () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({
      clock: clock.now,
      softCooldownMinMs: 24 * HOUR,
      softCooldownMaxMs: 72 * HOUR,
    });

    cb.trip('soft', 'message');
    const after1 = cb.getState().actions['message']?.cooldownUntil ?? 0;
    expect(after1 - clock.now()).toBe(24 * HOUR);

    cb.trip('soft', 'message'); // strike 2 -> min + span/2 = 24h + 24h = 48h
    const after2 = cb.getState().actions['message']?.cooldownUntil ?? 0;
    expect(after2 - clock.now()).toBe(48 * HOUR);

    cb.trip('soft', 'message'); // strike 3 -> clamped at max 72h
    const after3 = cb.getState().actions['message']?.cooldownUntil ?? 0;
    expect(after3 - clock.now()).toBe(72 * HOUR);

    cb.trip('soft', 'message'); // strike 4 -> still clamped at 72h
    const after4 = cb.getState().actions['message']?.cooldownUntil ?? 0;
    expect(after4 - clock.now()).toBe(72 * HOUR);
  });

  it('ignores a soft trip with no action type', () => {
    const cb = new CircuitBreaker({ clock: makeClock().now });
    cb.trip('soft');
    expect(cb.getState().actions).toEqual({});
  });
});

describe('CircuitBreaker hard trip', () => {
  it('blocks everything including reads after a hard trip', () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({ clock: clock.now });

    cb.trip('hard', undefined, 'checkpoint challenge');

    expect(cb.isGlobalOpen()).toBe(true);
    for (const action of [
      'connect',
      'message',
      'like',
      'comment',
      'follow',
      'endorsement',
      'event-invite',
      'profile-view',
      'search',
      'read',
    ] as const) {
      const r = cb.canProceed(action);
      expect(r.ok).toBe(false);
      expect(r.reason).toContain('global circuit open');
    }
  });

  it('stays open over time and only clears on resetGlobal (human re-login)', () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({ clock: clock.now });

    cb.trip('hard', undefined, 'authwall');
    clock.advance(100 * HOUR); // time alone does not heal a hard trip
    expect(cb.canProceed('read').ok).toBe(false);

    cb.resetGlobal();
    expect(cb.isGlobalOpen()).toBe(false);
    expect(cb.canProceed('read').ok).toBe(true);
    expect(cb.canProceed('connect').ok).toBe(true);
  });

  it('reset() does not clear a hard global trip', () => {
    const cb = new CircuitBreaker({ clock: makeClock().now });
    cb.trip('hard');
    cb.reset();
    expect(cb.isGlobalOpen()).toBe(true);
    expect(cb.canProceed('read').ok).toBe(false);
  });

  it('resetGlobal can optionally clear soft cooldowns too', () => {
    const cb = new CircuitBreaker({ clock: makeClock().now });
    cb.trip('soft', 'connect');
    cb.trip('hard');

    cb.resetGlobal(true);
    expect(cb.isGlobalOpen()).toBe(false);
    expect(cb.canProceed('connect').ok).toBe(true);
    expect(cb.getState().actions).toEqual({});
  });
});

describe('CircuitBreaker repeated 429 tracking', () => {
  it('crosses the repeated-429 threshold after the configured count', () => {
    const cb = new CircuitBreaker({ clock: makeClock().now, repeated429Threshold: 2 });
    expect(cb.record429()).toBe(1);
    expect(cb.isRepeated429()).toBe(false);
    expect(cb.record429()).toBe(2);
    expect(cb.isRepeated429()).toBe(true);
  });

  it('reset() clears the rolling 429 counter', () => {
    const cb = new CircuitBreaker({ clock: makeClock().now, repeated429Threshold: 2 });
    cb.record429();
    cb.record429();
    expect(cb.isRepeated429()).toBe(true);
    cb.reset();
    expect(cb.isRepeated429()).toBe(false);
    expect(cb.getState().rate429Count).toBe(0);
  });
});

describe('CircuitBreaker persistence', () => {
  it('saves state to storage on every mutation', () => {
    const clock = makeClock();
    const storage = makeStorage();
    const cb = new CircuitBreaker({ clock: clock.now, storage });

    cb.trip('soft', 'connect');
    expect(storage.saved?.actions['connect']?.strikes).toBe(1);
    expect(storage.saved?.actions['connect']?.cooldownUntil).toBe(clock.now() + 24 * HOUR);
  });

  it('restores soft cooldown state across instances', () => {
    const clock = makeClock();
    const storage = makeStorage();

    const cb1 = new CircuitBreaker({ clock: clock.now, storage });
    cb1.trip('soft', 'message');
    expect(cb1.canProceed('message').ok).toBe(false);

    // A fresh breaker loading the same storage must see the cooldown.
    const cb2 = new CircuitBreaker({ clock: clock.now, storage });
    expect(cb2.canProceed('message').ok).toBe(false);
    expect(cb2.getState().actions['message']?.strikes).toBe(1);

    // And it expires at the same wall-time as the original.
    clock.advance(24 * HOUR + 1);
    expect(cb2.canProceed('message').ok).toBe(true);
  });

  it('restores a global hard trip across instances', () => {
    const clock = makeClock();
    const storage = makeStorage();

    const cb1 = new CircuitBreaker({ clock: clock.now, storage });
    cb1.trip('hard', undefined, '999 wall');

    const cb2 = new CircuitBreaker({ clock: clock.now, storage });
    expect(cb2.isGlobalOpen()).toBe(true);
    expect(cb2.canProceed('read').ok).toBe(false);
    expect(cb2.getState().globalReason).toBe('999 wall');
  });

  it('normalizes a partial/legacy persisted state without throwing', () => {
    const clock = makeClock();
    // Simulate a partial state missing several fields.
    const partial = { globalOpen: true } as unknown as CircuitState;
    const storage = makeStorage(partial);

    const cb = new CircuitBreaker({ clock: clock.now, storage });
    expect(cb.isGlobalOpen()).toBe(true);
    expect(cb.getState().rate429Count).toBe(0);
    expect(cb.getState().actions).toEqual({});
  });
});

describe('CircuitBreaker end-to-end classify -> trip -> canProceed', () => {
  it('soft path: 429 cools down connects but reads continue', () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({ clock: clock.now });

    const cls = cb.classify({ status: 429 });
    expect(cls).toBe('soft');
    cb.trip(cls, 'connect', 'rate limited');

    expect(cb.canProceed('connect').ok).toBe(false);
    expect(cb.canProceed('profile-view').ok).toBe(true);
  });

  it('hard path: checkpoint URL kills everything globally', () => {
    const clock = makeClock();
    const cb = new CircuitBreaker({ clock: clock.now });

    const cls = cb.classify({ finalUrl: 'https://www.linkedin.com/checkpoint/challenge/x' });
    expect(cls).toBe('hard');
    cb.trip(cls, undefined, 'checkpoint');

    expect(cb.canProceed('read').ok).toBe(false);
    expect(cb.canProceed('connect').ok).toBe(false);
  });
});
