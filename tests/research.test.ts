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
import * as registration from '../src/tools/register.js';
import { briefObservation } from '../scripts/job-brief-observation.js';
const identity = JSON.parse(
  readFileSync(new URL('./fixtures/contracts-v1.json', import.meta.url), 'utf8'),
).response;
let dir: string;
let runtime: ReturnType<typeof createRuntime>;
let server: ReturnType<typeof createServer>['server'];
let client: Client;
let fetches: ReturnType<typeof vi.fn>;
let searchRows: Record<string, unknown>[];
let total: number | undefined;
let failureStatus: number | undefined;
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
  total = 2;
  failureStatus = undefined;
  fetches = vi.fn(async (_fn, { url }: { url: string }) => {
    const isIdentity = url.endsWith('/me');
    const status = !isIdentity ? (failureStatus ?? 200) : 200;
    const data = isIdentity
      ? identity
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
it('defaults to search-only with exact citations within two cold read attempts', async () => {
  const result = await brief();
  expect(result.data.query.enrichFirst).toBe(false);
  expect(result.data.bounds).toEqual({
    maxReadAttempts: 2,
    readAttempts: 2,
    maxEntities: 10,
    maxToolCalls: 1,
    toolCalls: 1,
  });
  expect(result).toMatchObject({ data: { status: 'ok' }, meta: { status: 'ok', partial: false } });
  expect(result.data.entities).toHaveLength(2);
  expect(result.data.reads).toHaveLength(1);
  for (const entity of result.data.entities) {
    expect(entity.facts.map((fact: any) => fact.field)).toEqual(['title', 'location', 'listedAt']);
    for (const fact of entity.facts) {
      expect(fact.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(fact.sourceUrl).toBe(entity.sourceUrl);
      expect(fact.sourceTool).toBe('search_jobs');
      expect(result.data.markdown).toContain(`[source](${entity.sourceUrl})`);
    }
    expect(entity.unknownFields).toEqual([]);
  }
  expect(result.data.markdown).toContain('Salary, fit and availability are not inferred');
  expect(result.data.markdown).toContain('search-only; detail enrichment is unavailable');
  const urls = fetches.mock.calls.map((call) => call[1].url);
  expect(urls.filter((url) => url.endsWith('/me'))).toHaveLength(1);
  expect(urls.filter((url) => url.includes('/voyagerJobsDashJobCards?'))).toHaveLength(1);
  expect(urls.some((url) => url.includes('/jobs/jobPostings/') || url.includes('/graphql'))).toBe(
    false,
  );
  expect(fetches).toHaveBeenCalledTimes(2);
});

it('advertises and validates false-only enrichment before reaching any provider read', async () => {
  const tools = await client.listTools();
  const tool = tools.tools.find((entry) => entry.name === 'research_jobs')!;
  expect(tool.inputSchema.properties?.enrich_first).toMatchObject({ const: false, default: false });
  const invalid = await client.callTool({
    name: 'research_jobs',
    arguments: { keywords: 'test', enrich_first: true },
  });
  expect(invalid.isError).toBe(true);
  expect(fetches).not.toHaveBeenCalled();
  expect(runtime.engine.ensureContext).not.toHaveBeenCalled();
});

it.each([{ count: 0 }, { count: 11 }, { keywords: ' ' }, { location_geo_id: 'unknown' }])(
  'rejects invalid input before provider reads: %j',
  async (invalid) => {
    const result = await client.callTool({
      name: 'research_jobs',
      arguments: { keywords: 'test', ...invalid },
    });
    expect(result.isError).toBe(true);
    expect(fetches).not.toHaveBeenCalled();
  },
);

it('marks a coherent title-only page insufficient without any detail read', async () => {
  searchRows = searchRows.map(({ entityUrn, title, $type }) => ({ entityUrn, title, $type }));
  const result = await brief();
  expect(result.data.reads[0].status).toBe('ok');
  expect(result).toMatchObject({
    data: {
      status: 'partial',
      comparisonEvidence: { sufficientEntities: 0, insufficientEntities: 2 },
    },
    meta: { status: 'partial', partial: true },
  });
  expect(result.data.markdown).toContain('Insufficient evidence to compare these jobs');
  expect(result.data.nextSteps[0]).toContain('lacks enough observed facts');
  expect(
    result.data.entities.every((entity: any) =>
      entity.facts.every((fact: any) => fact.field === 'title'),
    ),
  ).toBe(true);
  expect(result.data.entities[0].unknownFields).toEqual(['location', 'listedAt']);
  expect(fetches).toHaveBeenCalledTimes(2);
});

it.each([
  { comparison: { formattedLocation: 'Synthetic town' }, field: 'location' },
  { comparison: { listedAt: 1000 }, field: 'listedAt' },
])(
  'retains a useful same-job $field observation alongside insufficient title-only jobs',
  async ({ comparison, field }) => {
    searchRows = [
      {
        $type: 'fixture.JobPosting',
        entityUrn: 'urn:li:fsd_jobPosting:1',
        title: 'Synthetic observed role',
        ...comparison,
      },
      { $type: 'fixture.JobPosting', entityUrn: 'urn:li:jobPosting:2', title: 'Title only' },
    ];
    const start = Date.now();
    const response = await client.callTool({
      name: 'research_jobs',
      arguments: { keywords: 'engineering', count: 2, enrich_first: false },
    });
    const result = response.structuredContent as any;
    expect(briefObservation(response, start, Date.now())).toMatchObject({
      usefulEntities: 1,
      entities: 2,
      factChecks: 3,
      dataStatus: 'partial',
      metaStatus: 'partial',
      bounds: { readAttempts: 2, toolCalls: 1 },
    });
    expect(result.data.comparisonEvidence).toEqual({
      sufficientEntities: 1,
      insufficientEntities: 1,
    });
    expect(result.data.entities[0].facts.map((fact: any) => fact.field)).toEqual(['title', field]);
    expect(result.data.entities[1].facts).toHaveLength(1);
    expect(fetches).toHaveBeenCalledTimes(2);
  },
);

it.each([
  { title: 'Role 1', workRemoteAllowed: true },
  {
    title: 'Role 1',
    companyDetails: { name: 'Unsupported company' },
    description: 'Unsupported description',
  },
  { formattedLocation: 'Synthetic town' },
])(
  'does not qualify workplace/company/description-only or untitled observations as useful: %j',
  async (fields) => {
    searchRows = [{ $type: 'fixture.JobPosting', entityUrn: 'urn:li:fsd_jobPosting:1', ...fields }];
    total = 1;
    const result = await brief({ count: 1 });
    expect(result).toMatchObject({
      data: {
        status: 'partial',
        comparisonEvidence: { sufficientEntities: 0, insufficientEntities: 1 },
      },
      meta: { status: 'partial', partial: true },
    });
    expect(result.data.markdown).toContain('Insufficient evidence to compare these jobs');
    expect(JSON.stringify(result)).not.toContain('Unsupported company');
    expect(JSON.stringify(result)).not.toContain('Unsupported description');
    expect(fetches).toHaveBeenCalledTimes(2);
  },
);

it.each([-1, Number.MAX_VALUE, Date.now() + 86_400_000])(
  'omits invalid or future listing time %s rather than inventing freshness',
  async (listedAt) => {
    searchRows = [
      {
        $type: 'fixture.JobPosting',
        entityUrn: 'urn:li:jobPosting:1',
        title: 'Title only',
        listedAt,
      },
    ];
    total = 1;
    const result = await brief({ count: 1 });
    expect(result.data.entities[0].facts.map((fact: any) => fact.field)).toEqual(['title']);
    expect(result.data.entities[0].unknownFields).toContain('listedAt');
    expect(result.data.comparisonEvidence.sufficientEntities).toBe(0);
    expect(result.data.status).toBe('partial');
    expect(fetches).toHaveBeenCalledTimes(2);
  },
);

it('escapes source Markdown and marks excerpts without inferring extra fields', async () => {
  searchRows[0]!.title = '[Different](https://evil.invalid) <script>' + 'x'.repeat(500);
  const result = await brief();
  const title = result.data.entities[0].facts.find((fact: any) => fact.field === 'title');
  expect(title.value).toHaveLength(300);
  expect(title.truncated).toBe(true);
  expect(result.data.markdown).toContain('[excerpt truncated]');
  expect(result.data.markdown).toContain('\\[Different\\]');
  expect(result.data.gaps.join(' ')).toContain('excerpts');
  expect(fetches).toHaveBeenCalledTimes(2);
});

it('validates SDK JSON representation and rejects altered content in memory', async () => {
  const start = Date.now();
  const result = await client.callTool({
    name: 'research_jobs',
    arguments: { keywords: 'engineering', count: 2 },
  });
  expect(briefObservation(result, start, Date.now())).toMatchObject({
    contractChecked: true,
    entities: 2,
    usefulEntities: 2,
    dataStatus: 'ok',
    metaStatus: 'ok',
    bounds: { readAttempts: 2, toolCalls: 1 },
  });
  const content = (result.content as { type: string; text: string }[]).map((part) => ({
    ...part,
    text: part.text.replace('Role 1', 'Forged title'),
  }));
  expect(() => briefObservation({ ...result, content }, start, Date.now())).toThrow();
  expect(fetches).toHaveBeenCalledTimes(2);
});

it.each([401, 403, 429, 500])(
  'stops provider status %s with no retries or other read tools',
  async (status) => {
    failureStatus = status;
    const result = await brief();
    expect(result).toMatchObject({
      data: { status: 'partial', entities: [] },
      meta: { status: 'partial', partial: true },
    });
    expect(result.data.reads).toHaveLength(1);
    expect(result.data.reads[0].status).toBe('error');
    expect(fetches).toHaveBeenCalledTimes(2);
    expect(fetches.mock.calls.some((call) => call[1].url.includes('/jobs/jobPostings/'))).toBe(
      false,
    );
  },
);

it('returns a coherent zero-total page empty in both SDK fields', async () => {
  searchRows = [];
  total = 0;
  const result = await brief();
  expect(result).toMatchObject({
    data: {
      status: 'empty',
      entities: [],
      comparisonEvidence: { sufficientEntities: 0, insufficientEntities: 0 },
    },
    meta: { status: 'empty', partial: false },
  });
  expect(result.data.bounds).toMatchObject({ readAttempts: 2, toolCalls: 1 });
  expect(result.data.markdown).toContain('does not establish');
  expect(fetches).toHaveBeenCalledTimes(2);
});

it('keeps an empty page with unknown completeness partial in both SDK fields', async () => {
  searchRows = [];
  total = undefined;
  const result = await brief();
  expect(result).toMatchObject({
    data: { status: 'partial', entities: [] },
    meta: { status: 'partial', partial: true },
  });
  expect(result.data.reads[0].status).toBe('partial');
  expect(fetches).toHaveBeenCalledTimes(2);
});

it.each([0, 1])(
  'keeps contradictory paging with %s rows partial in both brief fields',
  async (rows) => {
    searchRows = searchRows.slice(0, rows);
    total = 2;
    const result = await brief();
    expect(result).toMatchObject({
      data: { status: 'partial' },
      meta: { status: 'partial', partial: true },
    });
    expect(result.data.entities).toHaveLength(rows);
    expect(result.data.reads[0].status).toBe('partial');
    expect(fetches).toHaveBeenCalledTimes(2);
  },
);

it.each(['jobPosting', 'fsd_jobPosting'])(
  'attributes supported %s search identity to its exact numeric source',
  async (namespace) => {
    searchRows = [{ ...searchRows[0], entityUrn: `urn:li:${namespace}:7` }];
    total = 1;
    const result = await brief({ count: 1 });
    expect(result.data.entities[0].sourceUrl).toBe('https://www.linkedin.com/jobs/view/7/');
    expect(result.data.comparisonEvidence.sufficientEntities).toBe(1);
    expect(
      result.data.entities[0].facts.every(
        (fact: any) => fact.sourceUrl === result.data.entities[0].sourceUrl,
      ),
    ).toBe(true);
  },
);

it.each([
  undefined,
  'urn:li:fs_normalized_jobPosting:1',
  'urn:li:jobPostingCard:1',
  'urn:li:jobPosting:1\n',
  'urn:li:jobPosting:unknown',
])(
  'omits unsupported or absent search identity without attributing its facts: %s',
  async (entityUrn) => {
    searchRows = [{ ...searchRows[0], entityUrn }];
    total = 1;
    const result = await brief({ count: 1 });
    expect(result).toMatchObject({
      data: { status: 'partial', entities: [] },
      meta: { status: 'partial', partial: true },
    });
    expect(result.data.gaps.join(' ')).toContain('identity/source agreement');
    expect(result.data.comparisonEvidence.sufficientEntities).toBe(0);
    expect(fetches).toHaveBeenCalledTimes(2);
  },
);

it.each([
  { field: 'jobUrn', value: undefined },
  { field: 'jobUrn', value: 'urn:li:fs_normalized_jobPosting:1' },
  { field: 'jobUrn', value: 'urn:li:jobPosting:99' },
  { field: 'jobUrn', value: 'urn:li:fsd_jobPosting:1\n' },
  { field: 'sourceUrl', value: 'https://www.linkedin.com/jobs/view/99/' },
  { field: 'sourceUrl', value: 'https://www.linkedin.com/jobs/view/1/\n' },
])(
  'independently rejects composed search $field without exact job-source agreement',
  async ({ field, value }) => {
    const invoke = registration.invokeBriefRead;
    vi.spyOn(registration, 'invokeBriefRead').mockImplementation(async (...args) => {
      const response = await invoke(...args);
      const structuredContent = structuredClone(response.structuredContent)!;
      (structuredContent.data as Record<string, unknown>[])[0]![field] = value;
      return {
        ...response,
        structuredContent,
        content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }],
      };
    });
    const result = await brief({ count: 1 });
    expect(result).toMatchObject({
      data: { status: 'partial', entities: [] },
      meta: { status: 'partial', partial: true },
    });
    expect(result.data.gaps.join(' ')).toContain('identity/source agreement');
    expect(fetches).toHaveBeenCalledTimes(2);
  },
);

it('deduplicates identical sources and drops unlinked rows without inventing citations', async () => {
  searchRows = [searchRows[0]!, searchRows[0]!, { $type: 'fixture.JobPosting', title: 'Unlinked' }];
  total = 3;
  const result = await brief({ count: 3 });
  expect(result.data.entities).toHaveLength(1);
  expect(result.data.status).toBe('partial');
  expect(result.data.gaps.join(' ')).toContain('identity/source agreement');
  expect(result.data.gaps.join(' ')).toContain('Duplicate');
  expect(fetches).toHaveBeenCalledTimes(2);
});

it('caps an oversized provider page at ten with no extra reads or cursor following', async () => {
  searchRows = Array.from({ length: 12 }, (_, i) => ({
    $type: 'fixture.JobPosting',
    title: `Role ${i}`,
    formattedLocation: 'Synthetic town',
    entityUrn: `urn:li:fsd_jobPosting:${i + 1}`,
  }));
  total = undefined;
  const start = Date.now();
  const incoming = await client.callTool({
    name: 'research_jobs',
    arguments: { keywords: 'engineering', count: 10 },
  });
  const result = incoming.structuredContent as any;
  expect(result.data.entities).toHaveLength(10);
  expect(briefObservation(incoming, start, Date.now())).toMatchObject({
    entities: 10,
    usefulEntities: 10,
    bounds: { readAttempts: 2, toolCalls: 1 },
  });
  expect(result.data.status).toBe('partial');
  expect(fetches).toHaveBeenCalledTimes(2);
});

it('does not exceed the two-attempt ceiling if extra identity work precedes search', async () => {
  const ensure = runtime.identity.ensure.bind(runtime.identity);
  vi.spyOn(runtime.identity, 'ensure').mockImplementation(async (force = false) => {
    reserveReadAttempt(); // Simulate one extra reserved identity operation before the cold read.
    await ensure(force);
  });
  const result = await brief();
  expect(result.data.entities).toEqual([]);
  expect(result.data.reads[0]).toMatchObject({ status: 'error', code: 'READ_LIMIT_REACHED' });
  expect(result.data.bounds).toMatchObject({ readAttempts: 2, toolCalls: 1 });
  expect(result.data.status).toBe('partial');
  expect(fetches).toHaveBeenCalledTimes(1);
  expect(fetches.mock.calls.every((call) => call[1].url.endsWith('/me'))).toBe(true);
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
  const a = { maximum: 2, attempts: 0 };
  const b = { maximum: 2, attempts: 0 };
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
        for (let i = 0; i < 2; i++) reserveReadAttempt();
        expect(() => reserveReadAttempt()).toThrow(ReadLimitError);
      }),
    ),
  );
  release();
  await Promise.all([blocker, one, two]);
  expect(a.attempts).toBe(1);
  expect(b.attempts).toBe(2);
  reserveReadAttempt(); // unrelated legacy reads have no brief ceiling
});
it('enforces a spent ceiling before reaching the actual page boundary', async () => {
  const state = { maximum: 2, attempts: 2 };
  await expect(
    readLimit.run(state, () => runtime.voyager.voyagerGet('/me')),
  ).rejects.toBeInstanceOf(ReadLimitError);
  expect(fetches).not.toHaveBeenCalled();
  expect(state.attempts).toBe(2);
});
