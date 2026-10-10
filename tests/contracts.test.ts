/** Native MCP contracts with synthetic providers; not a live compatibility claim. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ACTIONS } from '../src/browser/guard.js';
import { createRuntime, createServer } from '../src/server.js';
import { Logger } from '../src/types.js';
import { VoyagerError } from '../src/browser/voyager.js';
import { BrowserSafetyError } from '../src/browser/safety.js';
import { CAPABILITIES, type ToolName } from '../src/tools/capabilities.js';
import { outputSchema } from '../src/tools/contracts.js';
import { failure, run, ToolError } from '../src/tools/result.js';
import { pageStart, pageResult } from '../src/tools/pagination.js';
import { assertReadResponse, readRows } from '../src/tools/provider-shape.js';
import { requestCancellation } from '../src/tools/cancellation.js';
import * as dom from '../src/browser/dom.js';
vi.mock('../src/browser/dom.js', () => ({
  scrapePeopleSearch: vi.fn(),
  scrapeCompanySearch: vi.fn(),
  scrapeCompany: vi.fn(),
  scrapeCompanyPosts: vi.fn(),
  scrapeCompanyEmployees: vi.fn(),
}));
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/contracts-v1.json', import.meta.url), 'utf8'),
);
const args: Record<ToolName, Record<string, unknown>> = {
  whoami: {},
  health_check: {},
  close_session: {},
  get_my_profile: {},
  get_profile: { username: 'synthetic-one' },
  get_feed: {},
  get_notifications: {},
  search_people: { keywords: 'synthetic' },
  search_jobs: { keywords: 'synthetic' },
  research_jobs: { keywords: 'synthetic' },
  get_inbox: {},
  get_job_details: { job_id: '123' },
  search_companies: { keywords: 'synthetic' },
  get_company: { universal_name: 'synthetic' },
  get_company_posts: { universal_name: 'synthetic' },
  get_company_employees: { universal_name: 'synthetic' },
  get_pending_invitations: {},
  get_conversation: {
    conversation_urn: 'urn:li:msg_conversation:(urn:li:fsd_profile:synthetic-one,2-synthetic)',
  },
  connect_with_person: { profile_id: 'synthetic-target' },
  send_message: { thread_id: '2-synthetic', message: 'Synthetic message' },
  create_post: { text: 'Synthetic post' },
  react_to_post: { post_urn: 'urn:li:activity:123' },
  comment_on_post: { post_urn: 'urn:li:activity:123', text: 'Synthetic comment' },
};
let dir: string;
let client: Client;
let runtime: ReturnType<typeof createRuntime>;
let server: ReturnType<typeof createServer>['server'];
beforeEach(async () => {
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  dir = mkdtempSync(join(tmpdir(), 'linkedin-contracts-'));
  vi.stubEnv('LINKEDIN_PROFILE_DIR', join(dir, 'profile'));
  vi.stubEnv('LINKEDIN_ENABLE_WRITES', 'false');
  runtime = createRuntime(new Logger('error'), false, { storagePath: join(dir, 'budget.json') });
  vi.spyOn(runtime.guard, 'run').mockImplementation(async (_action, fn) => fn());
  vi.spyOn(runtime.voyager, 'voyagerGet').mockResolvedValue(fixture.response);
  vi.spyOn(runtime.engine, 'isLoggedIn').mockResolvedValue(true);
  vi.mocked(dom.scrapePeopleSearch).mockResolvedValue([
    { name: 'Synthetic', publicIdentifier: 'synthetic' },
  ]);
  vi.mocked(dom.scrapeCompanySearch).mockResolvedValue([
    { name: 'Synthetic', universalName: 'synthetic' },
  ]);
  vi.mocked(dom.scrapeCompany).mockResolvedValue({ name: 'Synthetic', universalName: 'synthetic' });
  vi.mocked(dom.scrapeCompanyPosts).mockResolvedValue([{ text: 'Synthetic post' }]);
  vi.mocked(dom.scrapeCompanyEmployees).mockResolvedValue([
    { name: 'Synthetic', publicIdentifier: 'synthetic' },
  ]);
  server = createServer(new Logger('error'), runtime).server;
  client = new Client({ name: 'contract-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  await client.listTools(); // Enables the client's own output-schema validation.
});
afterEach(async () => {
  await client.close();
  await server.close();
  await runtime.engine.dispose();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
function decode(result: Awaited<ReturnType<Client['callTool']>>) {
  const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
  expect(result.structuredContent).toEqual(parsed);
  return parsed;
}
const messagingOwner = 'synthetic-one';
const messagingOther = 'synthetic-other';
const messagingUrn = `urn:li:msg_conversation:(urn:li:fsd_profile:${messagingOwner},2-synthetic)`;
const messagingParticipant = (id: string, firstName: string) => ({
  $type: 'com.linkedin.messenger.MessagingParticipant',
  entityUrn: `urn:li:msg_messagingParticipant:urn:li:fsd_profile:${id}`,
  hostIdentityUrn: `urn:li:fsd_profile:${id}`,
  participantType: {
    member: {
      firstName: { text: firstName },
      headline: { text: 'Synthetic' },
      profileUrl: `https://www.linkedin.com/in/${id}/`,
    },
  },
});
it('retains inbox participant fields in the advertised and native bounded contract', async () => {
  vi.mocked(runtime.voyager.voyagerGet)
    .mockResolvedValueOnce(fixture.response)
    .mockResolvedValueOnce({
      included: [
        messagingParticipant(messagingOwner, 'Owner'),
        messagingParticipant(messagingOther, 'Other'),
        ...[1, 2].map((i) => ({
          $type: 'com.linkedin.messenger.Conversation',
          entityUrn: messagingUrn + i,
          groupChat: false,
          '*conversationParticipants': [
            `urn:li:msg_messagingParticipant:urn:li:fsd_profile:${messagingOwner}`,
            `urn:li:msg_messagingParticipant:urn:li:fsd_profile:${messagingOther}`,
          ],
        })),
      ],
    });
  const result = decode(await client.callTool({ name: 'get_inbox', arguments: { count: 1 } }));
  expect(result.data).toHaveLength(1);
  expect(result.data[0]).toMatchObject({
    title: 'Other',
    groupChat: false,
    participants: [
      {
        name: 'Other',
        profileUrn: `urn:li:fsd_profile:${messagingOther}`,
        profileUrl: `https://www.linkedin.com/in/${messagingOther}/`,
      },
    ],
  });
  expect(result.meta.partial).toBe(true);
  const schema: any = (await client.listTools()).tools.find(
    (t) => t.name === 'get_inbox',
  )!.outputSchema;
  expect(schema.properties.data.anyOf[0].items.properties.participants).toBeDefined();
});
it('returns sorted, attributed and bounded messages through native MCP while encoding the full URN', async () => {
  vi.mocked(runtime.voyager.voyagerGet).mockResolvedValueOnce({
    included: [
      messagingParticipant(messagingOwner, 'Owner'),
      messagingParticipant(messagingOther, 'Other'),
      ...[3, 1, 2].map((i) => ({
        $type: 'com.linkedin.messenger.Message',
        deliveredAt: i,
        body: { text: `Synthetic ${i}` },
        '*conversation': messagingUrn,
        '*sender': `urn:li:msg_messagingParticipant:urn:li:fsd_profile:${i === 2 ? messagingOwner : messagingOther}`,
      })),
    ],
  });
  const result = decode(
    await client.callTool({
      name: 'get_conversation',
      arguments: { conversation_urn: messagingUrn, count: 2 },
    }),
  );
  expect(result.data).toHaveLength(2);
  expect(result.data.map((m: any) => [m.deliveredAt, m.sender, m.fromSelf])).toEqual([
    [1, 'Other', false],
    [2, 'Owner', true],
  ]);
  expect(result.meta.partial).toBe(true);
  expect(runtime.voyager.voyagerGet).toHaveBeenLastCalledWith(
    expect.stringContaining('%28urn%3Ali%3Afsd_profile%3Asynthetic-one%2C2-synthetic%29'),
  );
  const schema: any = (await client.listTools()).tools.find(
    (t) => t.name === 'get_conversation',
  )!.outputSchema;
  expect(schema.properties.data.anyOf[0].items.properties.fromSelf).toBeDefined();
});
it('lists matching capabilities, output schemas and read/write annotations without launching Chrome', async () => {
  const tools = (await client.listTools()).tools;
  expect(tools.map((tool) => tool.name).sort()).toEqual(Object.keys(args).sort());
  for (const tool of tools) {
    expect(tool.outputSchema).toBeDefined();
    expect(tool.annotations?.destructiveHint).toBe(CAPABILITIES[tool.name as ToolName].write);
  }
  const who = decode(await client.callTool({ name: 'whoami', arguments: {} })).data;
  expect(who.tools).toBe(tools.length);
  expect(who.capabilities.map((c: { name: string }) => c.name).sort()).toEqual(
    tools.map((t) => t.name).sort(),
  );
  expect(who.capabilities.every((c: { liveCheckedAt: null }) => c.liveCheckedAt === null)).toBe(
    true,
  );
  expect(runtime.engine.hasActiveContext).toBe(false);
});
it.each(Object.keys(args) as ToolName[])(
  '%s emits a native contract plus identical legacy JSON text',
  async (name) => {
    const result = await client.callTool({ name, arguments: args[name] });
    expect(result.isError).not.toBe(true);
    const parsed = decode(result);
    expect(outputSchema(name).safeParse(parsed).success).toBe(true);
    expect(parsed.meta.contractVersion).toBe(1);
    expect(typeof parsed.meta.partial).toBe('boolean');
  },
);
const reads = (Object.keys(args) as ToolName[]).filter(
  (n) => !CAPABILITIES[n].write && !['whoami', 'close_session', 'health_check'].includes(n),
);
describe('protocol errors on every read registration', () => {
  it.each(reads)(
    '%s retains typed/redacted auth, quota, checkpoint, timeout and malformed-response errors',
    async (name) => {
      for (const error of [
        new VoyagerError('AUTH_REQUIRED', 'synthetic-secret'),
        new VoyagerError('RATE_LIMITED', 'synthetic-secret'),
        new BrowserSafetyError('CHECKPOINT_REQUIRED', 'synthetic-secret'),
        new VoyagerError('TIMEOUT', 'synthetic-secret'),
        new Error('synthetic-secret'),
        new ToolError('RESPONSE_SHAPE_CHANGED'),
      ]) {
        vi.mocked(runtime.guard.run).mockRejectedValueOnce(error);
        const result = await client.callTool({ name, arguments: args[name] });
        const parsed = decode(result);
        if (name === 'research_jobs') {
          expect(result.isError).not.toBe(true); // Useful partial report retains structured stop evidence.
          expect(parsed.data.status).toBe('partial');
          expect(parsed.meta.partial).toBe(true);
          expect(parsed.data.entities).toEqual([]);
          expect(parsed.data.reads).toHaveLength(1);
          expect(parsed.data.reads[0]).toMatchObject({
            status: 'error',
            code: 'code' in error ? error.code : 'INTERNAL_ERROR',
          });
          expect(parsed.data.bounds.toolCalls).toBe(1);
        } else {
          expect(result.isError).toBe(true);
          expect(parsed.data).toBeNull();
          expect(parsed.meta.status).toBe('error');
        }
        expect(JSON.stringify(parsed)).not.toContain('synthetic-secret');
      }
    },
  );
});
it.each([
  'create_post',
  'connect_with_person',
  'send_message',
  'react_to_post',
  'comment_on_post',
] as ToolName[])(
  '%s previews locally and refuses a confirmed write while disabled',
  async (name) => {
    const dispatch = vi.spyOn(runtime.guard, 'runWrite');
    const preview = decode(await client.callTool({ name, arguments: args[name] })).data.preview;
    expect(preview.content).toBeDefined();
    expect(preview.target).toBeDefined();
    expect(preview.operationId).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    const result = decode(
      await client.callTool({
        name,
        arguments: {
          ...args[name],
          confirm: true,
          operation_id: preview.operationId,
          preview_hash: preview.payloadHash,
        },
      }),
    );
    expect(result.code).toBe('WRITE_DISABLED');
    expect(dispatch).not.toHaveBeenCalled();
    expect(runtime.engine.hasActiveContext).toBe(false);
  },
);
it('rejects changed preview inputs and unverified new threads before any browser action', async () => {
  const preview = decode(
    await client.callTool({ name: 'create_post', arguments: args.create_post }),
  ).data.preview;
  expect(
    decode(
      await client.callTool({
        name: 'create_post',
        arguments: { text: 'Changed', confirm: true, preview_hash: preview.payloadHash },
      }),
    ).code,
  ).toBe('PREVIEW_CHANGED');
  await client.close();
  await server.close();
  server = createServer(new Logger('error'), runtime, {
    writesEnabled: true,
    experimentalMessagesEnabled: false,
  }).server;
  client = new Client({ name: 'experimental-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  await client.listTools();
  expect(
    decode(
      await client.callTool({
        name: 'send_message',
        arguments: {
          recipient_urn: 'urn:li:fsd_profile:synthetic-target',
          message: 'Synthetic',
          confirm: true,
        },
      }),
    ).code,
  ).toBe('UNVERIFIED_ROUTE');
  expect(runtime.engine.hasActiveContext).toBe(false);
});
it('returns bounded pages and query-specific continuations only when paging evidence exists', async () => {
  const raw = { data: { paging: { start: 0, count: 2, total: 5 } } };
  const result = pageResult('search_jobs', { keywords: 'a' }, 2, 0, [1, 2], raw)
    .structuredContent as any;
  expect(result.data).toEqual([1, 2]);
  expect(result.meta.partial).toBe(true);
  expect(pageStart('search_jobs', { keywords: 'a' }, 2, 0, result.meta.nextCursor)).toBe(2);
  for (const mismatch of [
    () => pageStart('get_feed', { keywords: 'a' }, 2, 0, result.meta.nextCursor),
    () => pageStart('search_jobs', { keywords: 'b' }, 2, 0, result.meta.nextCursor),
    () => pageStart('search_jobs', { keywords: 'a' }, 3, 0, result.meta.nextCursor),
    () => pageStart('search_jobs', { keywords: 'a' }, 2, 1, result.meta.nextCursor),
    () => pageStart('search_jobs', {}, 2, 0, 'not-json'),
  ])
    expect(mismatch).toThrow(ToolError);
  const unknown = pageResult('search_jobs', null, 2, 0, [1, 2, 3], {}).structuredContent as any;
  expect(unknown.data).toHaveLength(2);
  expect(unknown.meta.nextCursor).toBeUndefined();
  expect(unknown.meta.pagination.continuation).toBe('unknown');
});
it('explicit offset reaches one known job request; oversized count and malformed cursors cannot dispatch', async () => {
  await client.callTool({
    name: 'search_jobs',
    arguments: { keywords: 'synthetic', count: 2, offset: 7 },
  });
  expect(runtime.voyager.voyagerGet).toHaveBeenLastCalledWith(expect.stringContaining('start=7'));
  vi.mocked(runtime.voyager.voyagerGet).mockClear();
  expect(
    (
      await client.callTool({
        name: 'search_jobs',
        arguments: { keywords: 'synthetic', cursor: 'bad' },
      })
    ).isError,
  ).toBe(true);
  expect(
    (
      await client.callTool({
        name: 'search_jobs',
        arguments: { keywords: 'synthetic', count: 26 },
      })
    ).isError,
  ).toBe(true);
  expect(runtime.voyager.voyagerGet).not.toHaveBeenCalled();
});
it('distinguishes explicit emptiness from malformed provider shapes and HTTP-200 errors', () => {
  expect(readRows({ included: [] }, [])).toEqual([]);
  for (const raw of [
    null,
    [],
    {},
    { included: {} },
    { data: {} },
    { data: { errors: [{ message: 'secret' }] } },
  ])
    expect(() => assertReadResponse(raw)).toThrow(ToolError);
  expect(() => readRows({ included: [{ $type: 'Unknown' }] }, [])).toThrow(ToolError);
  expect(() => readRows({ included: [], data: { elements: ['unresolved-urn'] } }, [])).toThrow(
    ToolError,
  );
  expect(() =>
    assertReadResponse({ included: [{ $type: 'NewType', optionalFutureField: true }] }),
  ).not.toThrow();
});
it('cancellation before a queued action skips provider and unknown exceptions are absent from debug logs', async () => {
  vi.restoreAllMocks(); // Exercise real guard; no browser can be touched for an already-aborted request.
  const controller = new AbortController();
  controller.abort();
  const fn = vi.fn();
  await expect(
    requestCancellation.run(controller.signal, () => runtime.guard.run(ACTIONS.readGeneric, fn)),
  ).rejects.toThrow('CANCELLED');
  expect(fn).not.toHaveBeenCalled();
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const secrets = [
    'synthetic-cookie',
    'synthetic-csrf',
    'synthetic-profile',
    'synthetic-message',
    'Bearer synthetic-token',
  ];
  await run(new Logger('debug'), 'get_profile', async () => {
    throw new Error(secrets.join(' '));
  });
  const logged = stderr.mock.calls.map((c) => c[0]).join('');
  for (const secret of secrets) expect(logged).not.toContain(secret);
  expect(failure('get_profile', 'INTERNAL_ERROR').isError).toBe(true);
});

it.each([
  'get_feed',
  'get_notifications',
  'search_jobs',
  'get_inbox',
  'get_conversation',
  'get_pending_invitations',
  'search_people',
  'search_companies',
  'get_company_posts',
  'get_company_employees',
] as ToolName[])(
  '%s handles explicit empty data without losing bounded/partial metadata',
  async (name) => {
    vi.mocked(runtime.voyager.voyagerGet).mockImplementation(async (path) =>
      path === '/me' ? fixture.response : { included: [] },
    );
    vi.mocked(dom.scrapePeopleSearch).mockResolvedValue([]);
    vi.mocked(dom.scrapeCompanySearch).mockResolvedValue([]);
    vi.mocked(dom.scrapeCompanyPosts).mockResolvedValue([]);
    vi.mocked(dom.scrapeCompanyEmployees).mockResolvedValue([]);
    const result = await client.callTool({ name, arguments: args[name] });
    expect(result.isError).not.toBe(true);
    const parsed = decode(result);
    expect(parsed.meta.partial).toBe(true); // No provider total/continuation evidence, including empty views.
    expect(parsed.meta.status).toBe('partial');
    if (name === 'get_pending_invitations') expect(parsed.data).toEqual({ received: [], sent: [] });
    else expect(parsed.data).toEqual([]);
  },
);
it('ignores legacy authentication settings in the active browser configuration and rejects parallel browser concurrency', async () => {
  const { loadConfig } = await import('../src/config/env.js');
  vi.stubEnv('LINKEDIN_ACCESS_TOKEN', 'synthetic-token');
  vi.stubEnv('LINKEDIN_COOKIE', 'synthetic-cookie');
  vi.stubEnv('CACHE_TTL', 'obsolete-value');
  vi.stubEnv('LINKEDIN_PACING_DISABLED', 'true');
  const config = loadConfig();
  for (const key of [
    'LINKEDIN_ACCESS_TOKEN',
    'LINKEDIN_COOKIE',
    'CACHE_TTL',
    'LINKEDIN_PACING_DISABLED',
  ])
    expect(config).not.toHaveProperty(key);
  vi.stubEnv('LINKEDIN_CONCURRENCY', '2');
  expect(() => loadConfig()).toThrow('LINKEDIN_CONCURRENCY');
});

it('explicit official selection returns an unavailable error without browser fallback', async () => {
  const { loadConfig } = await import('../src/config/env.js');
  vi.stubEnv('LINKEDIN_PROVIDER', 'official');
  expect(() => loadConfig()).toThrow('Official provider is unavailable');
  expect(runtime.engine.hasActiveContext).toBe(false);
});

it('a real MCP cancellation remains attached to a queued request and prevents provider execution', async () => {
  const { Guard } = await import('../src/browser/guard.js');
  const { BudgetTracker } = await import('../src/safety/budgets.js');
  const { HumanPacer } = await import('../src/safety/pacer.js');
  const budget = new BudgetTracker('cancellation-fixture', {
    storagePath: join(dir, 'cancel-budget.json'),
  });
  const pacer = new HumanPacer();
  vi.spyOn(pacer, 'waitBefore').mockResolvedValue(undefined as never);
  runtime.guard = new Guard(runtime.queue, pacer, budget, runtime.breaker, new Logger('error'));
  await client.close();
  await server.close();
  server = createServer(new Logger('error'), runtime).server;
  client = new Client({ name: 'cancellation-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  await client.listTools();
  let release!: () => void;
  const blocker = runtime.queue.enqueue(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  // Establish the first running task before queueing the protocol request.
  await new Promise<void>((resolve) => setImmediate(resolve));
  let queued!: () => void;
  const seen = new Promise<void>((resolve) => {
    queued = resolve;
  });
  const enqueue = runtime.queue.enqueue.bind(runtime.queue);
  vi.spyOn(runtime.queue, 'enqueue').mockImplementation((fn) => {
    const result = enqueue(fn);
    queued();
    return result;
  });
  vi.mocked(runtime.voyager.voyagerGet).mockClear();
  const controller = new AbortController();
  const call = client
    .callTool({ name: 'get_feed', arguments: {} }, undefined, { signal: controller.signal })
    .catch((error) => error);
  await seen;
  controller.abort();
  await call;
  // Wait one event turn so the cancellation notification reaches the server.
  await new Promise<void>((resolve) => setImmediate(resolve));
  release();
  await blocker;
  await runtime.queue.drain();
  expect(runtime.voyager.voyagerGet).not.toHaveBeenCalled();
  expect(runtime.engine.hasActiveContext).toBe(false);
});
