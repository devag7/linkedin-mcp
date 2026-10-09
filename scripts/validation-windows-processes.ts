/** Offline fixture inventory only. Native commands/errors never cross this boundary. */
import { execFileSync } from 'node:child_process';

export interface WindowsValidationProcess {
  ProcessId: number;
  ParentProcessId: number;
  CommandLine: string | null;
}
export function readWindowsValidationProcesses(
  execute: () => string = () =>
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress',
      ],
      { encoding: 'utf8', stdio: 'pipe', timeout: 5000, maxBuffer: 2 * 1024 * 1024 },
    ),
): WindowsValidationProcess[] {
  let text: string;
  try {
    text = execute();
  } catch (error) {
    const timedOut =
      error !== null && typeof error === 'object' && 'code' in error && error.code === 'ETIMEDOUT';
    throw new Error(timedOut ? 'PROCESS_SNAPSHOT_TIMEOUT' : 'PROCESS_SNAPSHOT_FAILED');
  }
  let values: unknown;
  try {
    values = JSON.parse(text);
  } catch {
    throw new Error('PROCESS_SNAPSHOT_INVALID');
  }
  if (!Array.isArray(values)) throw new Error('PROCESS_SNAPSHOT_INVALID');
  if (
    values.some(
      (value) =>
        !value ||
        !Number.isSafeInteger(value.ProcessId) ||
        value.ProcessId < 0 ||
        !Number.isSafeInteger(value.ParentProcessId) ||
        value.ParentProcessId < 0 ||
        (value.CommandLine !== null && typeof value.CommandLine !== 'string'),
    ) ||
    new Set(values.map((value) => value.ProcessId)).size !== values.length
  )
    throw new Error('PROCESS_SNAPSHOT_INVALID');
  if (!values.some((value) => value.ProcessId === process.pid))
    throw new Error('PROCESS_SNAPSHOT_INCOMPLETE');
  return values;
}

const FAILURE_CODES = new Set([
  'PROCESS_SNAPSHOT_TIMEOUT',
  'PROCESS_SNAPSHOT_FAILED',
  'PROCESS_SNAPSHOT_INVALID',
  'PROCESS_SNAPSHOT_INCOMPLETE',
  'PROCESS_SNAPSHOT_EMPTY',
  'PROCESS_ARGUMENT_AMBIGUOUS',
  'PROCESS_TRACKING_LIMIT',
  'TEMP_PROFILE_ALREADY_ACTIVE',
  'OWNERSHIP_NOT_VERIFIED',
  'CHROME_PROCESS_NOT_OBSERVED',
  'CHROME_CLEANUP_NOT_VERIFIED',
]);
export function offlineLifecycleFailureCode(error: unknown): string {
  return error instanceof Error && FAILURE_CODES.has(error.message)
    ? error.message
    : 'BROWSER_LIFECYCLE_FAILED';
}
