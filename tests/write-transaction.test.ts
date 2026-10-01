import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { Page } from 'patchright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Guard, ACTIONS } from '../src/browser/guard.js';
import { VoyagerClient } from '../src/browser/voyager.js';
import type { BrowserEngine } from '../src/browser/engine.js';
import { BrowserSafety } from '../src/browser/safety.js';
import { SerialQueue } from '../src/safety/queue.js';
import { HumanPacer } from '../src/safety/pacer.js';
import { BudgetTracker } from '../src/safety/budgets.js';
import { CircuitBreaker } from '../src/safety/circuit-breaker.js';
import { createServer } from '../src/server.js';
import { BrowserEngine as RealBrowserEngine } from '../src/browser/engine.js';
import { loadConfig } from '../src/config/env.js';
import { CircuitFileStorage } from '../src/safety/circuit-storage.js';
import { registerWriteTools } from '../src/tools/write.js';
import { Logger } from '../src/types.js';

let dir: string;
const logger = new Logger('error');
const cleanups: Array<() => Promise<void>> = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'linkedin-write-'));
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});
const response = (status = 201, body = '{"value":"urn:li:fsd_invitation:fixture"}') => ({
  status,
  ok: status >= 200 && status < 300,
  body,
  type: 'basic',
  url: 'https://www.linkedin.com/voyager/api/fixture',
});
function setup(raw = response(), concurrency = 1) {
  const path = join(dir, 'budget.json');
  const budget = new BudgetTracker('fixture', { storagePath: path });
  budget.setAccountAgeWeek(4);
  const breaker = new CircuitBreaker({
    storage: new CircuitFileStorage(join(dir, 'circuit.json')),
  });
  const queue = new SerialQueue({ concurrency });
  const guard = new Guard(queue, { waitBefore: async () => {} } as HumanPacer, budget, breaker);
  const evaluate = vi.fn(async () => raw);
  const engine = {
    getFeedPage: vi.fn(async () => ({ evaluate }) as unknown as Page),
  } as unknown as BrowserEngine;
  const voyager = new VoyagerClient(engine, logger, new BrowserSafety(breaker));
  const call = (operationId = randomUUID(), inputs: unknown = { target: 'fixture' }) =>
    guard.runWrite(ACTIONS.connect, 'connect', inputs, operationId, (before) =>
      voyager.voyagerPostRaw('/fixture', {}, before),
    );
  return { path, budget, breaker, guard, queue, evaluate, engine, voyager, call };
}
async function protocol(fixture: ReturnType<typeof setup>, fullServer = false) {
  let server = new McpServer({ name: 'write-fixture', version: '1' });
  if (fullServer) {
    const engine = new RealBrowserEngine(
      { ...loadConfig(), LINKEDIN_PROFILE_DIR: join(dir, 'profile') },
      logger,
      false,
      new BrowserSafety(fixture.breaker),
    );
    server = createServer(
      logger,
      {
        engine,
        voyager: fixture.voyager,
        guard: fixture.guard,
        budget: fixture.budget,
        breaker: fixture.breaker,
        queue: fixture.queue,
        pacer: new HumanPacer(),
      },
      { writesEnabled: true, experimentalMessagesEnabled: true },
    ).server;
    cleanups.push(() => engine.dispose());
  } else {
    registerWriteTools(server, fixture.voyager, fixture.guard, logger, {
      writesEnabled: true,
      experimentalMessagesEnabled: true,
    });
  }
  const client = new Client({ name: 'fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  expect((await client.listTools()).tools).toHaveLength(fullServer ? 22 : 5);
  cleanups.push(async () => {
    await client.close();
    await server.close();
  });
  return async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    return JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
  };
}

describe('guarded write accounting', () => {
  it('persists a reservation before the browser evaluates and confirms a connection once', async () => {
    const f = setup();
    f.evaluate.mockImplementation(async () => {
      const saved = new BudgetTracker('fixture', { storagePath: f.path });
      expect(saved.snapshot().writes.connections).toEqual({
        attempted: 1,
        successful: 0,
        uncertain: 1,
      });
      expect(saved.snapshot().actions.connections.used).toBe(1);
      expect(saved.getPendingInvites()).toBe(0);
      return response();
    });
    expect(await f.call()).toMatchObject({ status: 'ok', replayed: false });
    expect(f.budget.snapshot().writes.connections).toEqual({
      attempted: 1,
      successful: 1,
      uncertain: 0,
    });
    expect(f.budget.getPendingInvites()).toBe(1);
  });
  it.each([
    [200, '{"data":{"errors":[{"message":"Invalid share"}]}}', 'failed'],
    [409, '{}', 'failed'],
    [409, '{"message":"Duplicate invitation"}', 'duplicate'],
    [400, '{"message":"Already connected"}', 'already_connected'],
    [422, '{"message":"not allowed"}', 'not_allowed'],
  ])(
    'counts HTTP %s %s as an attempt, not a successful connection',
    async (status, body, expected) => {
      const f = setup(response(status as number, body as string));
      expect((await f.call()).status).toBe(expected);
      expect(f.budget.snapshot().writes.connections).toEqual({
        attempted: 1,
        successful: 0,
        uncertain: 0,
      });
      expect(f.budget.snapshot().actions.connections.used).toBe(1);
      expect(f.budget.snapshot().pendingInvites).toBe(0);
    },
  );
  it.each([
    [429, '{}', 'quota_exhausted'],
    [403, '{}', 'restricted'],
    [200, '{"status":429}', 'quota_exhausted'],
    [200, '{"status":403}', 'restricted'],
  ])('trips on returned %s before queued work can submit', async (status, body, expected) => {
    const f = setup(response(status as number, body as string));
    const results = await Promise.allSettled([f.call(), f.call()]);
    expect(results[0]).toMatchObject({ status: 'fulfilled', value: { status: expected } });
    expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'CIRCUIT_OPEN' } });
    expect(f.evaluate).toHaveBeenCalledTimes(1);
    expect(f.budget.snapshot().pendingInvites).toBe(0);
  });
  it('keeps a timeout uncertain, debited and repeatable as a lookup after restart', async () => {
    const f = setup();
    f.evaluate.mockRejectedValue(new Error('PRIVATE_MESSAGE network disconnected'));
    const id = randomUUID();
    const outcome = await f.call(id);
    expect(outcome).toMatchObject({ status: 'unknown', ok: false, operationId: id });
    expect(outcome.detail).not.toContain('PRIVATE_MESSAGE');
    const restarted = setup();
    expect(await restarted.call(id)).toMatchObject({ status: 'unknown', replayed: true });
    expect(restarted.evaluate).not.toHaveBeenCalled();
    expect(restarted.budget.snapshot().writes.connections).toEqual({
      attempted: 1,
      successful: 0,
      uncertain: 1,
    });
  });
  it('does not debit a browser preflight failure', async () => {
    const f = setup();
    vi.mocked(f.engine.getFeedPage).mockRejectedValue(new Error('browser unavailable'));
    await expect(f.call()).rejects.toThrow('browser unavailable');
    expect(f.budget.snapshot().actions.connections.used).toBe(0);
    expect(f.evaluate).not.toHaveBeenCalled();
  });
  it('preserves the hard stop when a submitted write encounters a checkpoint', async () => {
    const f = setup(response(999, '{}'));
    expect(await f.call()).toMatchObject({ status: 'unknown' });
    expect(f.breaker.isGlobalOpen()).toBe(true);
    await expect(f.call()).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
    expect(f.evaluate).toHaveBeenCalledTimes(1);
  });
  it('does not submit the same ID twice with concurrent callers', async () => {
    const f = setup(response(), 2);
    const id = randomUUID();
    const results = await Promise.all([f.call(id), f.call(id)]);
    expect(f.evaluate).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => r.replayed)).toHaveLength(1);
    expect(f.budget.snapshot().actions.connections.used).toBe(1);
  });
  it('rejects ID reuse for a different payload', async () => {
    const f = setup();
    const id = randomUUID();
    await f.call(id);
    await expect(f.call(id, { target: 'different' })).rejects.toThrow('different inputs');
    expect(f.evaluate).toHaveBeenCalledTimes(1);
  });
  it('retrieves a previous quota result even while the breaker is open', async () => {
    const f = setup(response(429, '{}'));
    const id = randomUUID();
    await f.call(id);
    expect(await f.call(id)).toMatchObject({ status: 'quota_exhausted', replayed: true });
    expect(f.evaluate).toHaveBeenCalledTimes(1);
  });
  it('counts mixed likes/comments once each, including the combined cap', () => {
    const budget = new BudgetTracker('fixture', {
      storagePath: join(dir, 'mixed.json'),
      combinedWriteCap: 3,
    });
    budget.record('likes');
    budget.record('comments');
    budget.record('likes');
    expect(budget.snapshot().actions.likes.used).toBe(3);
    expect(budget.snapshot().actions.comments.used).toBe(3);
    expect(budget.check('follows').allowed).toBe(false);
  });
});

