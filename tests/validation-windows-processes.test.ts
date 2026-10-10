/** Injected inventories/errors only. No native profile or provider access. */
import { expect, it } from 'vitest';
import {
  readWindowsValidationProcesses,
  offlineLifecycleFailureCode,
  WindowsValidationProcessTracker,
  type WindowsValidationProcess,
} from '../scripts/validation-windows-processes.js';
import { verifyFinalCleanup } from '../scripts/validation-cleanup.js';

const privateValue = 'PRIVATE-COMMAND-PATH-IDENTIFIER';
const birth = (second: number, fraction = '0000000') =>
  `2026-10-10T00:00:${String(second).padStart(2, '0')}.${fraction}Z`;
const observer: WindowsValidationProcess = {
  ProcessId: process.pid,
  ParentProcessId: 1,
  CommandLine: privateValue,
  CreationDate: birth(1),
};

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

it.each(
  [
    privateValue,
    JSON.stringify(observer),
    JSON.stringify([observer, null]),
    JSON.stringify([observer, observer]),
    JSON.stringify([observer, { ...observer, ProcessId: -1 }]),
    JSON.stringify([observer, { ...observer, ProcessId: process.pid + 1, CommandLine: {} }]),
  ].map((text, index) => ({ text, index })),
)('rejects malformed inventory case $index without retaining contents', ({ text }) => {
  expect(() => readWindowsValidationProcesses(() => text)).toThrow('PROCESS_SNAPSHOT_INVALID');
});

it('rejects a snapshot without the observer and keeps valid native data in memory only', () => {
  expect(() => readWindowsValidationProcesses(() => '[]')).toThrow('PROCESS_SNAPSHOT_INCOMPLETE');
  const values = readWindowsValidationProcesses(() => JSON.stringify([observer]));
  expect(values.length).toBe(1);
  expect(values[0]?.ProcessId === process.pid).toBe(true);
  expect(values[0]?.CreationDate === observer.CreationDate).toBe(true);
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

const profile = 'c:/synthetic/private/profile';
const row = (
  ProcessId: number,
  ParentProcessId = 1,
  CreationDate: string | null = birth(3),
  CommandLine: string | null = 'synthetic-child',
): WindowsValidationProcess => ({ ProcessId, ParentProcessId, CreationDate, CommandLine });
const root = (pid = 10, time = birth(10)) =>
  row(pid, process.pid, time, `chrome --user-data-dir="${profile}" --headless`);
const inventory = (...rows: WindowsValidationProcess[]) => [observer, ...rows];

/** Selector copied unchanged from 0dc13dc verify-browser.ts; synthetic data only. */
function legacySelection(rows: WindowsValidationProcess[], tracked: number[] = []) {
  const selected = new Set(tracked);
  for (const value of rows)
    if ((value.CommandLine ?? '').replace(/\\/g, '/').toLowerCase().includes(profile))
      selected.add(value.ProcessId);
  for (let changed = true; changed; ) {
    changed = false;
    for (const value of rows)
      if (selected.has(value.ParentProcessId) && !selected.has(value.ProcessId)) {
        selected.add(value.ProcessId);
        changed = true;
      }
  }
  return rows.filter((value) => selected.has(value.ProcessId)).map((value) => value.ProcessId);
}

it('reproduces 151 to 141 via stale ancestry without identifying the historical inventory', () => {
  const chrome = Array.from({ length: 10 }, (_, i) => root(10 + i));
  const unrelated = Array.from({ length: 141 }, (_, i) =>
    row(1000 + i, i ? 999 + i : 10, birth(2)),
  );
  const before = inventory(...chrome, ...unrelated);
  const tracked = legacySelection(before);
  expect(tracked).toHaveLength(151);
  expect(legacySelection(inventory(...unrelated), tracked)).toHaveLength(141);
  const repaired = new WindowsValidationProcessTracker(profile);
  expect(repaired.sample(before).remainingProcesses).toBe(10);
  expect(repaired.sample(inventory(...unrelated)).remainingProcesses).toBe(0);
});

it('reproduces 141 unrelated selections from a reused tracked PID and prevents the cascade', () => {
  const before = inventory(root());
  const tracked = legacySelection(before);
  const reused = row(10, 1, birth(20), 'unrelated-parent');
  const unrelated = Array.from({ length: 140 }, (_, i) => row(1000 + i, 10, birth(30)));
  expect(legacySelection(inventory(reused, ...unrelated), tracked)).toHaveLength(141);
  const tracker = new WindowsValidationProcessTracker(profile);
  expect(tracker.sample(before).remainingProcesses).toBe(1);
  const result = tracker.sample(inventory(reused, ...unrelated));
  expect(result.remainingProcesses).toBe(0);
  expect(result.processAccounting.reusedPids).toBe(1);
});

it('keeps a genuine surviving child after the root exits, including reparenting and null command', async () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  expect(tracker.sample(inventory(root(), row(20, 10, birth(11)))).remainingProcesses).toBe(2);
  const surviving = inventory(row(20, 1, birth(11), null));
  const result = await verifyFinalCleanup(
    () => ({ ...tracker.sample(surviving), ownershipReleased: true, contextInactive: true }),
    { maximumMs: 0 },
  );
  expect(result.verified).toBe(false);
  expect(result.immediate.remainingProcesses).toBe(1);
  expect(result.final.remainingProcesses).toBe(1);
});

it('does not propagate an absent tracked PID to older unrelated descendants', () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  tracker.sample(inventory(root()));
  expect(tracker.sample(inventory(row(20, 10, birth(2)))).remainingProcesses).toBe(0);
});

