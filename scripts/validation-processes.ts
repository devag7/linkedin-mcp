/** Local-only process accounting. Commands, birth stamps and PIDs remain in memory. */
import { execFileSync } from 'node:child_process';

export interface ValidationProcess {
  pid: number;
  parent: number;
  start: string;
  state: string;
  command: string;
}
export const PROCESS_ACCOUNTING_KEYS = [
  'directProfileRoots',
  'trackedAlive',
  'newDescendants',
  'reparented',
  'zombies',
  'reusedPids',
  'unrelatedSubstringMatches',
] as const;
export type ProcessAccountingCounts = Record<(typeof PROCESS_ACCOUNTING_KEYS)[number], number>;

/** Exact known profile flag; ambiguous flattened arguments fail rather than certify zero. */
function profileArgument(command: string, profile: string): boolean {
  const flag = /(?:^|\s)--user-data-dir=/g;
  for (const match of command.matchAll(flag)) {
    const tail = command.slice(match.index! + match[0].length);
    if (tail.startsWith('"') || tail.startsWith("'")) {
      const quoted = tail[0]! + profile + tail[0]!;
      if (tail.startsWith(quoted) && /^(?:\s|$)/.test(tail.slice(quoted.length))) return true;
      if (tail.slice(1).startsWith(profile)) throw new Error('PROCESS_ARGUMENT_AMBIGUOUS');
    } else if (tail === profile || tail.startsWith(profile + ' ')) {
      const rest = tail.slice(profile.length).trimStart();
      if (!rest || rest.startsWith('--')) return true;
      throw new Error('PROCESS_ARGUMENT_AMBIGUOUS');
    }
  }
  return false;
}

/** POSIX inventory for the macOS diagnostic and disposable lifecycle fixtures. Never writes native inventory. */
export function readValidationProcesses(
  execute: () => string = () =>
    execFileSync('ps', ['-eo', 'pid=,ppid=,stat=,lstart=,args='], {
      encoding: 'utf8',
      stdio: 'pipe', // Node may otherwise echo stderr before throwing; never leak inventory.
      timeout: 1000,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
    }),
): ValidationProcess[] {
  let text: string;
  try {
    text = execute();
  } catch {
    throw new Error('PROCESS_SNAPSHOT_FAILED');
  }
  const rows = parseValidationProcesses(text);
  if (!rows.some((row) => row.pid === process.pid)) throw new Error('PROCESS_SNAPSHOT_INCOMPLETE');
  return rows;
}
export function parseValidationProcesses(text: string): ValidationProcess[] {
  const rows: ValidationProcess[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const match =
      /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.*)$/.exec(
        line,
      );
    if (!match) throw new Error('PROCESS_SNAPSHOT_INVALID');
    rows.push({
      pid: Number(match[1]),
      parent: Number(match[2]),
      state: match[3]!,
      start: match[4]!.replace(/\s+/g, ' '),
      command: match[5]!,
    });
  }
  if (!rows.length) throw new Error('PROCESS_SNAPSHOT_EMPTY');
  return rows;
}

/** Persist every observed descendant's birth identity, including children reparented later. */
export class ValidationProcessTracker {
  private readonly tracked = new Map<number, { start: string; parent: number }>();
  constructor(private readonly profile: string) {
    if (!profile || /[\r\n]/.test(profile)) throw new Error('PROCESS_PROFILE_INVALID');
  }
  sample(rows: readonly ValidationProcess[]) {
    if (!rows.length) throw new Error('PROCESS_SNAPSHOT_EMPTY');
    const counts = Object.fromEntries(
      PROCESS_ACCOUNTING_KEYS.map((key) => [key, 0]),
    ) as ProcessAccountingCounts;
    const selected = new Set<number>();
    const present = new Set<number>();
    for (const row of rows) {
      if (
        !Number.isSafeInteger(row.pid) ||
        row.pid < 0 ||
        !Number.isSafeInteger(row.parent) ||
        row.parent < 0 ||
        (row.pid === row.parent && row.pid !== 0) ||
        present.has(row.pid) ||
        !row.start ||
        !row.state ||
        typeof row.command !== 'string'
      )
        throw new Error('PROCESS_SNAPSHOT_INVALID');
      present.add(row.pid);
      const original = this.tracked.get(row.pid);
      if (original !== undefined && original.start !== row.start) counts.reusedPids++;
      const direct = profileArgument(row.command, this.profile);
      if (direct) {
        selected.add(row.pid);
        counts.directProfileRoots++;
      } else if (row.command.includes(this.profile)) counts.unrelatedSubstringMatches++;
      if (original?.start === row.start) {
        selected.add(row.pid);
        counts.trackedAlive++;
      }
    }
    for (let changed = true; changed; ) {
      changed = false;
      for (const row of rows)
        if (selected.has(row.parent) && !selected.has(row.pid)) {
          selected.add(row.pid);
          counts.newDescendants++;
          changed = true;
        }
    }
    for (const row of rows)
      if (selected.has(row.pid)) {
        const original = this.tracked.get(row.pid);
        if (original?.start === row.start) {
          if (original.parent !== row.parent) counts.reparented++;
        } else this.tracked.set(row.pid, { start: row.start, parent: row.parent });
        if (row.state.startsWith('Z')) counts.zombies++;
      }
    if (this.tracked.size > 10000) throw new Error('PROCESS_TRACKING_LIMIT');
    return { remainingProcesses: selected.size, processAccounting: counts };
  }
}