describe('write tool protocol integration', () => {
  const cases = [
    ['connect_with_person', { profile_id: 'fixture' }, 'connections'],
    ['send_message', { thread_id: '2-fixture', message: 'PRIVATE_MESSAGE' }, 'messages'],
    ['create_post', { text: 'PRIVATE_MESSAGE' }, 'comments'],
    ['react_to_post', { post_urn: 'urn:li:activity:fixture' }, 'likes'],
    [
      'comment_on_post',
      { post_urn: 'urn:li:activity:fixture', text: 'PRIVATE_MESSAGE' },
      'comments',
    ],
  ] as const;
  it.each(cases)(
    '%s requires confirmation and journals repeated calls',
    async (name, args, bucket) => {
      const f = setup();
      vi.spyOn(f.voyager, 'voyagerGet').mockResolvedValue({
        data: {},
        included: [{ entityUrn: 'urn:li:fs_miniProfile:fixture' }],
      });
      const call = await protocol(f);
      expect((await call(name, args)).data.refused).toBe(true);
      expect(f.evaluate).not.toHaveBeenCalled();
      const operation_id = randomUUID();
      const first = await call(name, { ...args, confirm: true, operation_id });
      expect(first.data).toMatchObject({
        operationId: operation_id,
        status: 'ok',
        replayed: false,
      });
      expect((await call(name, { ...args, confirm: true, operation_id })).data).toMatchObject({
        status: 'ok',
        replayed: true,
      });
      expect(f.evaluate).toHaveBeenCalledTimes(1);
      expect(f.budget.snapshot().writes[bucket]).toEqual({
        attempted: 1,
        successful: 1,
        uncertain: 0,
      });
      expect(readFileSync(f.path, 'utf8')).not.toContain('PRIVATE_MESSAGE');
    },
  );
  it('does not reserve a message when mailbox lookup fails', async () => {
    const f = setup();
    vi.spyOn(f.voyager, 'voyagerGet').mockRejectedValue(new Error('lookup failed'));
    const call = await protocol(f);
    expect(
      (await call('send_message', { thread_id: '2-fixture', message: 'x', confirm: true })).code,
    ).toBe('INTERNAL_ERROR');
    expect(f.budget.snapshot().actions.messages.used).toBe(0);
    expect(f.evaluate).not.toHaveBeenCalled();
  });
});

