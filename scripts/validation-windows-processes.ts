/** Offline fixture inventory only. Native commands/errors never cross this boundary. */
import { execFileSync } from 'node:child_process';
import {
  PROCESS_ACCOUNTING_KEYS,
  profileArgument,
  profileFootprint,
  type ProcessAccountingCounts,
} from './validation-processes.js';

export interface WindowsValidationProcess {
  ProcessId: number;
  ParentProcessId: number;
  CommandLine: string | null;
  CreationDate: string | null;
}

/** Fixed UTC precision preserves native sub-millisecond identity; never log it. */
function validBirth(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/.test(value))
    return false;
  const seconds = value.slice(0, 19);
  const date = new Date(seconds + '.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === seconds;
}

function validateInventory(values: unknown): asserts values is WindowsValidationProcess[] {
  if (
    !Array.isArray(values) ||
    values.some(
      (value) =>
        !value ||
        !Number.isSafeInteger(value.ProcessId) ||
        value.ProcessId < 0 ||
        value.ProcessId > 0xffffffff ||
        !Number.isSafeInteger(value.ParentProcessId) ||
        value.ParentProcessId < 0 ||
        value.ParentProcessId > 0xffffffff ||
        (value.ProcessId === value.ParentProcessId && value.ProcessId !== 0) ||
        (value.CommandLine !== null && typeof value.CommandLine !== 'string') ||
        (value.CreationDate != null && !validBirth(value.CreationDate)),
    ) ||
    new Set(values.map((value) => value.ProcessId)).size !== values.length
  )
    throw new Error('PROCESS_SNAPSHOT_INVALID');
  if (!values.some((value) => value.ProcessId === process.pid))
    throw new Error('PROCESS_SNAPSHOT_INCOMPLETE');
}

export function readWindowsValidationProcesses(
  execute: () => string = () =>
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine,@{Name="CreationDate";Expression={if ($null -ne $_.CreationDate) {$_.CreationDate.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ", [System.Globalization.CultureInfo]::InvariantCulture)} else {$null}}} | ConvertTo-Json -Compress',
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
  validateInventory(values);
  return values.map((value) => ({ ...value, CreationDate: value.CreationDate ?? null }));
}

/** Offline lifecycle fixture only. A PID is selected only for its observed birth. */
export class WindowsValidationProcessTracker {
  private readonly tracked = new Map<number, Map<string, { parent: number }>>();
  private trackedLifetimes = 0;
  private readonly profile: string;
  constructor(profile: string) {
    if (!profile || /[\r\n]/.test(profile)) throw new Error('PROCESS_PROFILE_INVALID');
    this.profile = profile.replace(/\\/g, '/').toLowerCase();
  }
  sample(rows: readonly WindowsValidationProcess[]) {
    validateInventory(rows);
    const observer = rows.find((row) => row.ProcessId === process.pid)!;
    if (!validBirth(observer.CreationDate)) throw new Error('PROCESS_IDENTITY_UNCERTAIN');
    const counts = Object.fromEntries(
      PROCESS_ACCOUNTING_KEYS.map((key) => [key, 0]),
    ) as ProcessAccountingCounts;
    const selected = new Set<number>();
    const byPid = new Map(rows.map((row) => [row.ProcessId, row]));
    for (const row of rows) {
      // Only the validated observer itself; genuine children still classify normally.
      if (row.ProcessId === process.pid) continue;
      const lifetimes = this.tracked.get(row.ProcessId);
      if (lifetimes !== undefined) {
        if (!validBirth(row.CreationDate)) throw new Error('PROCESS_IDENTITY_UNCERTAIN');
        const original = lifetimes.get(row.CreationDate);
        if (original) {
          selected.add(row.ProcessId);
          counts.trackedAlive++;
          if (original.parent !== row.ParentProcessId) counts.reparented++;
        } else counts.reusedPids++;
      }
      const command = (row.CommandLine ?? '').replace(/\\/g, '/').toLowerCase();
      if (profileArgument(command, this.profile)) {
        if (!validBirth(row.CreationDate)) throw new Error('PROCESS_IDENTITY_UNCERTAIN');
        selected.add(row.ProcessId);
        counts.directProfileRoots++;
      } else if (profileFootprint(command, this.profile)) {
        // An auxiliary/flattened argument is uncertain, never grounds for clean zero.
        if (!validBirth(row.CreationDate)) throw new Error('PROCESS_IDENTITY_UNCERTAIN');
        selected.add(row.ProcessId);
        counts.unclassifiedProfileReferences++;
      }
    }
    for (let changed = true; changed; ) {
      changed = false;
      for (const row of rows) {
        if (row.ProcessId === process.pid || selected.has(row.ProcessId)) continue;
        const parent = byPid.get(row.ParentProcessId);
        if (parent && selected.has(parent.ProcessId)) {
          if (!validBirth(parent.CreationDate) || !validBirth(row.CreationDate))
            throw new Error('PROCESS_IDENTITY_UNCERTAIN');
          // Parent PID may be stale. A younger parent cannot have created this child.
          if (parent.CreationDate > row.CreationDate) {
            // This is stale for the selected lifetime, but may be a genuine
            // unseen child of an earlier tracked lifetime of that same PID.
            if (
              [...(this.tracked.get(parent.ProcessId)?.keys() ?? [])].some(
                (birth) => birth <= row.CreationDate!,
              )
            )
              throw new Error('PROCESS_IDENTITY_UNCERTAIN');
            continue;
          }
          if (parent.CreationDate === row.CreationDate)
            throw new Error('PROCESS_IDENTITY_UNCERTAIN');
          selected.add(row.ProcessId);
          counts.newDescendants++;
          changed = true;
        } else if (this.tracked.has(row.ParentProcessId)) {
          // A previously unseen child of an absent/reused PID cannot be bound to
          // its old lifetime: the PID could have been reused between snapshots.
          if (!validBirth(row.CreationDate)) throw new Error('PROCESS_IDENTITY_UNCERTAIN');
          if (parent && !validBirth(parent.CreationDate))
            throw new Error('PROCESS_IDENTITY_UNCERTAIN');
          if (
            [...this.tracked.get(row.ParentProcessId)!.keys()].some(
              (birth) => birth <= row.CreationDate!,
            ) &&
            (!parent || row.CreationDate <= parent.CreationDate!)
          )
            throw new Error('PROCESS_IDENTITY_UNCERTAIN');
        }
      }
    }
    for (const row of rows)
      if (selected.has(row.ProcessId)) {
        let lifetimes = this.tracked.get(row.ProcessId);
        if (!lifetimes) this.tracked.set(row.ProcessId, (lifetimes = new Map()));
        if (!lifetimes.has(row.CreationDate!)) {
          lifetimes.set(row.CreationDate!, { parent: row.ParentProcessId });
          if (++this.trackedLifetimes > 10000) throw new Error('PROCESS_TRACKING_LIMIT');
        }
      }
    if (this.trackedLifetimes > 10000) throw new Error('PROCESS_TRACKING_LIMIT');
    return { remainingProcesses: selected.size, processAccounting: counts };
  }
}

const FAILURE_CODES = new Set([
  'PROCESS_SNAPSHOT_TIMEOUT',
  'PROCESS_SNAPSHOT_FAILED',
  'PROCESS_SNAPSHOT_INVALID',
  'PROCESS_SNAPSHOT_INCOMPLETE',
  'PROCESS_SNAPSHOT_EMPTY',
  'PROCESS_IDENTITY_UNCERTAIN',
  'PROCESS_PROFILE_INVALID',
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
