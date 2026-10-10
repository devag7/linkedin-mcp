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
  observeJobIdentifiers,
  recordJobIdentifiers,
} from '../src/tools/job-detail-diagnostic.js';
import type { JobIdentifierObservation } from '../src/browser/job-identifier-diagnostic.js';
import * as normalize from '../src/browser/normalize.js';
import * as registration from '../src/tools/register.js';
import { registerTool } from '../src/tools/register.js';
import { ok } from '../src/tools/result.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JOB_DETAIL_STRUCTURE_CHECKS } from '../src/browser/job-detail-selection.js';

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

describe('SDK identity-aware job-detail selection', () => {
  it.each([
    { label: 'matching reference alone', included: [] },
    {
      label: 'matching title-only metadata',
      included: [{ title: 'Metadata', entityUrn: 'urn:li:jobPosting:123' }],
    },
    {
      label: 'mismatched referenced job',
      included: [{ title: 'Other', jobState: 'SYNTHETIC', entityUrn: 'urn:li:jobPosting:99' }],
    },
    {
      label: 'duplicate referenced jobs',
      included: [
        { title: 'First', jobState: 'SYNTHETIC', entityUrn: 'urn:li:jobPosting:123' },
        { title: 'Second', jobState: 'SYNTHETIC', entityUrn: 'urn:li:jobPosting:123' },
      ],
    },
  ])('does not certify unsupported detail identity from $label', async ({ included }) => {
    raw = {
      data: {
        $type: 'fixture.JobPosting',
        title: 'Uncertified',
        description: 'Uncertified facts',
        entityUrn: 'urn:li:synthetic_unsupported:123',
        '*jobPosting': 'urn:li:jobPosting:123',
        jobId: '123',
        url: 'https://www.linkedin.com/jobs/view/123/',
      },
      included,
    };
    const checks = diagnostic(true);
    const { result, envelope } = await call('get_job_details', { job_id: '123' });
    expect(result.isError).toBe(true);
    expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
    expect(checks).toContain('reference_supported_match');
    expect(checks).not.toContain('identity_match');
    expect(JSON.stringify(envelope)).not.toMatch(/Uncertified|jobs\/view/);
    expect(fetches).toHaveBeenCalledTimes(2);
  });

  it('selects only a uniquely verified included job and never borrows referenced wrapper facts', async () => {
    raw = {
      data: {
        title: 'Wrapper',
        description: 'WRAPPER-PRIVATE-CONTENT',
        entityUrn: 'urn:li:synthetic_unsupported:123',
        '*jobPosting': 'urn:li:jobPosting:123',
      },
      included: [{ title: 'Selected', jobState: 'SYNTHETIC', entityUrn: 'urn:li:jobPosting:123' }],
    };
    const { result, envelope } = await call('get_job_details', { job_id: '123' });
    expect(result.isError).not.toBe(true);
    expect(envelope.data).toMatchObject({
      title: 'Selected',
      sourceUrl: 'https://www.linkedin.com/jobs/view/123/',
    });
    expect(envelope.data.description).toBeUndefined();
    expect(JSON.stringify(envelope.data)).not.toMatch(/Wrapper|WRAPPER/);
    expect(fetches).toHaveBeenCalledTimes(2);
  });

  it.each(['urn:li:jobPosting:123', 'urn:li:fsd_jobPosting:123'])(
    'selects a unique matching %s behind an unsupported first object',
    async (urn) => {
      raw = {
        data: {
          title: 'Unrelated first title',
          description: 'Unrelated description',
          formattedLocation: 'Unrelated location',
          companyDetails: { name: 'Unrelated employer' },
          entityUrn: 'urn:li:other:123',
        },
        included: [
          {
            title: 'Selected title',
            description: { text: 'Selected description' },
            formattedLocation: 'Selected location',
            companyDetails: { name: 'Selected employer' },
            entityUrn: urn,
          },
        ],
      };
      const { result, envelope } = await call('get_job_details', { job_id: '123' });
      expect(result.isError).not.toBe(true);
      expect(envelope.data).toMatchObject({
        title: 'Selected title',
        description: 'Selected description',
        location: 'Selected location',
        company: 'Selected employer',
        jobUrn: urn,
        sourceUrl: 'https://www.linkedin.com/jobs/view/123/',
      });
      expect(JSON.stringify(envelope.data)).not.toContain('Unrelated');
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['data array, before', 'data array, after', 'nested data', 'nested included'])(
    'finds one exact match independent of ordering/container: %s',
    async (placement) => {
      const selected = {
        title: 'Selected',
        jobState: 'SYNTHETIC',
        entityUrn: 'urn:li:jobPosting:123',
      };
      const other = {
        title: 'Other',
        description: 'Must not leak',
        entityUrn: 'urn:li:fsd_jobPosting:99',
      };
      raw =
        placement === 'data array, before'
          ? { data: { rows: [other, selected] } }
          : placement === 'data array, after'
            ? { data: { rows: [selected, other] } }
            : placement === 'nested data'
              ? { data: { ...other, children: { selected } } }
              : { data: other, included: [{ wrapped: selected }] };
      const { envelope } = await call('get_job_details', { job_id: '123' });
      expect(envelope.data).toMatchObject({
        title: 'Selected',
        jobUrn: selected.entityUrn,
        sourceUrl: 'https://www.linkedin.com/jobs/view/123/',
      });
      expect(envelope.data.description).toBeUndefined();
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    { label: 'absent', urn: undefined, stage: 'identity_absent' },
    { label: 'non-string', urn: 123, stage: 'identity_absent' },
    { label: 'unsupported namespace', urn: 'urn:li:other:123', stage: 'identity_unsupported' },
    { label: 'wrong legacy ID', urn: 'urn:li:jobPosting:99', stage: 'identity_mismatch' },
    { label: 'wrong dash ID', urn: 'urn:li:fsd_jobPosting:99', stage: 'identity_mismatch' },
    { label: 'trailing newline', urn: 'urn:li:jobPosting:123\n', stage: 'identity_unsupported' },
    { label: 'boundary spaces', urn: ' urn:li:fsd_jobPosting:123 ', stage: 'identity_unsupported' },
    {
      label: 'overlong numeric ID',
      urn: 'urn:li:jobPosting:123456789012345678901',
      stage: 'identity_unsupported',
    },
    {
      label: 'blank matching title',
      urn: 'urn:li:jobPosting:123',
      title: '   ',
      stage: 'title_missing',
    },
  ])(
    'rejects $label with no certified selection, no source attribution and no retry',
    async ({ urn, title, stage }) => {
      raw = { data: { title: title ?? 'Synthetic', jobState: 'SYNTHETIC', entityUrn: urn } };
      const checks = diagnostic();
      const { result, envelope } = await call('get_job_details', { job_id: '123' });
      expect(result.isError).toBe(true);
      expect(envelope).toMatchObject({
        data: null,
        code: 'RESPONSE_SHAPE_CHANGED',
        meta: { status: 'error' },
      });
      expect(checks).toContain(stage);
      expect(JSON.stringify(envelope)).not.toContain('jobs/view/');
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    'same form with conflicting facts',
    'both supported forms',
    'identical separate objects',
  ])('rejects two matching objects as ambiguous: %s', async (variant) => {
    const first = {
      title: 'First',
      description: 'First facts',
      entityUrn: 'urn:li:jobPosting:123',
    };
    const second =
      variant === 'identical separate objects'
        ? { ...first }
        : {
            title: 'Second',
            description: 'Second facts',
            entityUrn:
              variant === 'both supported forms' ? 'urn:li:fsd_jobPosting:123' : first.entityUrn,
          };
    raw = { data: first, included: [second] };
    const checks = diagnostic(true);
    const { result, envelope } = await call('get_job_details', { job_id: '123' });
    expect(result.isError).toBe(true);
    expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
    expect(checks.filter((check) => check === 'candidate_supported_match')).toHaveLength(2);
    expect(checks).toContain('selection_ambiguous');
    expect(checks).toContain('identity_ambiguous');
    expect(checks).not.toContain('identity_match');
    expect(JSON.stringify(envelope)).not.toMatch(/First facts|Second facts|jobs\/view/);
    expect(fetches).toHaveBeenCalledTimes(2);
  });

  it('does not borrow an unrelated title or comparison facts for a matching blank-title job', async () => {
    raw = {
      data: { title: 'Other', description: 'Unrelated facts', entityUrn: 'urn:li:other:123' },
      included: [{ title: ' ', jobState: 'SYNTHETIC', entityUrn: 'urn:li:fsd_jobPosting:123' }],
    };
    const { envelope } = await call('get_job_details', { job_id: '123' });
    expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
    expect(fetches).toHaveBeenCalledTimes(2);
  });

  it('never promotes a title-only metadata object to a certified job candidate', async () => {
    raw = {
      data: { title: 'Unsupported', description: 'Synthetic', entityUrn: 'urn:li:other:123' },
      included: [{ title: 'Metadata only', entityUrn: 'urn:li:jobPosting:123' }],
    };
    const { envelope } = await call('get_job_details', { job_id: '123' });
    expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
    expect(fetches).toHaveBeenCalledTimes(2);
  });

  it('retains exact brief provenance and the three-attempt ceiling when a unique nested match is enriched', async () => {
    const detail = {
      data: { title: 'Wrong first object', description: 'Unrelated', entityUrn: 'urn:li:other:1' },
      included: [
        {
          title: 'Selected',
          formattedLocation: 'Synthetic location',
          entityUrn: 'urn:li:fsd_jobPosting:1',
        },
      ],
    };
    fetches.mockImplementation(async (_fn, { url }: { url: string }) => ({
      status: 200,
      ok: true,
      type: 'basic',
      url,
      body: JSON.stringify(
        url.endsWith('/me')
          ? identity
          : url.includes('/jobs/jobPostings/')
            ? detail
            : page(1, 1, 0, 1),
      ),
    }));
    const { result, envelope } = await call('research_jobs', { keywords: 'synthetic', count: 1 });
    expect(result.isError).not.toBe(true);
    const brief = envelope.data;
    expect(brief.comparisonEvidence).toMatchObject({
      sufficientEntities: 1,
      insufficientEntities: 0,
    });
    expect(brief.bounds).toMatchObject({ readAttempts: 3, toolCalls: 2 });
    expect(brief.entities[0].sourceUrl).toBe('https://www.linkedin.com/jobs/view/1/');
    expect(brief.entities[0].facts).toContainEqual(
      expect.objectContaining({
        field: 'location',
        value: 'Synthetic location',
        sourceTool: 'get_job_details',
        sourceUrl: brief.entities[0].sourceUrl,
      }),
    );
    expect(JSON.stringify(brief.entities)).not.toMatch(/Wrong first object|Unrelated/);
    expect(fetches).toHaveBeenCalledTimes(3);
  });
});

describe('SDK value-free identifier format classification', () => {
  it.each([
    { reference: undefined, check: 'reference_missing' },
    { reference: null, check: 'reference_missing' },
    { reference: '', check: 'reference_missing' },
    { reference: { private: 'PRIVATE-REFERENCE' }, check: 'reference_non_string' },
    { reference: 'urn:li:jobPosting:73129', check: 'reference_supported_match' },
    { reference: 'urn:li:fsd_jobPosting:73129', check: 'reference_supported_match' },
    { reference: 'urn:li:jobPosting:77', check: 'reference_supported_other' },
    { reference: 'urn:li:PRIVATE-REFERENCE:73129', check: 'reference_unsupported' },
    { reference: ' urn:li:jobPosting:73129 ', check: 'reference_unsupported' },
  ])('observes $check without promoting a reference to identity', async ({ reference, check }) => {
    raw = {
      data: {
        title: 'PRIVATE-REFERENCE-TITLE',
        jobState: 'SYNTHETIC',
        entityUrn: 'urn:li:PRIVATE-REFERENCE:73129',
        '*jobPosting': reference,
      },
    };
    const checks = diagnostic(true);
    const { envelope } = await call('get_job_details', { job_id: '73129' });
    expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
    expect(checks.filter((value) => value.startsWith('reference_'))).toEqual([check]);
    expect(JSON.stringify(checks)).not.toMatch(/73129|PRIVATE|urn:|https:|\*jobPosting/);
    expect(checks.every((value) => (JOB_DETAIL_CHECKS as readonly string[]).includes(value))).toBe(
      true,
    );
    expect(fetches).toHaveBeenCalledTimes(2);
  });

  it.each([
    { urn: undefined, format: 'format_missing' },
    { urn: null, format: 'format_missing' },
    { urn: '', format: 'format_missing' },
    { urn: 73129, format: 'format_non_string' },
    { urn: { secret: 'PRIVATE-STRUCTURE-VALUE' }, format: 'format_non_string' },
    { urn: 'urn:li:jobPosting:73129', format: 'format_supported_legacy', accepted: true },
    { urn: 'urn:li:fsd_jobPosting:73129', format: 'format_supported_dash', accepted: true },
    { urn: ' urn:li:jobPosting:73129 ', format: 'format_supported_after_trim', whitespace: true },
    {
      urn: 'urn:li:fsd_jobPosting:73129\n',
      format: 'format_supported_after_trim',
      whitespace: true,
    },
    { urn: 'urn:li:jobPosting:', format: 'format_known_prefix_empty' },
    {
      urn: 'urn:li:fsd_jobPosting:PRIVATE-STRUCTURE-VALUE',
      format: 'format_known_prefix_non_numeric',
    },
    {
      urn: 'urn:li:jobPosting:731291234567890123456',
      format: 'format_known_prefix_numeric_over_limit',
    },
    { urn: 'urn:li:PRIVATE-STRUCTURE-VALUE:73129', format: 'format_other_linkedin_urn' },
    { urn: 'urn:PRIVATE-STRUCTURE-VALUE:73129', format: 'format_other_urn' },
    { urn: 'https://private.invalid/73129/PRIVATE-STRUCTURE-VALUE', format: 'format_non_urn' },
  ])(
    'retains only fixed classifications for $format',
    async ({ urn, format, accepted, whitespace }) => {
      raw = {
        data: {
          title: 'PRIVATE-STRUCTURE-TITLE',
          description: 'PRIVATE-STRUCTURE-CONTENT',
          entityUrn: urn,
        },
      };
      const checks = diagnostic(true);
      const { result, envelope } = await call('get_job_details', { job_id: '73129' });
      expect(
        checks.filter(
          (check) => check.startsWith('format_') && check !== 'format_boundary_whitespace',
        ),
      ).toEqual([format]);
      expect(checks.includes('format_boundary_whitespace')).toBe(Boolean(whitespace));
      expect(
        checks.every((check) => (JOB_DETAIL_CHECKS as readonly string[]).includes(check)),
      ).toBe(true);
      const receipt = JSON.stringify(
        Object.fromEntries(
          JOB_DETAIL_CHECKS.map((check) => [
            check,
            checks.filter((observed) => observed === check).length,
          ]),
        ),
      );
      expect(receipt).not.toMatch(/73129|PRIVATE-STRUCTURE|urn:|https:|entityUrn|description/);
      if (accepted) {
        expect(result.isError).not.toBe(true);
        expect(envelope.data.sourceUrl).toBe('https://www.linkedin.com/jobs/view/73129/');
      } else {
        expect(result.isError).toBe(true);
        expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
        expect(checks).not.toContain('identity_match');
        expect(checks).toContain('selection_no_match');
      }
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );

  it('distinguishes a hidden unique match from unsupported and mismatched candidates without retaining values', async () => {
    raw = {
      data: { title: 'Private root', jobState: 'SYNTHETIC', entityUrn: 'urn:li:other:73129' },
      included: [
        { title: 'Private wrong job', jobState: 'SYNTHETIC', entityUrn: 'urn:li:jobPosting:77' },
        {
          title: 'Private selected job',
          formattedLocation: 'Private location',
          entityUrn: 'urn:li:fsd_jobPosting:73129',
        },
      ],
    };
    const checks = diagnostic(true);
    const { envelope } = await call('get_job_details', { job_id: '73129' });
    const count = (check: string) => checks.filter((observed) => observed === check).length;
    expect(count('candidate_in_data')).toBe(1);
    expect(count('candidate_in_included')).toBe(2);
    expect(count('candidate_unsupported')).toBe(1);
    expect(count('candidate_supported_other')).toBe(1);
    expect(count('candidate_supported_match')).toBe(1);
    expect(count('selection_unique')).toBe(1);
    expect(checks).toContain('identity_match');
    expect(envelope.data.title).toBe('Private selected job');
    expect(JSON.stringify(checks)).not.toMatch(/73129|Private|urn:|https:/);
    expect(fetches).toHaveBeenCalledTimes(2);
  });
});

function diagnostic(structural = false) {
  const checks: string[] = [];
  observeJobDetailChecks(server, (check) => {
    if (structural || !(JOB_DETAIL_STRUCTURE_CHECKS as readonly string[]).includes(check))
      checks.push(check);
  });
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
      if (urn.endsWith(':123')) {
        expect(checks.slice(0, 2)).toEqual(['envelope_accepted', 'title_present']);
        expect(envelope.data.sourceUrl).toBe('https://www.linkedin.com/jobs/view/123/');
      } else {
        expect(envelope).toMatchObject({ data: null, code: 'RESPONSE_SHAPE_CHANGED' });
        expect(checks).toEqual(['envelope_accepted', 'identity_mismatch']);
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
      ...(stage === 'identity_match' ? ['title_present'] : []),
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

describe('SDK opt-in redacted identifier observation', () => {
  it.each(['jobPosting', 'fsd_jobPosting'])(
    'keeps strict supported identity and source attribution: %s',
    async (namespace) => {
      const reports: JobIdentifierObservation[] = [];
      observeJobIdentifiers(server, (report) => reports.push(report));
      raw = {
        data: {
          title: 'Synthetic',
          description: 'Synthetic',
          entityUrn: 'urn:li:' + namespace + ':123',
        },
      };
      const { envelope } = await call('get_job_details', { job_id: '123' });
      expect(envelope.data.sourceUrl).toBe('https://www.linkedin.com/jobs/view/123/');
      expect(reports[0]!.supportedEntityBinding).toBe('unique');
      expect(JSON.stringify(reports)).not.toContain('123');
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );
  it.each(['urn:li:fsd_jobPostingCard:(123,PRIVATE_TOKEN)', 'urn:li:fs_normalized_jobPosting:123'])(
    'discloses a reviewed unsupported identifier without authorizing it: %s',
    async (urn) => {
      const reports: JobIdentifierObservation[] = [];
      observeJobIdentifiers(server, (report) => reports.push(report));
      raw = {
        data: {
          title: 'PRIVATE_TITLE',
          description: 'PRIVATE_CONTENT',
          entityUrn: urn,
          '*jobPosting': 'urn:li:fsd_jobPosting:123',
        },
      };
      const { envelope } = await call('get_job_details', { job_id: '123' });
      expect(envelope.code).toBe('RESPONSE_SHAPE_CHANGED');
      expect(envelope.data).toBeNull();
      expect(reports[0]).toMatchObject({
        diagnosticComplete: true,
        supportedEntityBinding: 'none',
        candidates: [{ relationship: 'different' }],
      });
      expect(JSON.stringify(reports)).not.toMatch(/123|PRIVATE_/);
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );
  it('preserves ambiguity even when every observed number matches', async () => {
    const reports: JobIdentifierObservation[] = [];
    observeJobIdentifiers(server, (report) => reports.push(report));
    const job = {
      title: 'Synthetic',
      description: 'Synthetic',
      entityUrn: 'urn:li:fsd_jobPosting:123',
    };
    raw = { data: job, included: [{ ...job }] };
    const { envelope } = await call('get_job_details', { job_id: '123' });
    expect(envelope.code).toBe('RESPONSE_SHAPE_CHANGED');
    expect(reports[0]!.supportedEntityBinding).toBe('ambiguous');
    expect(fetches).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])(
    'observer exceptions neither change rejection nor successful attribution (supported=%s)',
    async (supported) => {
      const checks = diagnostic(true);
      observeJobIdentifiers(server, () => {
        throw new Error('PRIVATE_OBSERVER_FAILURE');
      });
      raw = {
        data: {
          title: 'Synthetic',
          description: 'Synthetic',
          entityUrn: 'urn:li:' + (supported ? 'fsd_jobPosting' : 'PRIVATE_NAMESPACE') + ':123',
        },
      };
      const { envelope } = await call('get_job_details', { job_id: '123' });
      expect(checks).toContain('identifier_observer_failed');
      if (supported)
        expect(envelope.data.sourceUrl).toBe('https://www.linkedin.com/jobs/view/123/');
      else expect(envelope.code).toBe('RESPONSE_SHAPE_CHANGED');
      expect(JSON.stringify(envelope)).not.toContain('PRIVATE_OBSERVER_FAILURE');
      expect(fetches).toHaveBeenCalledTimes(2);
    },
  );
  it('observes the composed partial result with exactly three attempts and no extra read', async () => {
    const reports: JobIdentifierObservation[] = [];
    observeJobIdentifiers(server, (report) => reports.push(report));
    const original = fetches.getMockImplementation()!;
    fetches.mockImplementation(async (fn, args) =>
      args.url.includes('/voyager/api/jobs/jobPostings/')
        ? {
            status: 200,
            ok: true,
            type: 'basic',
            url: args.url,
            body: JSON.stringify({
              data: {
                title: 'PRIVATE_TITLE',
                description: 'PRIVATE_CONTENT',
                entityUrn: 'urn:li:fsd_jobPostingCard:(1,PRIVATE_TOKEN)',
              },
            }),
          }
        : original(fn, args),
    );
    raw = page(1, 1, 0, 1);
    const { envelope } = await call('research_jobs', {
      keywords: 'synthetic',
      count: 1,
      enrich_first: true,
    });
    expect(envelope.data.status).toBe('partial');
    expect(envelope.meta.status).toBe('partial');
    expect(envelope.data.reads[1].code).toBe('RESPONSE_SHAPE_CHANGED');
    expect(reports).toHaveLength(1);
    expect(JSON.stringify(reports)).not.toMatch(/PRIVATE_/);
    expect(fetches).toHaveBeenCalledTimes(3);
  });
  it('isolates per-server observers and handles detach/replacement without cross-server reports', () => {
    const other = new McpServer({ name: 'separate-identifier-fixture', version: '1' });
    const reports: JobIdentifierObservation[] = [];
    const detach = observeJobIdentifiers(server, (report) => reports.push(report));
    expect(() => observeJobIdentifiers(server, () => {})).toThrow(
      'JOB_IDENTIFIER_OBSERVER_ALREADY_ATTACHED',
    );
    const value = {
      data: {
        title: 'Synthetic',
        description: 'Synthetic',
        entityUrn: 'urn:li:fsd_jobPosting:123',
      },
    };
    recordJobIdentifiers(other, value, '123');
    expect(reports).toEqual([]);
    recordJobIdentifiers(server, value, '123');
    expect(reports).toHaveLength(1);
    detach();
    const replacement: JobIdentifierObservation[] = [];
    observeJobIdentifiers(server, (report) => replacement.push(report));
    detach();
    recordJobIdentifiers(server, value, '123');
    expect(replacement).toHaveLength(1);
    expect(reports).toHaveLength(1);
  });
});

it.each([
  { objectUrn: 'urn:li:jobPosting:123' },
  { objectUrn: 'urn:li:jobPosting:456' },
  { jobPostingUrn: 'urn:li:fsd_jobPosting:123' },
])(
  'does not promote public normalized/type/identity hints into trusted detail identity: %j',
  async (hint) => {
    raw = {
      data: {
        $type: 'com.linkedin.voyager.jobs.JobPosting',
        entityUrn: 'urn:li:fs_normalized_jobPosting:123',
        title: 'Synthetic normalized posting',
        description: 'Synthetic detail',
        ...hint,
      },
    };
    const { envelope } = await call('get_job_details', { job_id: '123' });
    expect(envelope.code).toBe('RESPONSE_SHAPE_CHANGED');
    expect(envelope.data).toBeNull();
    expect(JSON.stringify(envelope)).not.toContain('/jobs/view/123/');
    expect(fetches).toHaveBeenCalledTimes(2);
  },
);