describe('journal persistence', () => {
  it('retains old safety counters without inventing historical success analytics', () => {
    const f = setup();
    f.budget.record('connections');
    const saved = JSON.parse(readFileSync(f.path, 'utf8'));
    delete saved.accounts.fixture.operations;
    writeFileSync(f.path, JSON.stringify(saved));
    const budget = new BudgetTracker('fixture', { storagePath: f.path });
    expect(budget.snapshot().actions.connections.used).toBe(1);
    expect(budget.snapshot().writes).toEqual({});
  });
  it.each(['{', '{}', '{"version":1,"accounts":{"fixture":{}}}'])(
    'fails closed for invalid state: %s',
    (value) => {
      const path = join(dir, 'invalid.json');
      writeFileSync(path, value);
      expect(() => new BudgetTracker('fixture', { storagePath: path })).toThrow(
        'unreadable or invalid',
      );
      expect(readFileSync(path, 'utf8')).toBe(value);
    },
  );
  it('stops before dispatch if the reservation cannot be saved', async () => {
    const f = setup();
    rmSync(f.path);
    mkdirSync(f.path);
    await expect(f.call()).rejects.toThrow('unreadable or invalid');
    expect(f.evaluate).not.toHaveBeenCalled();
    await expect(f.call()).rejects.toThrow('storage failed');
    await expect(f.guard.run(ACTIONS.readGeneric, async () => 'unsafe')).rejects.toThrow(
      'storage failed',
    );
    expect(f.budget.snapshot().storageHealthy).toBe(false);
  });
  it('does not claim success if result persistence fails after submission', async () => {
    const f = setup();
    f.evaluate.mockImplementation(async () => {
      writeFileSync(join(dir, 'reserved-backup.json'), readFileSync(f.path));
      rmSync(f.path);
      mkdirSync(f.path);
      return response();
    });
    const id = randomUUID();
    expect(await f.call(id)).toMatchObject({ status: 'unknown' });
    expect(f.budget.snapshot().pendingInvites).toBe(0);
    await expect(f.call()).rejects.toThrow('storage failed');
    rmSync(f.path, { recursive: true });
    writeFileSync(f.path, readFileSync(join(dir, 'reserved-backup.json')));
    const restarted = setup();
    expect(await restarted.call(id)).toMatchObject({ status: 'unknown', replayed: true });
    expect(restarted.evaluate).not.toHaveBeenCalled();
  });
  it('keeps an interrupted reservation uncertain across day rollover', () => {
    const path = join(dir, 'rollover.json');
    let now = new Date(2026, 8, 29, 12).getTime();
    const budget = new BudgetTracker('fixture', { storagePath: path, clock: () => now });
    const id = randomUUID();
    const fingerprint = createHash('sha256').update('fixture').digest('hex');
    budget.reserveWrite('connections', id, fingerprint);
    now += 86400000;
    const nextDay = new BudgetTracker('fixture', { storagePath: path, clock: () => now });
    expect(nextDay.snapshot().actions.connections.used).toBe(0);
    expect(nextDay.previousWrite(id, fingerprint)).toMatchObject({ status: 'unknown' });
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600);
  });
});