it.each(['absent', 'reused'] as const)(
  'fails uncertain unseen-child binding with a %s parent',
  (mode) => {
    const tracker = new WindowsValidationProcessTracker(profile);
    tracker.sample(inventory(root()));
    const rows = mode === 'absent' ? [] : [row(10, 1, birth(20), 'unrelated-parent')];
    expect(() => tracker.sample(inventory(...rows, row(20, 10, birth(11))))).toThrow(
      'PROCESS_IDENTITY_UNCERTAIN',
    );
  },
);

it('preserves a previously observed child even if its parent PID is reused', () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  tracker.sample(inventory(root(), row(20, 10, birth(11))));
  expect(
    tracker.sample(inventory(row(10, 1, birth(20)), row(20, 10, birth(11)))).remainingProcesses,
  ).toBe(1);
});

it('uses all seven fractional digits when distinguishing reused process lifetimes', () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  tracker.sample(inventory(root(10, birth(10, '0000001'))));
  const result = tracker.sample(inventory(row(10, 1, birth(10, '0000002'))));
  expect(result.remainingProcesses).toBe(0);
  expect(result.processAccounting.reusedPids).toBe(1);
});

it('rejects equal parent/child creation stamps as ambiguous rather than clean', async () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  const result = await verifyFinalCleanup(
    () => ({
      ...tracker.sample(inventory(root(), row(20, 10, birth(10)))),
      ownershipReleased: true,
      contextInactive: true,
    }),
    { maximumMs: 0 },
  );
  expect(result.verified).toBe(false);
  expect(result.immediate.probeFailed).toBe(true);
  expect(result.final.remainingProcesses).toBe(null);
});

it.each(['root', 'child', 'tracked', 'observer'] as const)(
  'treats missing %s birth as uncertainty',
  (role) => {
    const tracker = new WindowsValidationProcessTracker(profile);
    if (role === 'tracked') tracker.sample(inventory(root()));
    const rows =
      role === 'observer'
        ? [{ ...observer, CreationDate: null }]
        : inventory(
            role === 'root' || role === 'tracked' ? { ...root(), CreationDate: null } : root(),
            ...(role === 'child' ? [row(20, 10, null)] : []),
          );
    expect(() => tracker.sample(rows)).toThrow('PROCESS_IDENTITY_UNCERTAIN');
  },
);

it('requires identity for relevant rows even if the native field is omitted', () => {
  const missing = { ...root(), CreationDate: undefined };
  const rows = readWindowsValidationProcesses(() => JSON.stringify(inventory(missing as any)));
  expect(() => new WindowsValidationProcessTracker(profile).sample(rows)).toThrow(
    'PROCESS_IDENTITY_UNCERTAIN',
  );
});

it('allows unrelated system rows with unavailable identity without ignoring a tracked row', () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  expect(tracker.sample(inventory(row(0, 0, null, null))).remainingProcesses).toBe(0);
  tracker.sample(inventory(root()));
  expect(() => tracker.sample(inventory(row(10, 1, null, null)))).toThrow(
    'PROCESS_IDENTITY_UNCERTAIN',
  );
});

it.each([
  '2026-02-30T00:00:00.0000000Z',
  '2026-10-10T00:00:99.0000000Z',
  '2026-10-10T00:00:00.000Z',
  '2026-10-10T00:00:00.0000000+01:00',
  privateValue,
])('rejects malformed birth case %# without retaining native values', (CreationDate) => {
  expect(() =>
    readWindowsValidationProcesses(() => JSON.stringify(inventory(row(20, 1, CreationDate)))),
  ).toThrow('PROCESS_SNAPSHOT_INVALID');
});

it.each(['duplicate', 'self-parent', 'missing-observer'] as const)(
  'validates an injected %s inventory as well as native JSON',
  (kind) => {
    const rows =
      kind === 'duplicate'
        ? inventory(root(), root())
        : kind === 'self-parent'
          ? inventory(row(20, 20))
          : [root()];
    expect(() => new WindowsValidationProcessTracker(profile).sample(rows)).toThrow(
      kind === 'missing-observer' ? 'PROCESS_SNAPSHOT_INCOMPLETE' : 'PROCESS_SNAPSHOT_INVALID',
    );
  },
);

