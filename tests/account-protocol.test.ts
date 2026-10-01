import { HumanPacer } from '../src/safety/pacer.js';
/** Production runtime wiring with synthetic Chrome/page responses. Offline only. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'patchright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRuntime, createServer, type ServerRuntime } from '../src/server.js';
import { Logger } from '../src/types.js';
import { verifiedAccountKey } from '../src/browser/account.js';
let dir: string;
const cleanup: Array<() => Promise<void>> = [];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'linkedin-account-protocol-'));
  vi.stubEnv('LINKEDIN_ENABLE_WRITES', 'true');
  vi.spyOn(HumanPacer.prototype, 'waitBefore').mockResolvedValue(undefined);
  vi.stubEnv('LINKEDIN_IDLE_TIMEOUT_MS', '0');
});
afterEach(async () => {
  for (const fn of cleanup.splice(0)) await fn();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
const me = (id: string) => ({
  data: { '*miniProfile': `urn:li:fs_miniProfile:${id}` },
  included: [{ entityUrn: `urn:li:fs_miniProfile:${id}`, publicIdentifier: 'fixture' }],
});
function pageFixture() {
  let identity: unknown = me('one');
  let writeStatus = 204;
  const close = vi.fn(async () => {});
  const calls: string[] = [];
  const page = {
    isClosed: () => false,
    url: () => 'https://www.linkedin.com/feed/',
    evaluate: vi.fn(async (_fn: unknown, args?: { url: string; method: string }) => {
      if (!args) return 'LinkedIn';
      calls.push(`${args.method} ${args.url}`);
      return {
        status: args.method === 'GET' ? 200 : writeStatus,
        ok: args.method === 'GET' || (writeStatus >= 200 && writeStatus < 300),
        body: args.url.endsWith('/me') ? JSON.stringify(identity) : '',
        type: 'basic',
        url: `https://www.linkedin.com${args.url}`,
      };
    }),
  } as unknown as Page;
  vi.spyOn(chromium, 'launchPersistentContext').mockImplementation(
    async () =>
      ({
        pages: () => [page],
        cookies: async () => [{ name: 'li_at', value: 'synthetic-not-real' }],
        close,
        browser: () => null,
      }) as unknown as BrowserContext,
  );
  return {
    calls,
    close,
    setWriteStatus: (status: number) => {
      writeStatus = status;
    },
    setIdentity: (next: unknown) => {
      identity = next;
    },
  };
}
async function runtime(profile = 'profile') {
  vi.stubEnv('LINKEDIN_PROFILE_DIR', join(dir, profile));
  const r = createRuntime(new Logger('error'), false, { storagePath: join(dir, 'budget.json') });
  cleanup.push(() => r.engine.dispose());
  return r;
}
async function client(r: ServerRuntime) {
  const server = createServer(new Logger('error'), r).server;
  const c = new Client({ name: 'account-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await c.connect(a);
  cleanup.unshift(async () => {
    await c.close();
    await server.close();
  });
  return async (operation = 'operation-one') => {
    const result = await c.callTool({
      name: 'react_to_post',
      arguments: {
        post_urn: 'urn:li:activity:123',
        reaction: 'LIKE',
        confirm: true,
        operation_id: operation,
      },
    });
    return JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
  };
}
it('the registered tool verifies /me before POST and debits only the hashed authenticated account', async () => {
  const fixture = pageFixture();
  const r = await runtime();
  const call = await client(r);
  const result = await call();
  expect(result.data.status).toBe('ok');
  expect(fixture.calls[0]).toBe('GET /voyager/api/me');
  expect(fixture.calls.filter((c) => c.startsWith('POST'))).toHaveLength(1);
  expect(fixture.calls.filter((c) => c.endsWith('/me'))).toHaveLength(2); // Initial binding + immediate pre-write verification.
  const disk = JSON.parse(readFileSync(join(dir, 'budget.json'), 'utf8'));
  expect(Object.keys(disk.accounts)).toEqual([verifiedAccountKey(me('one'))]);
  expect((await call()).data.replayed).toBe(true);
  expect(fixture.calls.filter((c) => c.startsWith('POST'))).toHaveLength(1);
});
it('a changed account returns a specific error and cannot debit or send as the previous member', async () => {
  const fixture = pageFixture();
  const r = await runtime();
  const call = await client(r);
  await call();
  fixture.setIdentity(me('two'));
  expect((await call('operation-two')).code).toBe('ACCOUNT_CHANGED');
  fixture.setIdentity(me('one'));
  expect((await call('operation-three')).code).toBe('ACCOUNT_CHANGED');
  expect(fixture.calls.filter((c) => c.startsWith('POST'))).toHaveLength(1);
  expect(r.budget.snapshot().writes.likes?.attempted).toBe(1);
});
it('unresolved own identity fails before any POST or account-state creation', async () => {
  const fixture = pageFixture();
  fixture.setIdentity({ data: {}, included: [] });
  const r = await runtime();
  const call = await client(r);
  expect((await call()).code).toBe('ACCOUNT_UNRESOLVED');
  expect(fixture.calls.filter((c) => c.startsWith('POST'))).toHaveLength(0);
  expect(r.budget.snapshot().accountResolved).toBe(false);
});
it('the same member in two different profiles sees one budget and one operation journal', async () => {
  const fixture = pageFixture();
  const first = await runtime('profile-one');
  const second = await runtime('profile-two');
  const a = await client(first);
  const b = await client(second);
  await a();
  expect((await b()).data.replayed).toBe(true);
  expect(fixture.calls.filter((c) => c.startsWith('POST'))).toHaveLength(1);
  expect(second.budget.snapshot().writes.likes?.attempted).toBe(1);
});

it('whoami reports not_checked on a cold saved profile; health deliberately opens and verifies it', async () => {
  pageFixture();
  const r = await runtime();
  const server = createServer(new Logger('error'), r).server;
  const c = new Client({ name: 'session-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await c.connect(a);
  cleanup.unshift(async () => {
    await c.close();
    await server.close();
  });
  const parse = (result: unknown) =>
    JSON.parse((result as { content: Array<{ text: string }> }).content[0]!.text).data;
  const cold = parse(await c.callTool({ name: 'whoami', arguments: {} }));
  expect(cold.sessionState).toBe('not_checked');
  expect(cold.loggedIn).toBe(null);
  expect(r.engine.hasActiveContext).toBe(false);
  const health = parse(await c.callTool({ name: 'health_check', arguments: {} }));
  expect(health.status).toBe('healthy');
  expect(health.voyager).toBe('ok');
  expect(health.budget.accountResolved).toBe(true);
  const warm = parse(await c.callTool({ name: 'whoami', arguments: {} }));
  expect(warm.sessionState).toBe('logged_in');
  expect(warm.loggedIn).toBe(true);
});

it('a restarted production runtime can resolve identity and retrieve its stored quota result during cooldown', async () => {
  const fixture = pageFixture();
  fixture.setWriteStatus(429);
  const first = await runtime();
  const initial = await client(first);
  expect((await initial()).data.status).toBe('quota_exhausted');
  await first.engine.dispose();
  const second = await runtime();
  const repeat = await client(second);
  const result = await repeat();
  expect(result.data.status).toBe('quota_exhausted');
  expect(result.data.replayed).toBe(true);
  expect(fixture.calls.filter((call) => call.startsWith('POST'))).toHaveLength(1);
});

it('live doctor follows production identity wiring and releases its profile after a successful probe', async () => {
  const { diagnose } = await import('../src/doctor.js');
  const { writeFileSync, chmodSync, existsSync } = await import('node:fs');
  const fixture = pageFixture();
  const executable = join(dir, 'fake-chrome');
  writeFileSync(executable, 'fixture');
  chmodSync(executable, 0o700);
  vi.stubEnv('LINKEDIN_PROFILE_DIR', join(dir, 'doctor-profile'));
  vi.stubEnv('LINKEDIN_CHROME_PATH', executable);
  const report = await diagnose(
    (await import('../src/config/env.js')).loadConfig(),
    { transport: 'stdio', port: 3000, logLevel: 'error' },
    { live: true, storagePath: join(dir, 'budget.json') },
  );
  expect(report.session).toBe('healthy');
  expect(report.api).toBe('ok');
  expect(fixture.close).toHaveBeenCalledTimes(1);
  expect(existsSync(join(dir, 'doctor-profile.owner.lock'))).toBe(false);
  expect(fixture.calls.every((call) => call.startsWith('GET'))).toBe(true);
  expect(JSON.stringify(report)).not.toContain('synthetic-not-real');
});

it('corrupted budget state stops production identity/network work before a cold relaunch', async () => {
  const { writeFileSync } = await import('node:fs');
  const fixture = pageFixture();
  const r = await runtime();
  const call = await client(r);
  await call();
  await r.engine.shutdown();
  const requests = fixture.calls.length;
  writeFileSync(join(dir, 'budget.json'), '{}');
  const result = await call('operation-two');
  expect(result.code).toBe('INTERNAL_ERROR');
  expect(result.error).toContain('unreadable or invalid');
  expect(fixture.calls).toHaveLength(requests);
  expect(r.engine.hasActiveContext).toBe(false);
  expect(r.budget.snapshot().storageHealthy).toBe(false);
});

it('a final health sample that changes member identity blocks health and subsequent production reads', async () => {
  const fixture = pageFixture();
  const r = await runtime();
  await (
    await client(r)
  )(); // Establish the original account through a registered write fixture.
  fixture.setIdentity(me('two'));
  const server = createServer(new Logger('error'), r).server;
  const c = new Client({ name: 'health-identity-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await c.connect(a);
  await c.listTools();
  cleanup.unshift(async () => {
    await c.close();
    await server.close();
  });
  const parse = (result: unknown) =>
    JSON.parse((result as { content: Array<{ text: string }> }).content[0]!.text);
  const health = parse(await c.callTool({ name: 'health_check', arguments: {} })).data;
  expect(health.status).toBe('blocked');
  expect(health.code).toBe('ACCOUNT_CHANGED');
  const count = fixture.calls.length;
  expect(parse(await c.callTool({ name: 'get_feed', arguments: {} })).code).toBe('ACCOUNT_CHANGED');
  expect(fixture.calls).toHaveLength(count);
});