it('keeps returned rate limits stopped when circuit persistence fails', async () => {
  const f = setup(response(429, '{}'));
  const breaker = new CircuitBreaker({
    storage: {
      load: () => null,
      save: () => {
        throw new Error('PRIVATE_STORAGE');
      },
    },
  });
  const guard = new Guard(
    new SerialQueue(),
    { waitBefore: async () => {} } as HumanPacer,
    f.budget,
    breaker,
  );
  const id = randomUUID();
  const result = await guard.runWrite(ACTIONS.connect, 'connect', {}, id, (before) =>
    f.voyager.voyagerPostRaw('/fixture', {}, before),
  );
  expect(result).toMatchObject({ status: 'quota_exhausted', operationId: id });
  expect(result.detail).toContain('storage failed');
  expect(result.detail).not.toContain('PRIVATE_STORAGE');
  expect(breaker.isGlobalOpen()).toBe(true);
});

it('preserves body-read failure when running the real in-page fetch callback', async () => {
  const f = setup();
  vi.stubGlobal('document', { cookie: 'JSESSIONID=synthetic' });
  const fetch = vi.fn(async () => ({
    status: 200,
    ok: true,
    type: 'basic',
    url: 'https://www.linkedin.com/voyager/api/fixture',
    text: async () => {
      throw new Error('stream lost');
    },
  }));
  vi.stubGlobal('fetch', fetch);
  const page = {
    evaluate: async (fn: (args: unknown) => Promise<unknown>, args: unknown) => fn(args),
  } as unknown as Page;
  vi.mocked(f.engine.getFeedPage).mockResolvedValue(page);
  const result = await f.guard.runWrite(ACTIONS.like, 'react', {}, randomUUID(), (before) =>
    f.voyager.voyagerPostRaw('/fixture', {}, before),
  );
  expect(result.status).toBe('unknown');
  expect(f.budget.snapshot().writes.likes).toEqual({ attempted: 1, successful: 0, uncertain: 1 });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([
  [401, 'basic', 'failed'],
  [0, 'opaqueredirect', 'unknown'],
  [500, 'basic', 'unknown'],
  [200, 'basic', 'unknown'],
])('retains an honest outcome for raw HTTP %s (%s)', async (status, type, expected) => {
  const f = setup({
    ...response(status as number, status === 200 ? '{' : ''),
    type: type as string,
  });
  expect((await f.call()).status).toBe(expected);
  expect(f.evaluate).toHaveBeenCalledTimes(1);
  expect(f.budget.snapshot().writes.connections?.successful).toBe(0);
});

it('blocks a fresh uncertain attempt at the safety cap but permits its stored lookup', async () => {
  const f = setup(response(500, ''));
  const id = randomUUID();
  const budget = new BudgetTracker('fixture', {
    storagePath: f.path,
    dailyCaps: { connections: 1 },
  });
  const guard = new Guard(
    new SerialQueue(),
    { waitBefore: async () => {} } as HumanPacer,
    budget,
    f.breaker,
  );
  const call = (operationId: string) =>
    guard.runWrite(ACTIONS.connect, 'connect', {}, operationId, (before) =>
      f.voyager.voyagerPostRaw('/fixture', {}, before),
    );
  expect((await call(id)).status).toBe('unknown');
  await expect(call(randomUUID())).rejects.toMatchObject({ code: 'BUDGET_EXHAUSTED' });
  expect(await call(id)).toMatchObject({ status: 'unknown', replayed: true });
  expect(f.evaluate).toHaveBeenCalledTimes(1);
});

it('includes old uncertain invitations in the pending ceiling and acceptance safety gate', () => {
  const path = join(dir, 'uncertain-invites.json');
  let now = new Date(2026, 8, 29, 12).getTime();
  const budget = new BudgetTracker('fixture', { storagePath: path, clock: () => now });
  budget.reserveWrite(
    'connections',
    randomUUID(),
    createHash('sha256').update('fixture').digest('hex'),
  );
  now += 86400000;
  const pending = new BudgetTracker('fixture', {
    storagePath: path,
    clock: () => now,
    pendingInviteCeiling: 0,
  });
  expect(pending.snapshot().uncertainInvites).toBe(1);
  expect(pending.getPendingInvites()).toBe(0);
  expect(pending.check('connections')).toMatchObject({
    allowed: false,
    reason: expect.stringContaining('uncertain'),
  });
  const acceptance = new BudgetTracker('fixture', {
    storagePath: path,
    clock: () => now,
    acceptanceRateMinSample: 1,
  });
  expect(acceptance.check('connections')).toMatchObject({
    allowed: false,
    reason: expect.stringContaining('acceptance rate'),
  });
});

it('shares operation lookup across clients of the production server registration', async () => {
  const f = setup();
  const first = await protocol(f, true);
  const second = await protocol(f, true);
  const args = { profile_id: 'fixture', confirm: true, operation_id: randomUUID() };
  expect((await first('connect_with_person', args)).data.status).toBe('ok');
  expect((await second('connect_with_person', args)).data).toMatchObject({
    status: 'ok',
    replayed: true,
  });
  expect(f.evaluate).toHaveBeenCalledTimes(1);
  expect(f.budget.getPendingInvites()).toBe(1);
});

it('preserves checkpoint uncertainty and blocks production reads/writes/health across restart', async () => {
  const f = setup(response(999, '{}'));
  const call = await protocol(f, true);
  const args = { profile_id: 'fixture', confirm: true, operation_id: randomUUID() };
  expect((await call('connect_with_person', args)).data.status).toBe('unknown');
  const next = setup();
  const restarted = await protocol(next, true);
  expect((await restarted('connect_with_person', args)).data).toMatchObject({
    status: 'unknown',
    replayed: true,
  });
  expect((await restarted('get_my_profile', {})).code).toBe('CIRCUIT_OPEN');
  expect((await restarted('create_post', { text: 'fixture', confirm: true })).code).toBe(
    'CIRCUIT_OPEN',
  );
  expect((await restarted('health_check', {})).data).toMatchObject({
    status: 'blocked',
    voyager: 'blocked',
  });
  expect((await restarted('close_session', {})).data.closed).toBe(true);
  expect(next.evaluate).not.toHaveBeenCalled();
});

it('reports a budget persistence stop through production health without probing', async () => {
  const f = setup();
  const call = await protocol(f, true);
  rmSync(f.path);
  mkdirSync(f.path);
  await call('connect_with_person', { profile_id: 'fixture', confirm: true });
  expect((await call('health_check', {})).data).toMatchObject({
    status: 'blocked',
    voyager: 'blocked',
    budget: { storageHealthy: false },
  });
  expect((await call('get_my_profile', {})).code).toBe('INTERNAL_ERROR');
  expect(f.evaluate).not.toHaveBeenCalled();
});

it('loads an interrupted reservation in a separate Node process', () => {
  const f = setup();
  const id = randomUUID();
  const fingerprint = createHash('sha256').update('fixture').digest('hex');
  f.budget.reserveWrite('connections', id, fingerprint);
  const source = new URL('../src/safety/budgets.ts', import.meta.url).href;
  const script = `import { BudgetTracker } from ${JSON.stringify(source)};
    const budget = new BudgetTracker('fixture', { storagePath: process.argv[1] });
    console.log(JSON.stringify({ outcome: budget.previousWrite(process.argv[2], process.argv[3]), used: budget.snapshot().actions.connections.used }));`;
  const output = execFileSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', script, f.path, id, fingerprint],
    { encoding: 'utf8' },
  );
  expect(JSON.parse(output)).toMatchObject({
    outcome: { status: 'unknown', replayed: true },
    used: 1,
  });
});

it.each(['fetch', 'body'])(
  'a real in-page %s deadline leaves one durable unknown write and no retry',
  async (phase) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 1, 12));
    try {
      const f = setup();
      vi.stubGlobal('document', { cookie: 'JSESSIONID=synthetic' });
      let started!: () => void;
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      const fetch = vi.fn(async (_url: string, options: { signal: AbortSignal }) => {
        started();
        const waitForAbort = () =>
          new Promise<never>((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('synthetic-timeout')), {
              once: true,
            });
          });
        if (phase === 'fetch') return waitForAbort();
        return {
          status: 200,
          ok: true,
          type: 'basic',
          url: 'https://www.linkedin.com/voyager/api/fixture',
          text: waitForAbort,
        };
      });
      vi.stubGlobal('fetch', fetch);
      const page = {
        evaluate: async (fn: (args: unknown) => Promise<unknown>, args: unknown) => fn(args),
      } as unknown as Page;
      vi.mocked(f.engine.getFeedPage).mockResolvedValue(page);
      const id = randomUUID();
      const pending = f.call(id);
      await ready;
      await vi.advanceTimersByTimeAsync(30000);
      expect(await pending).toMatchObject({ status: 'unknown', ok: false });
      expect(f.budget.snapshot().writes.connections).toEqual({
        attempted: 1,
        successful: 0,
        uncertain: 1,
      });
      expect(await f.call(id)).toMatchObject({ status: 'unknown', replayed: true });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  },
);
