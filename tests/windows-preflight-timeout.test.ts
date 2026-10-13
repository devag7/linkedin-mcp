/** Synthetic timeout contract; no native command or profile is accessed. */
import { expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as number[]);
vi.mock('node:child_process', () => ({
  execFileSync: (_file: string, _args: string[], options: { timeout: number }) => {
    calls.push(options.timeout);
    return JSON.stringify([{ ProcessId: process.pid, ParentProcessId: 0, CommandLine: '',
      CreationDate: '2026-10-10T00:00:01.0000000Z' }]);
  },
}));

import { readWindowsValidationProcesses } from '../scripts/validation-windows-processes.js';

it('bounds only the cold preflight inventory at 15 seconds', () => {
  calls.length = 0;
  expect(readWindowsValidationProcesses(undefined, 'preflight')).toHaveLength(1);
  expect(readWindowsValidationProcesses()).toHaveLength(1);
  expect(calls).toEqual([15_000, 5_000]);
});
