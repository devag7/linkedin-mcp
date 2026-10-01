import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { BudgetTracker } from '../src/safety/budgets.js';
import { StateLock, withStateLock } from '../src/safety/state-lock.js';
import { verifiedAccountKey, AccountBinding } from '../src/browser/account.js';
import type { BrowserEngine } from '../src/browser/engine.js';
import type { VoyagerClient } from '../src/browser/voyager.js';
import { Guard, ACTIONS } from '../src/browser/guard.js';
import { SerialQueue } from '../src/safety/queue.js';
import { HumanPacer } from '../src/safety/pacer.js';
import { CircuitBreaker } from '../src/safety/circuit-breaker.js';
let dir: string;
const children: ChildProcess[] = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'linkedin-shared-state-'));
});
afterEach(async () => {
  for (const child of children.splice(0))
    if (child.exitCode === null && child.signalCode === null) {
      const done = once(child, 'exit');
      child.kill('SIGKILL');
      await done;
    }
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});
const me = (id: string) => ({
  data: { '*miniProfile': `urn:li:fs_miniProfile:${id}` },
  included: [{ entityUrn: `urn:li:fs_miniProfile:${id}`, publicIdentifier: 'can-change' }],
});
function budget(account: string | null = 'shared', options = {}) {
  return new BudgetTracker(account, { storagePath: join(dir, 'budget.json'), ...options });
}
const fingerprint = 'a'.repeat(64);
function worker(mode: string, file: string, account = 'shared', prefix = 'worker') {
  const child = fork(resolve('tests/fixtures/state-worker.ts'), [mode, file, account, prefix], {
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  children.push(child);
  return child;
}
function message(child: ChildProcess): Promise<Record<string, unknown>> {
  return new Promise((resolveMessage, reject) => {
    const onMessage = (value: Record<string, unknown>) => {
      cleanup();
      resolveMessage(value);
    };
    const onExit = () => {
      cleanup();
      reject(new Error('Fixture exited before sending its result'));
    };
    const cleanup = () => {
      child.off('message', onMessage);
      child.off('exit', onExit);
      child.off('error', reject);
    };
    child.once('message', onMessage);
    child.once('exit', onExit);
    child.once('error', reject);
  });
}

describe('verified account binding', () => {
  it('hashes the opaque own-member ID, independent of profile folder and public username', () => {
    const first = verifiedAccountKey(me('private-own-id'));
    expect(first).toMatch(/^acct_[a-f0-9]{64}$/);
    expect(first).not.toContain('private-own-id');
    expect(
      verifiedAccountKey({
        ...me('private-own-id'),
        included: [{ ...me('private-own-id').included[0], publicIdentifier: 'renamed' }],
      }),
    ).toBe(first);
    expect(verifiedAccountKey(me('different-id'))).not.toBe(first);
  });
  it.each([
    null,
    [],
    { included: 'invalid' },
    {},
    { included: [] },
    { included: [...me('one').included, ...me('two').included] },
    { data: { '*miniProfile': 'invalid' }, included: me('one').included },
    { data: me('one').data, included: me('two').included },
  ])('refuses unresolved or ambiguous /me identity: %j', (response) => {
    expect(() => verifiedAccountKey(response)).toThrow('could not be verified');
  });
  it('cannot spend allowance until identity is bound and never rebinds a running account', () => {
    const b = budget(null);
    expect(b.snapshot().accountResolved).toBe(false);
    expect(() => b.reserveWrite('likes', 'operation-one', fingerprint)).toThrow(
      'not been verified',
    );
    b.bindAccount(verifiedAccountKey(me('one')));
    b.reserveWrite('likes', 'operation-one', fingerprint);
    expect(() => b.bindAccount(verifiedAccountKey(me('two')))).toThrow('account changed');
    expect(readFileSync(join(dir, 'budget.json'), 'utf8')).not.toContain('urn:li');
    expect(
      Object.keys(JSON.parse(readFileSync(join(dir, 'budget.json'), 'utf8')).accounts),
    ).toEqual([verifiedAccountKey(me('one'))]);
  });
  it('checks once per browser launch, force-checks writes and latches a changed-account stop', async () => {
    let epoch = 1;
    const engine = {
      ensureContext: vi.fn(async () => {}),
      get sessionEpoch() {
        return epoch;
      },
    } as unknown as BrowserEngine;
    const get = vi.fn(async () => me('one'));
    const binding = new AccountBinding(
      engine,
      { voyagerGet: get } as unknown as VoyagerClient,
      budget(null),
    );
    await binding.ensure();
    await binding.ensure();
    expect(get).toHaveBeenCalledTimes(1);
    await binding.ensure(true);
    expect(get).toHaveBeenCalledTimes(2);
    epoch++;
    await binding.ensure();
    expect(get).toHaveBeenCalledTimes(3);
    get.mockResolvedValue(me('two'));
    await expect(binding.ensure(true)).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
    get.mockResolvedValue(me('one'));
    await expect(binding.ensure()).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
    expect(get).toHaveBeenCalledTimes(4);
  });
  it('prepares the account inside the guard before checking its allowance', async () => {
    const b = budget(null);
    const prepare = vi.fn(async () => b.bindAccount(verifiedAccountKey(me('one'))));
    const g = new Guard(
      new SerialQueue(),
      { waitBefore: async () => {} } as HumanPacer,
      b,
      new CircuitBreaker(),
      undefined,
      prepare,
    );
    const result = await g.run(ACTIONS.search, async () => 'fixture');
    expect(result).toBe('fixture');
    expect(prepare).toHaveBeenCalled();
    expect(b.snapshot().actions.searches.used).toBe(1);
  });
});

describe('state transactions and conservative migration', () => {
  it('reloads under the lock and preserves updates made by another tracker/account', () => {
    const first = budget('one');
    const second = budget('two');
    first.record('likes');
    second.record('comments');
    first.record('likes');
    expect(first.snapshot().actions.likes.used).toBe(2);
    expect(second.snapshot().actions.comments.used).toBe(1);
    const disk = JSON.parse(readFileSync(join(dir, 'budget.json'), 'utf8'));
    expect(Object.keys(disk.accounts)).toEqual(['one', 'two']);
    expect(statSync(join(dir, 'budget.json')).mode & 0o777).toBe(0o600);
  });
  it('reserves and commits with a stale tracker without overwriting other operations', () => {
    const first = budget();
    const second = budget();
    first.reserveWrite('likes', 'operation-one', fingerprint);
    second.reserveWrite('comments', 'operation-two', fingerprint);
    first.finishWrite('operation-one', { status: 'ok', ok: true, httpStatus: 204 });
    second.finishWrite('operation-two', { status: 'failed', ok: false, httpStatus: 400 });
    expect(first.snapshot().writes.likes?.successful).toBe(1);
    expect(first.snapshot().writes.comments?.attempted).toBe(1);
    expect(second.previousWrite('operation-one', fingerprint)?.status).toBe('ok');
    expect(first.snapshot().actions.likes.used).toBe(2);
  });
  it('a duplicate atomic reservation returns prior state without spending allowance again', () => {
    const first = budget();
    const second = budget();
    first.reserveWrite('likes', 'operation-one', fingerprint);
    expect(second.reserveWrite('likes', 'operation-one', fingerprint)).toMatchObject({
      status: 'unknown',
      replayed: true,
    });
    expect(second.snapshot().writes.likes?.attempted).toBe(1);
    expect(() => second.reserveWrite('likes', 'operation-one', 'b'.repeat(64))).toThrow(
      'different inputs',
    );
  });
  it('applies unattributed default counts without migrating identity or claiming its success', () => {
    const old = budget('default');
    old.record('searches');
    old.reserveWrite('likes', 'legacy-operation', fingerprint);
    old.finishWrite('legacy-operation', { status: 'ok', ok: true, httpStatus: 204 });
    const bound = budget(null);
    bound.bindAccount(verifiedAccountKey(me('one')));
    expect(bound.snapshot().actions.searches.used).toBe(1);
    expect(bound.snapshot().legacyAllowanceApplied).toBe(true);
    expect(bound.previousWrite('legacy-operation', fingerprint)).toMatchObject({
      status: 'unknown',
      ok: false,
    });
    expect(bound.snapshot().writes).toEqual({});
    bound.record('searches');
    const disk = JSON.parse(readFileSync(join(dir, 'budget.json'), 'utf8'));
    expect(disk.accounts.default.today.counts.searches).toBe(1);
    expect(disk.accounts[verifiedAccountKey(me('one'))].today.counts.searches).toBe(1);
    expect(bound.snapshot().actions.searches.used).toBe(2);
  });
  it('retains uncertain legacy invites across days and cannot improve acceptance with unattributed successes', () => {
    let now = new Date(2026, 9, 1, 12).getTime();
    const options = { clock: () => now, pendingInviteCeiling: 0 };
    const old = budget('default', options);
    old.reserveWrite('connections', 'legacy-invite', fingerprint);
    now += 86400000;
    const bound = budget(null, options);
    bound.bindAccount(verifiedAccountKey(me('one')));
    expect(bound.check('connections').allowed).toBe(false);
    expect(bound.snapshot().actions.connections.used).toBe(0);
  });
  it.each(['corrupt', 'removed'])(
    'stops an already running tracker when its state is %s',
    (failure) => {
      const b = budget();
      b.record('likes');
      if (failure === 'removed') rmSync(join(dir, 'budget.json'));
      else writeFileSync(join(dir, 'budget.json'), '{}');
      expect(() => b.reserveWrite('likes', 'operation-one', fingerprint)).toThrow(
        'unreadable or invalid',
      );
      expect(b.snapshot().storageHealthy).toBe(false);
      expect(() => b.check('searches')).toThrow('storage failed');
    },
  );
  it('fails closed on a held/orphaned lock without resetting counters or stealing by age', () => {
    const b = budget();
    b.record('likes');
    const lock = new StateLock(join(dir, 'budget.json'));
    lock.acquire();
    expect(() => b.reserveWrite('likes', 'operation-one', fingerprint)).toThrow(
      'locked by another transaction',
    );
    expect(b.snapshot().actions.likes.used).toBe(1);
    expect(statSync(lock.directory).mode & 0o777).toBe(0o700);
    lock.release();
    b.reserveWrite('likes', 'operation-one', fingerprint);
    expect(b.snapshot().actions.likes.used).toBe(2);
  });
  it('aliases share one lock and invalid owner metadata is never silently removed', () => {
    mkdirSync(join(dir, 'real'));
    symlinkSync(join(dir, 'real'), join(dir, 'alias'));
    const first = new StateLock(join(dir, 'real', 'state'));
    const second = new StateLock(join(dir, 'alias', 'state'));
    first.acquire();
    expect(() => second.acquire()).toThrow('locked by another transaction');
    writeFileSync(join(first.directory, 'owner.json'), '{}');
    expect(() => first.release()).toThrow('ownership changed');
    expect(existsSync(first.directory)).toBe(true);
  });
  it('releases a shared lock after a failed mutation, preserving the saved reservation', () => {
    const b = budget();
    b.reserveWrite('likes', 'operation-one', fingerprint);
    expect(() =>
      withStateLock(join(dir, 'budget.json'), () => {
        throw new Error('fixture');
      }),
    ).toThrow('fixture');
    b.finishWrite('operation-one', { status: 'ok', ok: true, httpStatus: 204 });
    expect(b.previousWrite('operation-one', fingerprint)?.ok).toBe(true);
  });
});

it.each(['separate-ids', 'same-id'])(
  'two independent Node processes respect shared reservation policy: %s',
  async (mode) => {
    const file = join(dir, 'budget.json');
    const first = worker(mode, file, 'shared', 'first');
    const second = worker(mode, file, 'shared', 'second');
    await Promise.all([message(first), message(second)]);
    const results = [message(first), message(second)];
    first.send('go');
    second.send('go');
    const returned = await Promise.all(results);
    const submitted = returned.reduce((sum, value) => sum + Number(value.submitted), 0);
    const b = budget();
    expect(submitted).toBe(mode === 'same-id' ? 1 : 5);
    expect(b.snapshot().writes.likes?.attempted).toBe(submitted);
    expect(b.snapshot().actions.likes.used).toBe(submitted);
  },
  15000,
);

it('a second process cannot own an idle profile through a symlink alias; disposal releases it', async () => {
  const file = join(dir, 'profile');
  mkdirSync(file);
  const alias = join(dir, 'alias');
  symlinkSync(file, alias);
  const first = worker('profile', file);
  await expect(message(first)).resolves.toEqual({ ready: true });
  const blocked = worker('profile', alias);
  await expect(message(blocked)).resolves.toEqual({ code: 'PROFILE_IN_USE' });
  const exited = once(first, 'exit');
  first.send('stop');
  await exited;
  const next = worker('profile', alias);
  await expect(message(next)).resolves.toEqual({ ready: true });
  const done = once(next, 'exit');
  next.send('stop');
  await done;
}, 15000);

it('a crashed profile owner leaves a hard refusal until the human repairs its orphaned lock', async () => {
  const file = join(dir, 'profile');
  const first = worker('profile', file);
  await message(first);
  const exit = once(first, 'exit');
  first.kill('SIGKILL');
  await exit;
  const second = worker('profile', file);
  await expect(message(second)).resolves.toEqual({ code: 'PROFILE_IN_USE' });
  expect(existsSync(`${file}.owner.lock`)).toBe(true);
}, 15000);

it('production warmup progresses from first verified tool use and survives restart without inventing LinkedIn account age', () => {
  let now = Date.UTC(2026, 9, 1);
  const file = join(dir, 'warmup.json');
  const key = `acct_${'a'.repeat(64)}`;
  const first = new BudgetTracker(null, { storagePath: file, clock: () => now });
  first.bindAccount(key);
  expect(first.snapshot().ageWeek).toBe(1);
  expect(first.check('messages').allowed).toBe(false);
  now += 7 * 24 * 60 * 60 * 1000;
  const second = new BudgetTracker(null, { storagePath: file, clock: () => now });
  second.bindAccount(key);
  expect(second.snapshot().ageWeek).toBe(2);
  expect(second.check('messages').allowed).toBe(true);
  expect(second.snapshot().actions.messages.cap).toBe(10);
  now -= 8 * 24 * 60 * 60 * 1000; // A backwards clock cannot grant wider allowances.
  expect(second.snapshot().ageWeek).toBe(1);
  expect(second.check('messages').allowed).toBe(false);
});
