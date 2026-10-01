/** Durable, profile-scoped breaker state. No response content is stored. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { profilePath } from './state-lock.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CircuitState, CircuitStorage } from './circuit-breaker.js';

const nonnegative = z.number().finite().nonnegative();
const stateSchema = z.object({
  globalOpen: z.boolean(),
  globalTrippedAt: nonnegative,
  globalReason: z.string().max(512),
  actions: z.record(
    z.object({ strikes: nonnegative.int(), cooldownUntil: nonnegative, lastStrikeAt: nonnegative }),
  ),
  rate429Count: nonnegative.int(),
});

/** Sibling of the profile: --logout must not erase a hard stop. */
export function circuitStatePath(profileDir?: string): string {
  return `${profilePath(profileDir)}.circuit.json`;
}

export class CircuitFileStorage implements CircuitStorage {
  constructor(readonly filePath: string) {}

  load(): CircuitState | null {
    try {
      // Bound file reads as well as JSON validation; corrupted state is not a reset.
      const fd = fs.openSync(this.filePath, 'r');
      try {
        if (fs.fstatSync(fd).size > 64 * 1024) throw new Error('oversized');
        return stateSchema.parse(JSON.parse(fs.readFileSync(fd, 'utf8')));
      } finally {
        fs.closeSync(fd);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new Error(
        'Circuit state is unreadable or invalid. Stop automation and restore the safety state before restarting.',
      );
    }
  }

  save(state: CircuitState): void {
    const temp = `${this.filePath}.${randomUUID()}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
      const fd = fs.openSync(temp, 'wx', 0o600);
      try {
        fs.writeFileSync(fd, JSON.stringify(stateSchema.parse(state)), 'utf8');
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      fs.renameSync(temp, this.filePath);
    } catch {
      throw new Error(
        'Circuit state could not be saved. Stop automation and repair safety-state storage before restarting.',
      );
    } finally {
      try {
        fs.unlinkSync(temp);
      } catch {
        /* Already renamed or never created. */
      }
    }
  }
}
