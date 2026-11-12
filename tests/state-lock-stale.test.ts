import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { StateLock } from '../src/safety/state-lock.js';

/**
 * A killed run (SIGKILL / crash / closed terminal) leaves the lock directory
 * behind. The default policy is fail-closed: a human repairs it.
 *
 * The operator can opt in to automatic reclamation with
 * LINKEDIN_RECLAIM_STALE_LOCK=1, but ONLY when the evidence is unambiguous:
 * the owner PID is dead on this host AND no live Chrome still holds the
 * browser profile directory.
 */
let dir: string;
const originalFlag = process.env.LINKEDIN_RECLAIM_STALE_LOCK;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'linkedin-stale-lock-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  if (originalFlag === undefined) delete process.env.LINKEDIN_RECLAIM_STALE_LOCK;
  else process.env.LINKEDIN_RECLAIM_STALE_LOCK = originalFlag;
});

/** A PID that is guaranteed not to be running. */
function deadPid(): number {
  return 2 ** 22 - 1;
}

function writeOwner(lockDir: string, owner: Record<string, unknown>): void {
  mkdirSync(lockDir, { recursive: true });
  writeFileSync(join(lockDir, 'owner.json'), JSON.stringify(owner));
}

function deadOwner(lockDir: string): void {
  writeOwner(lockDir, {
    token: randomUUID(),
    pid: deadPid(),
    host: hostname(),
    createdAt: Date.now() - 60_000,
  });
}

describe('StateLock stale-owner reclamation', () => {
  it('DEFAULT: refuses a lock whose owner is dead (fail-closed until a human repairs it)', () => {
    delete process.env.LINKEDIN_RECLAIM_STALE_LOCK;
    const target = join(dir, 'profile');
    const lockDir = `${target}.lock`;
    deadOwner(lockDir);

    const lock = new StateLock(target, true);
    expect(() => lock.acquire()).toThrow(/owned by another process/i);
    expect(existsSync(lockDir)).toBe(true);
  });

  it('OPT-IN: reclaims a lock whose owner PID is dead on this host', () => {
    process.env.LINKEDIN_RECLAIM_STALE_LOCK = '1';
    const target = join(dir, 'profile');
    const lockDir = `${target}.lock`;
    deadOwner(lockDir);

    const lock = new StateLock(target, true);
    expect(() => lock.acquire()).not.toThrow();
    expect(() => lock.assertOwned()).not.toThrow();

    const owner = JSON.parse(readFileSync(join(lockDir, 'owner.json'), 'utf8'));
    expect(owner.pid).toBe(process.pid);

    lock.release();
    expect(existsSync(lockDir)).toBe(false);
  });

  it('OPT-IN: refuses when the owner PID is still alive', () => {
    process.env.LINKEDIN_RECLAIM_STALE_LOCK = '1';
    const target = join(dir, 'profile');
    const lockDir = `${target}.lock`;
    writeOwner(lockDir, {
      token: randomUUID(),
      pid: process.pid, // this test process — definitively alive
      host: hostname(),
      createdAt: Date.now(),
    });

    const lock = new StateLock(target, true);
    expect(() => lock.acquire()).toThrow(/owned by another process/i);
    expect(existsSync(lockDir)).toBe(true);
  });

  it('OPT-IN: refuses when the owner lives on another host (liveness undecidable)', () => {
    process.env.LINKEDIN_RECLAIM_STALE_LOCK = '1';
    const target = join(dir, 'profile');
    const lockDir = `${target}.lock`;
    writeOwner(lockDir, {
      token: randomUUID(),
      pid: deadPid(),
      host: 'some-other-machine',
      createdAt: Date.now() - 60_000,
    });

    const lock = new StateLock(target, true);
    expect(() => lock.acquire()).toThrow(/owned by another process/i);
    expect(existsSync(lockDir)).toBe(true);
  });

  it('OPT-IN: refuses when owner.json is unreadable or corrupt', () => {
    process.env.LINKEDIN_RECLAIM_STALE_LOCK = '1';
    const target = join(dir, 'profile');
    const lockDir = `${target}.lock`;
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(join(lockDir, 'owner.json'), '{not json');

    const lock = new StateLock(target, true);
    expect(() => lock.acquire()).toThrow(/owned by another process/i);
  });

  it('OPT-IN: refuses when a LIVE Chrome still holds the profile directory', () => {
    process.env.LINKEDIN_RECLAIM_STALE_LOCK = '1';
    const target = join(dir, 'profile');
    const lockDir = `${target}.lock`;
    deadOwner(lockDir);
    // Chrome's SingletonLock encodes "<hostname>-<pid>"; this test process is alive.
    mkdirSync(target, { recursive: true });
    symlinkSync(`${hostname()}-${process.pid}`, join(target, 'SingletonLock'));

    const lock = new StateLock(target, true);
    expect(() => lock.acquire()).toThrow(/owned by another process/i);
    expect(existsSync(lockDir)).toBe(true);
  });

  it('OPT-IN: reclaims when the profile SingletonLock points at a dead browser', () => {
    process.env.LINKEDIN_RECLAIM_STALE_LOCK = '1';
    const target = join(dir, 'profile');
    const lockDir = `${target}.lock`;
    deadOwner(lockDir);
    mkdirSync(target, { recursive: true });
    symlinkSync(`${hostname()}-${deadPid()}`, join(target, 'SingletonLock'));

    const lock = new StateLock(target, true);
    expect(() => lock.acquire()).not.toThrow();
    lock.release();
  });

  it('still enforces mutual exclusion between two live lock objects', () => {
    const target = join(dir, 'state');
    const first = new StateLock(target);
    const second = new StateLock(target);
    first.acquire();
    expect(() => second.acquire()).toThrow(/locked by another transaction/i);
    first.release();
    expect(() => second.acquire()).not.toThrow();
    second.release();
  });
});
