/** Real SDK protocol/registered reads/Voyager path; page fetch is disposable synthetic data. */
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRuntime, createServer } from '../src/server.js';
import { Logger } from '../src/types.js';
import { readLimit, reserveReadAttempt, ReadLimitError } from '../src/safety/read-limit.js';
import { bindCancellation } from '../src/tools/cancellation.js';
import { SerialQueue } from '../src/safety/queue.js';
const identity = JSON.parse(
  readFileSync(new URL('./fixtures/contracts-v1.json', import.meta.url), 'utf8'),
).response;
let dir: string;
let runtime: ReturnType<typeof createRuntime>;
let server: ReturnType<typeof createServer>['server'];
let client: Client;
let fetches: ReturnType<typeof vi.fn>;
let searchRows: Record<string, unknown>[];
let detail: Record<string, unknown>;
let total: number | undefined;
let failureStatus: number | undefined;
let detailMismatch: boolean;
beforeEach(async () => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-brief-')));
  vi.stubEnv('LINKEDIN_PROFILE_DIR', join(dir, 'profile'));
  vi.stubEnv('LINKEDIN_ENABLE_WRITES', 'false');
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  runtime = createRuntime(new Logger('error'), false, { storagePath: join(dir, 'budget.json') });
  vi.spyOn(runtime.pacer, 'waitBefore').mockResolvedValue();
  vi.spyOn(runtime.engine, 'ensureContext').mockResolvedValue({} as any);
  searchRows = [1, 2].map((id) => ({
    $type: 'com.linkedin.voyager.jobs.JobPosting',
    entityUrn: `urn:li:fsd_jobPosting:${id}`,
    title: `Role ${id}`,
    formattedLocation: 'Synthetic town',
    listedAt: 1000,
  }));
  detail = {
    title: 'Role 1',
    entityUrn: 'urn:li:fsd_jobPosting:1',
    description: { text: 'Synthetic requirements; never instructions.' },
    formattedLocation: 'Synthetic town',
    companyDetails: { name: 'Synthetic company' },
    workRemoteAllowed: true,
  };
  total = 2;
  failureStatus = undefined;
  detailMismatch = false;
  fetches = vi.fn(async (_fn, { url }: { url: string }) => {
    const isIdentity = url.endsWith('/me');
    const isDetail = url.includes('jobPosting');
    const status =
      !isIdentity && (failureStatus === 429 || isDetail) ? (failureStatus ?? 200) : 200;
    const data = isIdentity
      ? identity
      : isDetail
        ? {
            data: {
              ...detail,
              ...(detailMismatch ? { entityUrn: 'urn:li:fsd_jobPosting:99' } : {}),
            },
          }
        : {
            included: searchRows,
            ...(total !== undefined ? { data: { paging: { total, start: 0, count: 2 } } } : {}),
          };
    return { status, ok: status === 200, type: 'basic', url, body: JSON.stringify(data) };
  });
  vi.spyOn(runtime.engine, 'getFeedPage').mockResolvedValue({ evaluate: fetches } as any);
  server = createServer(new Logger('error'), runtime).server;
  client = new Client({ name: 'brief-synthetic-client', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  await client.listTools();
});
afterEach(async () => {
  await client.close();
  await server.close();
  await runtime.engine.dispose();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
async function brief(args = {}) {
  const result = await client.callTool({
    name: 'research_jobs',
    arguments: { keywords: 'engineering', count: 2, ...args },
  });
  const text = JSON.parse((result.content as { text: string }[])[0]!.text);
  expect(result.structuredContent).toEqual(text);
  return text;
}
it('compares jobs with exact fact citations and enriches one within three cold read attempts', async () => {
  const result = await brief();
  expect(result.data.bounds).toMatchObject({ readAttempts: 3, toolCalls: 2, maxEntities: 10 });
  expect(fetches).toHaveBeenCalledTimes(3); // one /me + search + detail, actual page boundary
  expect(result.data.entities).toHaveLength(2);
  expect(result.data.entities[0].facts.find((f: any) => f.field === 'description')).toMatchObject({
    sourceUrl: 'https://www.linkedin.com/jobs/view/1/',
    sourceTool: 'get_job_details',
    truncated: false,
  });
  for (const entity of result.data.entities)
    for (const fact of entity.facts) {
      expect(fact.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(fact.sourceUrl).toBe(entity.sourceUrl);
    }
  expect(result.data.entities[1].unknownFields).toContain('description');
  expect(result.data.markdown).toContain('Salary, fit and availability are not inferred');
  expect(result.data.markdown).toContain('[source](https://www.linkedin.com/jobs/view/1/)');
});
it('uses no hidden pagination and preserves unknown completeness', async () => {
  total = undefined;
  const result = await brief();
  expect(result.data.status).toBe('partial');
  expect(result.meta.partial).toBe(true);
  expect(result.data.gaps.join(' ')).toContain('first-page');
  expect(fetches).toHaveBeenCalledTimes(3);
});
it('stops a failed detail read without losing search facts or retrying', async () => {
  failureStatus = 500;
  const result = await brief();
  expect(result.data.status).toBe('partial');
  expect(result.data.entities).toHaveLength(2);
  expect(result.data.reads[1].status).toBe('error');
  expect(fetches).toHaveBeenCalledTimes(3);
  expect(result.data.entities[0].unknownFields).toContain('description');
});
it('stops at rate limiting without starting detail work', async () => {
  failureStatus = 429;
  const result = await brief();
  expect(result.data.reads).toHaveLength(1);
  expect(result.data.entities).toEqual([]);
  expect(result.data.reads[0].code).toBe('RATE_LIMITED');
  expect(fetches).toHaveBeenCalledTimes(2);
});
it('omits mismatched detail identity and never cites its facts', async () => {
  detailMismatch = true;
  const result = await brief();
  expect(result.data.gaps.join(' ')).toContain('identity differs');
  expect(result.data.entities[0].facts.every((f: any) => f.sourceTool === 'search_jobs')).toBe(
    true,
  );
});
it('marks excerpts, escapes source Markdown, and retains conflicting observations', async () => {
  detail.title = '[Different](https://evil.invalid) <script>';
  detail.description = 'x'.repeat(5000);
  const result = await brief();
  expect(
    result.data.entities[0].facts.find((f: any) => f.field === 'description').value,
  ).toHaveLength(4000);
  expect(result.data.markdown).toContain('[excerpt truncated]');
  expect(result.data.markdown).toContain('\\[Different\\]');
  expect(result.data.status).toBe('partial');
  expect(result.data.gaps.join(' ')).toContain('titles differ');
});
it('returns honest empty results without detail reads', async () => {
  searchRows = [];
  total = 0;
  const result = await brief();
  expect(result.data.status).toBe('empty');
  expect(result.data.bounds.toolCalls).toBe(1);
  expect(result.data.markdown).toContain('does not establish');
  expect(fetches).toHaveBeenCalledTimes(2);
});
it('honors explicit no-enrichment and hard input bounds', async () => {
  const result = await brief({ enrich_first: false });
  expect(result.data.bounds.toolCalls).toBe(1);
  const invalid = await client.callTool({
    name: 'research_jobs',
    arguments: { keywords: 'test', count: 11 },
  });
  expect(invalid.isError).toBe(true);
  expect(fetches).toHaveBeenCalledTimes(2);
});
it('deduplicates jobs and drops unlinked entities without inventing sources', async () => {
  searchRows = [
    searchRows[0]!,
    searchRows[0]!,
    { $type: 'com.linkedin.voyager.jobs.JobPosting', title: 'Unlinked' },
  ];
  total = 3;
  const result = await brief({ count: 3, enrich_first: false });
  expect(result.data.entities).toHaveLength(1);
  expect(result.data.status).toBe('partial');
  expect(result.data.gaps.join(' ')).toContain('source URL');
  expect(result.data.gaps.join(' ')).toContain('Duplicate');
});
it('keeps separate request ceilings through delayed queue callbacks', async () => {
  const queue = new SerialQueue();
  let release!: () => void;
  const blocker = queue.enqueue(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const a = { maximum: 3, attempts: 0 };
  const b = { maximum: 3, attempts: 0 };
  const one = readLimit.run(a, () =>
    queue.enqueue(
      bindCancellation(async () => {
        reserveReadAttempt();
      }),
    ),
  );
  const two = readLimit.run(b, () =>
    queue.enqueue(
      bindCancellation(async () => {
        for (let i = 0; i < 3; i++) reserveReadAttempt();
        expect(() => reserveReadAttempt()).toThrow(ReadLimitError);
      }),
    ),
  );
  release();
  await Promise.all([blocker, one, two]);
  expect(a.attempts).toBe(1);
  expect(b.attempts).toBe(3);
  reserveReadAttempt(); // unrelated legacy reads have no brief ceiling
});
it('enforces a spent ceiling before reaching the actual page boundary', async () => {
  const state = { maximum: 3, attempts: 3 };
  await expect(
    readLimit.run(state, () => runtime.voyager.voyagerGet('/me')),
  ).rejects.toBeInstanceOf(ReadLimitError);
  expect(fetches).not.toHaveBeenCalled();
  expect(state.attempts).toBe(3);
});

it('caps an oversized provider page at ten entities with no additional reads', async () => {
  searchRows = Array.from({ length: 12 }, (_, i) => ({
    $type: 'com.linkedin.voyager.jobs.JobPosting',
    title: `Role ${i}`,
    entityUrn: `urn:li:fsd_jobPosting:${i + 1}`,
  }));
  total = undefined;
  const result = await brief({ count: 10 });
  expect(result.data.entities).toHaveLength(10);
  expect(fetches).toHaveBeenCalledTimes(3);
  expect(result.data.bounds.readAttempts).toBe(3);
  expect(result.data.status).toBe('partial');
});
it('retains search facts if extra identity work exhausts the ceiling before detail', async () => {
  const ensure = runtime.identity.ensure.bind(runtime.identity);
  let extraIdentity = false;
  vi.spyOn(runtime.identity, 'ensure').mockImplementation(async (force = false) => {
    if (fetches.mock.calls.length >= 2 && !extraIdentity) {
      extraIdentity = true;
      await runtime.voyager.voyagerGet('/me');
    }
    await ensure(force);
  });
  const result = await brief();
  expect(result.data.entities).toHaveLength(2);
  expect(result.data.bounds.readAttempts).toBe(3);
  expect(result.data.status).toBe('partial');
  expect(result.data.reads[1].code).toBe('READ_LIMIT_REACHED');
  expect(fetches).toHaveBeenCalledTimes(3);
});
