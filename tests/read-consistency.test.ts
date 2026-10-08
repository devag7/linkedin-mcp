/** Real SDK/registered reads/Guard/Voyager; only the browser page response is synthetic. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRuntime, createServer } from '../src/server.js';
import { Logger } from '../src/types.js';
import {
  JOB_DETAIL_CHECKS,
  observeJobDetailChecks,
  recordJobDetailCheck,
} from '../src/tools/job-detail-diagnostic.js';
import * as normalize from '../src/browser/normalize.js';
import * as registration from '../src/tools/register.js';
import { registerTool } from '../src/tools/register.js';
import { ok } from '../src/tools/result.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const identity = JSON.parse(
  readFileSync(new URL('./fixtures/contracts-v1.json', import.meta.url), 'utf8'),
).response;
let dir: string;
let runtime: ReturnType<typeof createRuntime>;
let server: ReturnType<typeof createServer>['server'];
let client: Client;
let raw: unknown;
let fetches: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-consistency-')));
  vi.stubEnv('LINKEDIN_PROFILE_DIR', join(dir, 'profile'));
  vi.stubEnv('LINKEDIN_ENABLE_WRITES', 'false');
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  runtime = createRuntime(new Logger('error'), false, { storagePath: join(dir, 'budget.json') });
  vi.spyOn(runtime.pacer, 'waitBefore').mockResolvedValue();
  vi.spyOn(runtime.engine, 'ensureContext').mockResolvedValue({} as any);
  fetches = vi.fn(async (_fn, { url }: { url: string }) => ({
    status: 200,
    ok: true,
    type: 'basic',
    url,
    body: JSON.stringify(url.endsWith('/me') ? identity : raw),
  }));
  vi.spyOn(runtime.engine, 'getFeedPage').mockResolvedValue({ evaluate: fetches } as any);
  server = createServer(new Logger('error'), runtime).server;
  client = new Client({ name: 'read-consistency-fixture', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  await client.listTools(); // Enable SDK output-schema validation.
});

afterEach(async () => {
  await client.close();
  await server.close();
  await runtime.engine.dispose();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

async function call(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const envelope = JSON.parse((result.content as { text: string }[])[0]!.text);
  expect(result.structuredContent).toEqual(envelope);
  return { result, envelope };
}

function page(rows: number, total: number, start = 0, count = 2) {
  return {
    included: Array.from({ length: rows }, (_, i) => ({
      $type: 'fixture.JobPosting',
      entityUrn: `urn:li:fsd_jobPosting:${start + i + 1}`,
      title: `Synthetic job ${start + i + 1}`,
    })),
    data: { paging: { total, start, count } },
  };
}

describe('SDK paging evidence', () => {
  it.each([
    { label: 'zero rows with nonzero final total', rows: 0, total: 2, offset: 0, end: 'unknown' },
    {
      label: 'zero rows with nonzero continuing total',
      rows: 0,
      total: 5,
      offset: 0,
      end: 'unknown',
    },
    { label: 'contradictory short final page', rows: 1, total: 2, offset: 0, end: 'unknown' },
    { label: 'contradictory short continuing page', rows: 1, total: 5, offset: 0, end: 'unknown' },
    { label: 'coherent zero-total page', rows: 0, total: 0, offset: 0, end: 'end' },
    { label: 'valid continuing page', rows: 2, total: 5, offset: 0, end: 'available' },
    { label: 'valid full final page', rows: 2, total: 4, offset: 2, end: 'end' },
    { label: 'coherent short final page', rows: 1, total: 3, offset: 2, end: 'end' },
    { label: 'rows exceeding total', rows: 2, total: 1, offset: 0, end: 'unknown' },
    { label: 'rows with zero total', rows: 1, total: 0, offset: 0, end: 'unknown' },
    { label: 'oversized provider page', rows: 3, total: 3, offset: 0, end: 'unknown' },
    { label: 'coherent offset past end', rows: 0, total: 2, offset: 7, end: 'end' },
  ])('$label', async ({ rows, total, offset, end }) => {
    raw = page(rows, total, offset);
    const { result, envelope } = await call('search_jobs', {
      keywords: 'synthetic',
      count: 2,
      offset,
    });
    expect(result.isError).not.toBe(true);
    expect(envelope.data).toHaveLength(Math.min(rows, 2));
    expect(envelope.meta).toMatchObject({
      status: end !== 'end' ? 'partial' : rows === 0 ? 'empty' : 'ok',
      partial: end !== 'end',
      pagination: { offset, count: 2, continuation: end },
    });
    if (end === 'available') expect(envelope.meta.nextCursor).toBeTypeOf('string');
    else expect(envelope.meta.nextCursor).toBeUndefined();
    expect(fetches).toHaveBeenCalledTimes(2); // Identity + one search, no implicit follow-up.
  });

  it('a valid next cursor reaches only the next explicitly requested SDK page', async () => {
    raw = page(2, 5);
    const first = await call('search_jobs', { keywords: 'synthetic', count: 2 });
    expect(fetches).toHaveBeenCalledTimes(2);
    raw = page(2, 5, 2);
    const second = await call('search_jobs', {
      keywords: 'synthetic',
      count: 2,
      cursor: first.envelope.meta.nextCursor,
    });
    expect(second.envelope.meta.pagination).toMatchObject({ offset: 2, continuation: 'available' });
    expect(fetches).toHaveBeenCalledTimes(3);
    expect(fetches.mock.calls[2]![1].url).toContain('start=2');
  });
});

describe('SDK job-detail identity', () => {
  it.each([true, false])(
    'never attributes an unrelated included company (inline=%s)',
    async (inline) => {
      raw = {
        data: {
          title: 'Synthetic job',
          description: 'Synthetic facts',
          entityUrn: 'urn:li:fsd_jobPosting:123',
          ...(inline ? { companyDetails: { name: 'Selected employer' } } : {}),
        },
        included: [
          {
            $type: 'fixture.Company',
            name: 'Unrelated employer',
            entityUrn: 'urn:li:fsd_company:999',
          },
        ],
      };
      const { result, envelope } = await call('get_job_details', { job_id: '123' });
      expect(result.isError).not.toBe(true);
      expect(envelope.data.company).toBe(inline ? 'Selected employer' : undefined);
      expect(envelope.data.sourceUrl).toBe('https://www.linkedin.com/jobs/view/123/');
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['urn:li:jobPosting:123', 'urn:li:fsd_jobPosting:123'])(
    'attaches the exact source only for matching %s',
    async (urn) => {
      raw = { data: { title: 'Synthetic job', description: 'Synthetic facts', entityUrn: urn } };
      const { result, envelope } = await call('get_job_details', { job_id: '123' });
      expect(result.isError).not.toBe(true);
      expect(envelope.data).toMatchObject({
        jobUrn: urn,
        sourceUrl: 'https://www.linkedin.com/jobs/view/123/',
      });
      expect(envelope.meta.status).toBe('ok');
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    undefined,
    'urn:li:fsd_jobPosting:',
    'urn:li:jobPosting:',
    'urn:li:fsd_jobPosting:99',
    'urn:li:jobPosting:99',
    'urn:li:fsd_jobPosting:abc',
    'urn:li:fsd_jobPosting:123:extra',
    'urn:li:other:123',
  ])(
    'rejects absent/unsupported/mismatched identity %s without provenance or retry',
    async (urn) => {
      raw = { data: { title: 'Synthetic job', description: 'Synthetic facts', entityUrn: urn } };
      const { result, envelope } = await call('get_job_details', { job_id: '123' });
      expect(result.isError).toBe(true);
      expect(envelope).toMatchObject({
        data: null,
        code: 'RESPONSE_SHAPE_CHANGED',
        meta: { status: 'error' },
      });
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );
});

function diagnostic() {
  const checks: string[] = [];
  observeJobDetailChecks(server, (check) => checks.push(check));
  return checks;
}

describe('SDK value-free detail rejection stages', () => {
  it('the retained field types alone permit normalization but cannot distinguish an identity mismatch', async () => {
    const checks = diagnostic();
    for (const urn of ['urn:li:fsd_jobPosting:123', 'urn:li:fsd_jobPosting:99']) {
      checks.length = 0;
      // Only retained field types are mirrored; every value and ID is synthetic.
      raw = {
        data: {
          title: 'Synthetic title',
          description: { text: 'Synthetic description' },
          formattedLocation: 'Synthetic location',
          entityUrn: urn,
        },
        included: [{}, {}],
      };
      const { envelope } = await call('get_job_details', { job_id: '123' });
      expect(checks.slice(0, 2)).toEqual(['envelope_accepted', 'title_present']);
      if (urn.endsWith(':123')) {
        expect(envelope.data.sourceUrl).toBe('https://www.linkedin.com/jobs/view/123/');
      } else {
        expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
        expect(checks[2]).toBe('identity_mismatch');
      }
    }
    expect(fetches).toHaveBeenCalledTimes(3); // One identity and two synthetic details.
  });

  it('isolates observers by server and detaches without retaining or emitting unknown values', () => {
    const other = new McpServer({ name: 'separate-observer-fixture', version: '1' });
    const first: string[] = [];
    const second: string[] = [];
    const detach = observeJobDetailChecks(server, (check) => first.push(check));
    observeJobDetailChecks(other, (check) => second.push(check));
    recordJobDetailCheck(server, 'title_present');
    recordJobDetailCheck(server, 'private-identifier' as any);
    expect(first).toEqual(['title_present']);
    expect(second).toEqual([]);
    detach();
    const replacement: string[] = [];
    observeJobDetailChecks(server, (check) => replacement.push(check));
    detach(); // An old detach must not remove a later observer.
    recordJobDetailCheck(server, 'identity_match');
    recordJobDetailCheck(other, 'title_missing');
    expect(first).toEqual(['title_present']);
    expect(replacement).toEqual(['identity_match']);
    expect(second).toEqual(['title_missing']);
  });

  it.each([
    { label: 'null root', response: null },
    { label: 'array root', response: [] },
    { label: 'invalid included container', response: { included: {} } },
    { label: 'invalid included member', response: { included: [null] } },
    { label: 'invalid data container', response: { data: [] } },
    { label: 'empty envelope', response: {} },
    { label: 'empty data envelope', response: { data: {} } },
    {
      label: 'validator traversal ceiling',
      response: { data: { elements: Array.from({ length: 10001 }, () => ({})) } },
    },
  ])('distinguishes envelope rejection: $label', async ({ response }) => {
    raw = response;
    const checks = diagnostic();
    const { result, envelope } = await call('get_job_details', { job_id: '123' });
    expect(result.isError).toBe(true);
    expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
    expect(checks).toEqual(['envelope_shape_rejected']);
    expect(fetches).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, '', '   ', { text: 'Synthetic title' }])(
    'distinguishes missing normalized title without evaluating identity: %j',
    async (title) => {
      raw = {
        data: { title, description: 'Synthetic details', entityUrn: 'urn:li:fsd_jobPosting:123' },
      };
      const checks = diagnostic();
      const { envelope } = await call('get_job_details', { job_id: '123' });
      expect(envelope.code).toBe('RESPONSE_SHAPE_CHANGED');
      expect(checks).toEqual(['envelope_accepted', 'title_missing']);
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );

  it('rejects a title-only detail object that has no supported job marker', async () => {
    raw = { data: { title: 'Synthetic title', entityUrn: 'urn:li:fsd_jobPosting:123' } };
    const checks = diagnostic();
    const { envelope } = await call('get_job_details', { job_id: '123' });
    expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
    expect(checks).toEqual(['envelope_accepted', 'title_missing']);
    expect(fetches).toHaveBeenCalledTimes(2);
  });

  it.each([
    { urn: undefined, stage: 'identity_absent' },
    { urn: 'urn:li:other:123', stage: 'identity_unsupported' },
    { urn: 'urn:li:fsd_jobPosting:99', stage: 'identity_mismatch' },
    { urn: 'urn:li:jobPosting:99', stage: 'identity_mismatch' },
    { urn: 'urn:li:fsd_jobPosting:123', stage: 'identity_match' },
    { urn: 'urn:li:jobPosting:123', stage: 'identity_match' },
  ])('distinguishes $stage without retaining the URN or requested ID', async ({ urn, stage }) => {
    raw = {
      data: { title: 'Private title value', description: 'Private description', entityUrn: urn },
    };
    const checks = diagnostic();
    const { envelope } = await call('get_job_details', { job_id: '123' });
    expect(checks).toEqual([
      'envelope_accepted',
      'title_present',
      stage,
      ...(stage === 'identity_match' ? ['output_accepted'] : []),
    ]);
    if (stage === 'identity_match')
      expect(envelope.data.sourceUrl).toBe('https://www.linkedin.com/jobs/view/123/');
    else expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
    const serialized = JSON.stringify(checks);
    expect(serialized).not.toMatch(/urn:|123|99|Private|https/);
    expect(checks.every((check) => (JOB_DETAIL_CHECKS as readonly string[]).includes(check))).toBe(
      true,
    );
    expect(fetches).toHaveBeenCalledTimes(2);
  });

  it('keeps nested provider errors separate from shape rejection', async () => {
    raw = { data: { error: { message: 'Private error' } } };
    const checks = diagnostic();
    const { envelope } = await call('get_job_details', { job_id: '123' });
    expect(envelope.code).toBe('PROVIDER_ERROR');
    expect(checks).toEqual(['envelope_provider_error']);
  });

  it.each([false, true])(
    'distinguishes output-contract corruption (composed=%s)',
    async (composed) => {
      raw = page(1, 1, 0, 1);
      vi.spyOn(normalize, 'shapeJobDetails').mockReturnValue({
        title: 'Synthetic',
        jobUrn: 'urn:li:fsd_jobPosting:123',
        location: 7 as any,
      });
      // The composed search selects job1; match that ID so identity succeeds first.
      if (composed)
        vi.mocked(normalize.shapeJobDetails).mockReturnValue({
          title: 'Synthetic',
          jobUrn: 'urn:li:fsd_jobPosting:1',
          location: 7 as any,
        });
      const checks = diagnostic();
      const { envelope } = await call(
        composed ? 'research_jobs' : 'get_job_details',
        composed ? { keywords: 'synthetic', count: 1 } : { job_id: '123' },
      );
      expect(checks).toEqual([
        'envelope_accepted',
        'title_present',
        'identity_match',
        'output_shape_rejected',
      ]);
      if (composed) {
        expect(envelope.data.reads[1]).toMatchObject({ code: 'RESPONSE_SHAPE_CHANGED' });
        expect(envelope.data.status).toBe('partial');
      } else expect(envelope.code).toBe('RESPONSE_SHAPE_CHANGED');
      expect(fetches).toHaveBeenCalledTimes(composed ? 3 : 2);
    },
  );

  it('distinguishes a malformed composed error envelope after registered-read dispatch', async () => {
    raw = page(1, 1, 0, 1);
    const original = registration.invokeBriefRead;
    vi.spyOn(registration, 'invokeBriefRead').mockImplementation(async (s, name, args, extra) =>
      name === 'get_job_details' ? { content: [], isError: true } : original(s, name, args, extra),
    );
    const checks = diagnostic();
    const { envelope } = await call('research_jobs', { keywords: 'synthetic', count: 1 });
    expect(envelope.data.reads[1]).toMatchObject({ code: 'RESPONSE_SHAPE_CHANGED' });
    expect(checks).toEqual(['composition_envelope_rejected']);
    expect(fetches).toHaveBeenCalledTimes(2); // Synthetic internal result; no detail provider call.
  });

  it('observes direct null-success rejection without changing its existing contract', async () => {
    const syntheticServer = new McpServer({ name: 'null-contract-fixture', version: '1' });
    const syntheticClient = new Client({ name: 'null-fixture-client', version: '1' });
    const checks: string[] = [];
    observeJobDetailChecks(syntheticServer, (check) => checks.push(check));
    registerTool(
      syntheticServer,
      'get_job_details',
      'Synthetic null result',
      { job_id: z.string() },
      async () => ok(null),
    );
    const [a, b] = InMemoryTransport.createLinkedPair();
    try {
      await syntheticServer.connect(b);
      await syntheticClient.connect(a);
      await syntheticClient.listTools();
      const result = await syntheticClient.callTool({
        name: 'get_job_details',
        arguments: { job_id: '123' },
      });
      expect(result.structuredContent).toMatchObject({ code: 'RESPONSE_SHAPE_CHANGED' });
      expect(checks).toEqual(['output_null_data']);
      expect(fetches).not.toHaveBeenCalled();
    } finally {
      await syntheticClient.close();
      await syntheticServer.close();
    }
  });

  it('an observer exception cannot change safety rejection or trigger another request', async () => {
    raw = {
      data: { title: 'Synthetic', description: 'Synthetic', entityUrn: 'urn:li:jobPosting:99' },
    };
    observeJobDetailChecks(server, () => {
      throw new Error('Private observer failure');
    });
    const { envelope } = await call('get_job_details', { job_id: '123' });
    expect(envelope.code).toBe('RESPONSE_SHAPE_CHANGED');
    expect(fetches).toHaveBeenCalledTimes(2);
  });
});
