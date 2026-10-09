/** Injected inventories/errors only. No native profile or provider access. */
import { expect, it } from 'vitest';
import {
  readWindowsValidationProcesses,
  offlineLifecycleFailureCode,
} from '../scripts/validation-windows-processes.js';
import { verifyFinalCleanup } from '../scripts/validation-cleanup.js';

const privateValue = 'PRIVATE-COMMAND-PATH-IDENTIFIER';
const observer = { ProcessId: process.pid, ParentProcessId: 1, CommandLine: privateValue };

it.each(['ETIMEDOUT', 'ENOENT', 'EACCES', 'OTHER'])(
  'redacts native inventory errors: %s',
  (code) => {
    let caught: unknown;
    try {
      readWindowsValidationProcesses(() => {
        throw Object.assign(new Error(privateValue), {
          code,
          stdout: privateValue,
          stderr: privateValue,
          cmd: privateValue,
        });
      });
    } catch (error) {
      caught = error;
    }
    expect(offlineLifecycleFailureCode(caught)).toBe(
      code === 'ETIMEDOUT' ? 'PROCESS_SNAPSHOT_TIMEOUT' : 'PROCESS_SNAPSHOT_FAILED',
    );
    expect(String(caught) + JSON.stringify(caught)).not.toContain(privateValue);
  },
);

it.each([
  privateValue,
  JSON.stringify(observer),
  JSON.stringify([observer, null]),
  JSON.stringify([observer, observer]),
  JSON.stringify([observer, { ...observer, ProcessId: -1 }]),
  JSON.stringify([observer, { ...observer, ProcessId: process.pid + 1, CommandLine: {} }]),
])('rejects malformed inventory without retaining its contents: %s', (text) => {
  expect(() => readWindowsValidationProcesses(() => text)).toThrow('PROCESS_SNAPSHOT_INVALID');
});

it('rejects a snapshot without the observer and keeps valid native data in memory only', () => {
  expect(() => readWindowsValidationProcesses(() => '[]')).toThrow('PROCESS_SNAPSHOT_INCOMPLETE');
  expect(readWindowsValidationProcesses(() => JSON.stringify([observer]))).toEqual([observer]);
});

it('does not forward arbitrary uppercase error messages', () => {
  // The prior uppercase/underscore regex would have forwarded this entire value.
  expect(offlineLifecycleFailureCode(new Error('PRIVATE_COMMAND_PATH_IDENTIFIER'))).toBe(
    'BROWSER_LIFECYCLE_FAILED',
  );
  expect(offlineLifecycleFailureCode(new Error('PROCESS_SNAPSHOT_TIMEOUT'))).toBe(
    'PROCESS_SNAPSHOT_TIMEOUT',
  );
});

it('a classified probe timeout still permanently fails bounded cleanup', async () => {
  const result = await verifyFinalCleanup(
    () => {
      readWindowsValidationProcesses(() => {
        throw Object.assign(new Error(privateValue), { code: 'ETIMEDOUT', stderr: privateValue });
      });
      return { remainingProcesses: 0, ownershipReleased: true, contextInactive: true };
    },
    { maximumMs: 0 },
  );
  expect(result.verified).toBe(false);
  expect(result.immediate.probeFailed).toBe(true);
  expect(result.final.remainingProcesses).toBe(null);
  expect(JSON.stringify(result)).not.toContain(privateValue);
});
