/** Fail-closed local filesystem ownership. Locks are never stolen by timeout. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ensurePrivateStateDirectory, fixedWindowsStateCode } from './windows-private-state.js';

export type SafetyStateCode =
  | 'PROFILE_IN_USE'
  | 'STATE_BUSY'
  | 'STATE_INVALID'
  | 'STATE_WRITE_FAILED'
  | 'ACCOUNT_UNRESOLVED'
  | 'ACCOUNT_CHANGED'
  | 'BUDGET_EXHAUSTED';
export class SafetyStateError extends Error {
  constructor(
    readonly code: SafetyStateCode,
    message: string,
  ) {
    super(message);
    this.name = 'SafetyStateError';
  }
}

/** Resolve existing symlinks, including parent aliases before a leaf exists. */
export function canonicalPath(input: string): string {
  let current = path.resolve(input);
  const missing: string[] = [];
  while (true) {
    try {
      fs.lstatSync(current); // A dangling symlink is invalid, not a missing leaf.
      return path.join(fs.realpathSync(current), ...missing.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new SafetyStateError(
          'STATE_INVALID',
          'Safety path is inaccessible. Repair local storage before continuing.',
        );
      // lstat distinguishes a dangling symlink from a truly missing path.
      try {
        if (fs.lstatSync(current).isSymbolicLink())
          throw new SafetyStateError(
            'STATE_INVALID',
            'Safety path contains a dangling symlink. Repair local storage before continuing.',
          );
      } catch (probe) {
        if ((probe as NodeJS.ErrnoException).code !== 'ENOENT') throw probe;
      }
      const parent = path.dirname(current);
      if (parent === current)
        throw new SafetyStateError('STATE_INVALID', 'Safety path could not be resolved.');
      missing.push(path.basename(current));
      current = parent;
    }
  }
}
export function profilePath(profileDir?: string): string {
  return canonicalPath(profileDir || path.join(os.homedir(), '.linkedin-mcp', 'profile'));
}

/** Liveness probe via signal 0 — sends nothing, only asks "does this PID exist?". */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM = exists but owned by another user → alive. ESRCH = gone. Anything
    // else is undecidable, so treat it as alive (fail-closed).
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

/**
 * True when a live Chrome still holds the browser profile directory.
 *
 * Chrome's SingletonLock symlink encodes "<hostname>-<pid>". If that pid is
 * alive, a browser owns the profile and it must not be reused.
 */
function chromeHoldsProfile(lockDirectory: string): boolean {
  // <profile>.lock  →  <profile>  is the browser profile dir.
  const profileDir = lockDirectory.replace(/\.lock$/, '');
  let link: string;
  try {
    link = fs.readlinkSync(path.join(profileDir, 'SingletonLock'));
  } catch {
    return false; // No singleton lock → no live browser holding it.
  }
  const pid = Number(link.slice(link.lastIndexOf('-') + 1));
  if (!Number.isInteger(pid) || pid <= 0) return false; // Unparseable → not a live pid.
  return isProcessAlive(pid);
}

const ownerSchema = z.object({
  token: z.string().uuid(),
  pid: z.number().int().positive(),
  host: z.string().min(1),
  createdAt: z.number().finite().nonnegative(),
});
export class StateLock {
  private token?: string;
  readonly directory: string;
  constructor(
    target: string,
    private readonly profile = false,
  ) {
    this.directory = `${canonicalPath(target)}.lock`;
  }

  /**
   * Reclaim a lock whose recorded owner is provably gone.
   *
   * This is OPT-IN (`LINKEDIN_RECLAIM_STALE_LOCK=1`). The default stays
   * fail-closed: a crashed run leaves the lock directory behind, and the
   * conservative reading is that the profile may still be held by a live
   * browser we cannot see, so a human must repair it.
   *
   * When the operator opts in, the reclaim is only allowed if the evidence is
   * unambiguous:
   *   1. owner.json parses, names THIS host, and its PID is dead (ESRCH from
   *      signal-0) — the automation owner is provably gone;
   *   2. for profile locks, Chrome's own SingletonLock symlink (which encodes
   *      hostname-PID) does not point at a LIVE pid — no browser still holds
   *      the profile directory.
   * Any other state — live owner, unparseable owner, different host, live
   * browser — leaves the lock fail-closed exactly as before.
   */
  private reclaimIfStale(): boolean {
    if (process.env.LINKEDIN_RECLAIM_STALE_LOCK !== '1') return false;

    let owner: z.infer<typeof ownerSchema>;
    try {
      const raw = fs.readFileSync(path.join(this.directory, 'owner.json'), 'utf8');
      owner = ownerSchema.parse(JSON.parse(raw));
    } catch {
      return false; // Unreadable/corrupt owner: cannot prove staleness — stay closed.
    }
    if (owner.host !== os.hostname()) return false; // Different host: undecidable.
    if (isProcessAlive(owner.pid)) return false; // Owner is alive — the lock is legitimately held.

    // A browser that survived the crash would still hold the profile dir.
    if (this.profile && chromeHoldsProfile(this.directory)) return false;

    try {
      fs.rmSync(this.directory, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  /** The canonical "someone else holds this lock" error for this lock kind. */
  private busyError(): SafetyStateError {
    return new SafetyStateError(
      this.profile ? 'PROFILE_IN_USE' : 'STATE_BUSY',
      this.profile
        ? 'Browser profile is owned by another process. Stop that process before using the profile.'
        : 'Safety state is locked by another transaction. No action was submitted; retry this operation ID later.',
    );
  }

  acquire(): void {
    if (this.token) {
      this.assertOwned();
      return;
    }
    try {
      ensurePrivateStateDirectory(path.dirname(this.directory));
      fs.mkdirSync(this.directory, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        if (this.reclaimIfStale()) {
          // Stale owner confirmed dead — take it over.
          try {
            fs.mkdirSync(this.directory, { mode: 0o700 });
          } catch {
            throw this.busyError();
          }
        } else {
          throw this.busyError();
        }
      } else {
        const wrapped = new SafetyStateError(
          'STATE_WRITE_FAILED',
          'Safety lock could not be created. Repair local storage before continuing.',
        );
        const stateCode = fixedWindowsStateCode(error);
        if (stateCode) Object.assign(wrapped, { stateCode });
        throw wrapped;
      }
    }
    const token = randomUUID();
    try {
      const fd = fs.openSync(path.join(this.directory, 'owner.json'), 'wx', 0o600);
      try {
        fs.writeFileSync(
          fd,
          JSON.stringify({ token, pid: process.pid, host: os.hostname(), createdAt: Date.now() }),
        );
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      this.token = token;
    } catch {
      // We exclusively created this directory; no other compliant owner can use it.
      try {
        fs.rmSync(this.directory, { recursive: true, force: true });
      } catch {
        /* Leave the lock fail-closed. */
      }
      throw new SafetyStateError(
        'STATE_WRITE_FAILED',
        'Safety lock ownership could not be saved. Repair local storage before continuing.',
      );
    }
  }
  assertOwned(): void {
    try {
      const file = path.join(this.directory, 'owner.json');
      const fd = fs.openSync(file, 'r');
      let raw: string;
      try {
        if (fs.fstatSync(fd).size > 4096) throw new Error('oversized');
        raw = fs.readFileSync(fd, 'utf8');
      } finally {
        fs.closeSync(fd);
      }
      const owner = ownerSchema.parse(JSON.parse(raw));
      if (
        !this.token ||
        owner.token !== this.token ||
        owner.pid !== process.pid ||
        owner.host !== os.hostname()
      )
        throw new Error('different owner');
    } catch {
      throw new SafetyStateError(
        'STATE_INVALID',
        'Safety lock ownership changed or is invalid. Stop automation and repair state.',
      );
    }
  }
  release(): void {
    if (!this.token) return;
    this.assertOwned();
    fs.rmSync(this.directory, { recursive: true });
    this.token = undefined;
  }
}

/** Never hold the shared state lock across a browser request or pacing wait. */
export function withStateLock<T>(target: string, fn: () => T): T {
  const lock = new StateLock(target);
  lock.acquire();
  try {
    return fn();
  } finally {
    lock.release();
  }
}
