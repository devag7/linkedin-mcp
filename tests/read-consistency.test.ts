/** Real SDK/registered reads/Guard/Voyager; only the browser page response is synthetic. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRuntime, createServer } from '../src/server.js';
import { Logger } from '../src/types.js';

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
