/** Synthetic inventories and disposable Node fixtures only; never an account/profile. */
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  parseValidationProcesses,
  readValidationProcesses,
  ValidationProcessTracker,
  PROCESS_ACCOUNTING_KEYS,
  type ValidationProcess,
} from '../scripts/validation-processes.js';
import { verifyFinalCleanup } from '../scripts/validation-cleanup.js';
const profile = '/synthetic/private/profile';
const row = (
  pid: number,
  parent = 1,
  command = 'synthetic-child',
  start = 'birth-a',
  state = 'S',
): ValidationProcess => ({ pid, parent, command, start, state });
const root = (pid = 10) => row(pid, 1, `chrome --user-data-dir=${profile} --remote-debugging-pipe`);

it.each([
  'reader /synthetic/private/profile-other',
  'chrome --user-data-dir=/synthetic/private/profile-other --headless',
])('does not attribute a distinct path prefix as a profile root: %s', (command) => {
  const result = new ValidationProcessTracker(profile).sample([row(10, 1, command)]);
  expect(result.remainingProcesses).toBe(0);
  expect(result.processAccounting.unclassifiedProfileReferences).toBe(0);
});
it.each([
  'reader /synthetic/private/profile',
  'fixture note=--user-data-dir=/synthetic/private/profile --headless',
  'synthetic-auxiliary --database=/synthetic/private/profile/Crashpad',
  'chrome --user-data-dir=/synthetic/private/profile/subdirectory --headless',
])('retains an unclassified profile footprint as uncertain: %s', async (command) => {
  const tracker = new ValidationProcessTracker(profile);
  const result = tracker.sample([row(10, 1, command)]);
  expect(result.remainingProcesses).toBe(1);
  expect(result.processAccounting.directProfileRoots).toBe(0);
  expect(result.processAccounting.unclassifiedProfileReferences).toBe(1);
  // Its birth stays tracked even if the footprint disappears from its command.
  expect(tracker.sample([row(10, 1, 'changed command')]).remainingProcesses).toBe(1);
  const cleanup = await verifyFinalCleanup(
    () => ({ ...result, ownershipReleased: true, contextInactive: true }),
    { maximumMs: 0 },
  );
  expect(cleanup.verified).toBe(false);
  expect(tracker.sample([row(99)]).remainingProcesses).toBe(0);
});
it('never accepts inconsistent zero process counts with an uncertain profile reference', async () => {
  const counts = Object.fromEntries(PROCESS_ACCOUNTING_KEYS.map((key) => [key, 0]));
  const result = await verifyFinalCleanup(
    () => ({
      remainingProcesses: 0,
      ownershipReleased: true,
      contextInactive: true,
      processAccounting: { ...counts, unclassifiedProfileReferences: 1 } as any,
    }),
    { maximumMs: 0 },
  );
  expect(result.verified).toBe(false);
});
it.each([
  `chrome --user-data-dir=${profile}`,
  `chrome --user-data-dir="${profile}" --headless`,
  `chrome --user-data-dir='${profile}' --headless`,
  `chrome --headless --user-data-dir=${profile} --remote-debugging-pipe about:blank`,
])('recognizes an exact profile flag: %s', (command) => {
  expect(
    new ValidationProcessTracker(profile).sample([row(10, 1, command)]).remainingProcesses,
  ).toBe(1);
});
it('fails closed on flattened arguments whose profile boundary cannot be established', () => {
  expect(() =>
    new ValidationProcessTracker(profile).sample([
      row(10, 1, `chrome --user-data-dir=${profile} suffix`),
    ]),
  ).toThrow('PROCESS_ARGUMENT_AMBIGUOUS');
});
it('handles profile spaces without treating a longer unquoted path as the same profile', () => {
  const tracker = new ValidationProcessTracker('/synthetic/private profile');
  expect(
    tracker.sample([row(10, 1, 'chrome --user-data-dir=/synthetic/private profile --headless')])
      .remainingProcesses,
  ).toBe(1);
  expect(() =>
    new ValidationProcessTracker('/synthetic/private profile').sample([
      row(10, 1, 'chrome --user-data-dir=/synthetic/private profile longer'),
    ]),
  ).toThrow('PROCESS_ARGUMENT_AMBIGUOUS');
});
it.each([`chrome --user-data-dir="${profile}`, `chrome --user-data-dir='${profile}'suffix`])(
  'fails closed on an uncertain quoted profile boundary: %s',
  (command) => {
    expect(() => new ValidationProcessTracker(profile).sample([row(10, 1, command)])).toThrow(
      'PROCESS_ARGUMENT_AMBIGUOUS',
    );
  },
);
it('counts tracked reparented descendants until their original process identity disappears', () => {
  const tracker = new ValidationProcessTracker(profile);
  expect(tracker.sample([root(), row(11, 10)]).remainingProcesses).toBe(2);
  const orphan = tracker.sample([row(11, 1)]);
  expect(orphan.remainingProcesses).toBe(1);
  expect(orphan.processAccounting.reparented).toBe(1);
  expect(tracker.sample([row(99)]).remainingProcesses).toBe(0);
});
it('persists a new child first seen during polling even after its parent exits', () => {
  const tracker = new ValidationProcessTracker(profile);
  tracker.sample([root()]);
  expect(tracker.sample([root(), row(11, 10)]).remainingProcesses).toBe(2);
  expect(tracker.sample([row(11, 1)]).remainingProcesses).toBe(1);
});
it('does not attribute an unrelated recycled PID or its children to the old browser', () => {
  const tracker = new ValidationProcessTracker(profile);
  tracker.sample([root(), row(11, 10)]);
  const result = tracker.sample([row(10, 1, 'unrelated', 'birth-b'), row(12, 10)]);
  expect(result.remainingProcesses).toBe(0);
  expect(result.processAccounting.reusedPids).toBe(1);
});
it('still tracks a recycled PID if its new process actually owns the exact profile', () => {
  const tracker = new ValidationProcessTracker(profile);
  tracker.sample([root()]);
  const result = tracker.sample([{ ...root(), start: 'birth-b' }, row(11, 10)]);
  expect(result.remainingProcesses).toBe(2);
  expect(result.processAccounting.reusedPids).toBe(1);
});
it('conservatively counts a same-stamp PID and zombie rather than certifying exit', () => {
  const tracker = new ValidationProcessTracker(profile);
  tracker.sample([root(), row(11, 10)]);
  const result = tracker.sample([row(11, 1, '<defunct>', 'birth-a', 'Z')]);
  expect(result.remainingProcesses).toBe(1);
  expect(result.processAccounting.zombies).toBe(1);
});
it.each([
  { rows: [row(10), row(10)] },
  { rows: [row(10, 10)] },
  { rows: [{ ...root(), start: '' }] },
  { rows: [{ ...root(), pid: NaN }] },
])('rejects an invalid or duplicate inventory rather than manufacturing zero', ({ rows }) => {
  expect(() => new ValidationProcessTracker(profile).sample(rows)).toThrow(
    'PROCESS_SNAPSHOT_INVALID',
  );
});
it('rejects an empty inventory rather than certifying that all processes exited', () => {
  expect(() => new ValidationProcessTracker(profile).sample([])).toThrow('PROCESS_SNAPSHOT_EMPTY');
});
it('rejects malformed/empty ps output and normalizes birth-stamp spacing', () => {
  expect(() => parseValidationProcesses('private-invalid-line')).toThrow(
    'PROCESS_SNAPSHOT_INVALID',
  );
  expect(() => parseValidationProcesses('')).toThrow('PROCESS_SNAPSHOT_EMPTY');
  expect(
    parseValidationProcesses(' 10 1 S Thu Oct  8 12:00:00 2026 synthetic-command')[0]?.start,
  ).toBe('Thu Oct 8 12:00:00 2026');
});
it('redacts native probe errors including partial stdout before the runner preflight', () => {
  const secret = 'PRIVATE-PROCESS-COMMAND-PATH';
  const nativeError = Object.assign(new Error(secret), { stdout: secret, stderr: secret });
  let observed: unknown;
  try {
    readValidationProcesses(() => {
      throw nativeError;
    });
  } catch (error) {
    observed = error;
  }
  expect(observed).toBeInstanceOf(Error);
  expect((observed as Error).message).toBe('PROCESS_SNAPSHOT_FAILED');
  expect(String(observed) + JSON.stringify(observed)).not.toContain(secret);
});
it('rejects an incomplete native inventory lacking the observer process', () => {
  expect(() => readValidationProcesses(() => '0 0 S Thu Oct 8 12:00:00 2026 kernel')).toThrow(
    'PROCESS_SNAPSHOT_INCOMPLETE',
  );
});
it.skipIf(process.platform === 'win32')(
  'captures native subprocess stderr before a failed preflight',
  () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-ps-failure-')));
    try {
      writeFileSync(
        join(dir, 'ps'),
        "#!/bin/sh\nprintf '%s' 'PRIVATE-NATIVE-INVENTORY' >&2\nexit 1\n",
        { mode: 0o700 },
      );
      const result = spawnSync(
        process.execPath,
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          `import {readValidationProcesses} from ${JSON.stringify(new URL('../scripts/validation-processes.ts', import.meta.url).href)};
      try {readValidationProcesses();} catch(error) {console.log(error.message);}`,
        ],
        { env: { ...process.env, PATH: dir }, encoding: 'utf8', timeout: 10000 },
      );
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe('PROCESS_SNAPSHOT_FAILED');
      expect(result.stderr).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
it('keeps process identity and commands out of the persisted cleanup report', async () => {
  const tracker = new ValidationProcessTracker(profile);
  let phase = 0;
  const result = await verifyFinalCleanup(
    () => ({
      ...tracker.sample(++phase === 1 ? [root(), row(11, 10)] : [row(11, 1)]),
      ownershipReleased: true,
      contextInactive: true,
    }),
    { maximumMs: 0 },
  );
  expect(result.verified).toBe(false);
  expect(result.final.processAccounting?.trackedAlive).toBe(1);
  const encoded = JSON.stringify(result);
  expect(encoded).not.toMatch(/synthetic|private|birth-a|chrome|command|start|\"pid\"|\"parent\"/);
  expect(Object.keys(result.final.processAccounting!)).toEqual([...PROCESS_ACCOUNTING_KEYS]);
});
it('strips arbitrary diagnostic extras and rejects malformed counters', async () => {
  const counts = Object.fromEntries(PROCESS_ACCOUNTING_KEYS.map((key) => [key, 0]));
  const probe = (extra: Record<string, unknown>) =>
    verifyFinalCleanup(
      () => ({
        remainingProcesses: 0,
        ownershipReleased: true,
        contextInactive: true,
        processAccounting: { ...counts, ...extra } as any,
      }),
      { maximumMs: 0 },
    );
  expect(JSON.stringify(await probe({ privateValue: 'PRIVATE-COMMAND-IDENTIFIER' }))).not.toContain(
    'PRIVATE-COMMAND',
  );
  expect((await probe({ trackedAlive: -1 })).verified).toBe(false);
});
it.skipIf(process.platform === 'win32')(
  'observes a disposable profile-flag process and its delayed exit through the native adapter',
  async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-process-fixture-')));
    const tracker = new ValidationProcessTracker(join(dir, 'profile'));
    const child = spawn(
      process.execPath,
      [
        '-e',
        "process.send('ready'); process.on('message',ms=>setTimeout(()=>process.exit(0),ms)); setInterval(()=>{},10000)",
        '--',
        `--user-data-dir=${join(dir, 'profile')}`,
      ],
      { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] },
    );
    const exited = once(child, 'exit');
    try {
      await once(child, 'message');
      expect(tracker.sample(readValidationProcesses()).remainingProcesses).toBe(1);
      let exitRequested = false;
      const result = await verifyFinalCleanup(
        () => {
          const sample = tracker.sample(readValidationProcesses());
          if (!exitRequested) {
            child.send(300);
            exitRequested = true;
          }
          return { ...sample, ownershipReleased: true, contextInactive: true };
        },
        { maximumMs: 2000, intervalMs: 25 },
      );
      expect(result.immediate.remainingProcesses).toBe(1);
      expect(result.final.remainingProcesses).toBe(0);
      expect(result.verified).toBe(true);
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await exited;
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