it('excludes only the validated observer and preserves its genuine Chrome child', () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  const observing = { ...observer, CommandLine: `fixture --user-data-dir="${profile}"` };
  const result = tracker.sample([observing, root(), row(30, process.pid, birth(12))]);
  expect(result.remainingProcesses).toBe(1);
});

it('handles case/slash variants and distinguishes a longer profile path', () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  expect(
    tracker.sample(
      inventory(row(10, 1, birth(10), 'chrome --user-data-dir="C:\\SYNTHETIC\\PRIVATE\\PROFILE"')),
    ).remainingProcesses,
  ).toBe(1);
  expect(
    new WindowsValidationProcessTracker(profile).sample(
      inventory(row(20, 1, birth(10), `chrome --user-data-dir=${profile}-other`)),
    ).remainingProcesses,
  ).toBe(0);
});

it('retains an unclassified profile-associated helper and never certifies clean', async () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  const rows = inventory(row(20, 1, birth(10), `helper --database=${profile}/Crashpad`));
  const result = await verifyFinalCleanup(
    () => ({ ...tracker.sample(rows), ownershipReleased: true, contextInactive: true }),
    { maximumMs: 0 },
  );
  expect(result.verified).toBe(false);
  expect(result.final.processAccounting?.unclassifiedProfileReferences).toBe(1);
});

it('redacts uncertainty errors and permanently fails cleanup on a missing birth probe', async () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  let calls = 0;
  const result = await verifyFinalCleanup(
    () => ({
      ...tracker.sample(++calls === 1 ? inventory({ ...root(), CreationDate: null }) : inventory()),
      ownershipReleased: true,
      contextInactive: true,
    }),
    { maximumMs: 0 },
  );
  expect(result.verified).toBe(false);
  expect(result.immediate.probeFailed).toBe(true);
  expect(result.final.remainingProcesses).toBe(0);
  expect(offlineLifecycleFailureCode(new Error('PROCESS_IDENTITY_UNCERTAIN'))).toBe(
    'PROCESS_IDENTITY_UNCERTAIN',
  );
  expect(JSON.stringify(result)).not.toContain(privateValue);
});

it('fails a three-snapshot unseen old child when the reused PID is a new profile root', async () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  tracker.sample(inventory(root()));
  let checks = 0;
  const result = await verifyFinalCleanup(
    () => ({
      ...tracker.sample(
        ++checks === 1
          ? inventory(root(10, birth(20)), row(30, 10, birth(11)))
          : inventory(row(30, 10, birth(11))),
      ),
      ownershipReleased: true,
      contextInactive: true,
    }),
    { maximumMs: 0 },
  );
  expect(result.immediate.probeFailed).toBe(true);
  expect(result.final.probeFailed).toBe(true);
  expect(result.verified).toBe(false);
});

it('retains older parent lifetimes after observing a new profile lifetime without children', () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  tracker.sample(inventory(root()));
  expect(tracker.sample(inventory(root(10, birth(20)))).remainingProcesses).toBe(1);
  expect(() => tracker.sample(inventory(row(30, 10, birth(11))))).toThrow(
    'PROCESS_IDENTITY_UNCERTAIN',
  );
});

it('counts reparenting against the original birth record at both checks', () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  tracker.sample(inventory(root(), row(20, 10, birth(11))));
  const rows = inventory(row(20, 1, birth(11)));
  expect(tracker.sample(rows).processAccounting.reparented).toBe(1);
  expect(tracker.sample(rows).processAccounting.reparented).toBe(1);
});

it.each(['pid', 'parent'] as const)(
  'rejects out-of-range %s identifiers without native disclosure',
  (field) => {
    const value = row(20);
    if (field === 'pid') value.ProcessId = 0x100000000;
    else value.ParentProcessId = 0x100000000;
    expect(() => new WindowsValidationProcessTracker(profile).sample(inventory(value))).toThrow(
      'PROCESS_SNAPSHOT_INVALID',
    );
  },
);

it('bounds all tracked lifetimes, including repeated reuse of one PID, and cannot clear after exceeding it', () => {
  const tracker = new WindowsValidationProcessTracker(profile);
  for (let i = 0; i < 10000; i++)
    tracker.sample(inventory(root(10, birth(10, String(i).padStart(7, '0')))));
  expect(() => tracker.sample(inventory(root(10, birth(10, '0010000'))))).toThrow(
    'PROCESS_TRACKING_LIMIT',
  );
  expect(() => tracker.sample(inventory())).toThrow('PROCESS_TRACKING_LIMIT');
});
