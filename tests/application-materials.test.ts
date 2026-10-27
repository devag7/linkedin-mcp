/** Pure and native SDK fixtures only: no browser, account or provider access. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRuntime, createServer } from '../src/server.js';
import { Logger } from '../src/types.js';
import { outputSchema } from '../src/tools/contracts.js';
import { ok } from '../src/tools/result.js';
import {
  ApplicationEvidenceError,
  applicationInputSchema,
  prepareApplicationMaterials,
  type ApplicationInput,
} from '../src/tools/application-materials.js';

const base: ApplicationInput = {
  job_id: '123',
  job_title: 'Synthetic engineer',
  requirements: [{ requirement: 'TypeScript' }],
};
const fact = {
  id: 'project-1',
  text: 'The team maintained a TypeScript library.',
  source_label: 'My project notes',
};
const reuse: ApplicationInput = {
  ...base,
  evidence_library: [
    fact,
    { id: 'unused', text: 'UNUSED_FACT_MUST_NOT_LEAK', source_label: 'UNUSED_LABEL' },
  ],
  requirements: [
    { requirement: 'TypeScript', evidence_ids: [fact.id] },
    { requirement: 'Reviewing code', evidence_ids: [fact.id] },
    { requirement: 'Incident response' },
  ],
  include_drafts: true,
};
const legacy = {
  status: 'draft_only',
  jobId: '123',
  sourceUrl: 'https://www.linkedin.com/jobs/view/123/',
  jobTitle: 'Synthetic engineer',
  company: null,
  sourceVerification: 'user_supplied_not_fetched',
  requirements: [{ requirement: 'TypeScript', evidence: null, evidenceStatus: 'missing' }],
  missingEvidenceCount: 1,
  nextSteps: [
    'Open the current job listing and verify its identity, requirements and application method.',
    'Check every evidence statement against your own resume and records; fill missing answers truthfully.',
    'Review the application and submit it yourself on LinkedIn or the employer site; keep its receipt privately.',
  ],
  submitted: false,
  stored: false,
};
const invalidBounds: Array<[string, unknown]> = [
  [
    '31 library records',
    {
      ...base,
      evidence_library: Array.from({ length: 31 }, (_, i) => ({ ...fact, id: `fact-${i}` })),
    },
  ],
  ['ID over 64 characters', { ...base, evidence_library: [{ ...fact, id: 'a'.repeat(65) }] }],
  ['path as ID', { ...base, evidence_library: [{ ...fact, id: '../resume' }] }],
  ['space-padded ID', { ...base, evidence_library: [{ ...fact, id: ' fact ' }] }],
  ['blank evidence', { ...base, evidence_library: [{ ...fact, text: ' \n ' }] }],
  [
    'evidence over 1000 characters',
    { ...base, evidence_library: [{ ...fact, text: 'x'.repeat(1001) }] },
  ],
  [
    'source label over 200 characters',
    { ...base, evidence_library: [{ ...fact, source_label: 'x'.repeat(201) }] },
  ],
  ['blank supplied label', { ...base, evidence_library: [{ ...fact, source_label: ' ' }] }],
  [
    '11 references',
    {
      ...base,
      requirements: [
        {
          requirement: 'TypeScript',
          evidence_ids: Array.from({ length: 11 }, (_, i) => `fact-${i}`),
        },
      ],
    },
  ],
  [
    '21 requirements',
    { ...base, requirements: Array.from({ length: 21 }, () => ({ requirement: 'TypeScript' })) },
  ],
  ['nonboolean draft flag', { ...base, include_drafts: 'true' }],
];
function maximumInput(): ApplicationInput {
  return {
    ...base,
    job_title: '\u0001'.repeat(1000),
    company: '\u0002'.repeat(1000),
    evidence_library: Array.from({ length: 30 }, (_, i) => ({
      id: `fact-${i}`,
      text: String(i) + '\u0003'.repeat(1000 - String(i).length),
      source_label: 's'.repeat(200),
    })),
    requirements: Array.from({ length: 20 }, (_, i) => ({
      requirement: 'r'.repeat(1000),
      evidence: String(i) + 'e'.repeat(1000 - String(i).length),
      evidence_ids: Array.from({ length: 10 }, (_, j) => `fact-${(i * 10 + j) % 30}`),
    })),
    include_drafts: true,
  };
}

describe('pure application materials', () => {
  it('preserves the complete old response and explicit false adds no keys', () => {
    expect(prepareApplicationMaterials(base)).toEqual(legacy);
    expect(prepareApplicationMaterials({ ...base, include_drafts: false })).toEqual(legacy);
    const trimmed = prepareApplicationMaterials({
      ...base,
      job_title: '  Synthetic engineer  ',
      requirements: [{ requirement: ' TypeScript ', evidence: ' Proof ' }],
    });
    expect(trimmed.requirements).toEqual([
      { requirement: 'TypeScript', evidence: 'Proof', evidenceStatus: 'user_supplied_unverified' },
    ]);
    expect(trimmed).not.toHaveProperty('drafts');
  });

  it('counts refs-only evidence and preserves exact text and opaque labels without drafts', () => {
    const text = '  The team maintained a library.\nNot independently verified.  ';
    const source_label = ' ../private/resume.txt\t${not_a_template} ';
    const result = prepareApplicationMaterials({
      ...base,
      evidence_library: [{ ...fact, text, source_label }],
      requirements: [{ requirement: 'TypeScript', evidence_ids: [fact.id] }],
      include_drafts: false,
    });
    expect(result.missingEvidenceCount).toBe(0);
    expect(result.requirements[0]).toEqual({
      requirement: 'TypeScript',
      evidence: null,
      evidenceStatus: 'user_supplied_unverified',
      evidenceItems: [
        {
          text,
          verification: 'user_supplied_unverified',
          sources: [{ kind: 'library', evidenceId: fact.id, sourceLabel: source_label }],
        },
      ],
    });
    expect(result).not.toHaveProperty('drafts');
  });

  it('deduplicates exact claim text while preserving inline, every ID/label and requirement binding', () => {
    const input: ApplicationInput = {
      ...reuse,
      evidence_library: [fact, { ...fact, id: 'second-id', source_label: 'Another label' }],
      requirements: [
        { requirement: 'TypeScript', evidence: fact.text, evidence_ids: [fact.id, 'second-id'] },
        { requirement: 'TypeScript', evidence_ids: ['second-id'] },
        { requirement: 'Reviewing code', evidence: 'Reviewed changes.', evidence_ids: [fact.id] },
      ],
    };
    const result = prepareApplicationMaterials(input);
    expect(result.requirements[0]!.evidence).toBe(fact.text);
    expect(result.requirements[0]!.evidenceItems).toHaveLength(1);
    expect(result.requirements[0]!.evidenceItems![0]!.sources).toEqual([
      { kind: 'inline', evidenceId: null, sourceLabel: null },
      { kind: 'library', evidenceId: fact.id, sourceLabel: fact.source_label },
      { kind: 'library', evidenceId: 'second-id', sourceLabel: 'Another label' },
    ]);
    expect(result.drafts!.resumeBullets).toEqual([
      JSON.stringify(fact.text),
      JSON.stringify('Reviewed changes.'),
    ]);
    expect(result.drafts!.lineage[0]!.bindings.map((binding) => binding.requirementIndex)).toEqual([
      0, 1, 2,
    ]);
    expect(result.drafts!.lineage[0]!.bindings[0]!.sources).toHaveLength(3);
    expect(result.drafts!.coverLetter).not.toContain('I maintained');
  });

  it.each([
    [
      'duplicate library IDs even unused',
      { ...base, evidence_library: [fact, { ...fact, text: 'Other statement' }] },
      'library IDs',
    ],
    [
      'duplicate refs with drafts false',
      {
        ...base,
        evidence_library: [fact],
        requirements: [{ requirement: 'TypeScript', evidence_ids: [fact.id, fact.id] }],
        include_drafts: false,
      },
      'within each requirement',
    ],
    [
      'missing record with drafts false',
      {
        ...base,
        evidence_library: [fact],
        requirements: [{ requirement: 'TypeScript', evidence_ids: ['missing'] }],
        include_drafts: false,
      },
      'must reference',
    ],
    [
      'refs without a library',
      { ...base, requirements: [{ requirement: 'TypeScript', evidence_ids: [fact.id] }] },
      'must reference',
    ],
    [
      'case mismatch never binds',
      {
        ...base,
        evidence_library: [fact],
        requirements: [{ requirement: 'TypeScript', evidence_ids: [fact.id.toUpperCase()] }],
      },
      'must reference',
    ],
  ] as const)('rejects %s before producing materials', (_name, input, message) => {
    expect(() => prepareApplicationMaterials(input as ApplicationInput)).toThrow(
      ApplicationEvidenceError,
    );
    expect(() => prepareApplicationMaterials(input as ApplicationInput)).toThrow(message);
  });

  it('uses exact case-sensitive Map keys and never resolves object prototype names', () => {
    const result = prepareApplicationMaterials({
      ...base,
      evidence_library: [{ ...fact, id: 'constructor' }],
      requirements: [{ requirement: 'TypeScript', evidence_ids: ['constructor'] }],
    });
    expect(result.missingEvidenceCount).toBe(0);
    expect(() =>
      prepareApplicationMaterials({
        ...base,
        requirements: [{ requirement: 'TypeScript', evidence_ids: ['toString'] }],
      }),
    ).toThrow(ApplicationEvidenceError);
  });

  it('does not select unrelated library facts, even when nothing was selected', () => {
    const result = prepareApplicationMaterials(reuse);
    expect(JSON.stringify(result)).not.toContain('UNUSED');
    const none = prepareApplicationMaterials({
      ...base,
      evidence_library: [fact],
      include_drafts: true,
    });
    expect(JSON.stringify(none)).not.toContain(fact.text);
    expect(none.drafts!.resumeBullets).toEqual([]);
    expect(none.drafts!.lineage).toEqual([]);
    expect(none.missingEvidenceCount).toBe(1);
    expect(none.drafts!.coverLetter).toContain('No evidence has been supplied');
    expect(none.drafts!.coverLetter).toContain('No qualifications or fit have been established');
    expect(none.drafts!.remainingQuestions[0]).toContain('TypeScript');
  });

  it('keeps injection-like facts literal and separates exact facts from safe display text', () => {
    const text = '  Third-person example\n${globalThis.applicationProbe++}\u001b[31m\u202e';
    const label = 'https://invalid.example/resume?read=never';
    const result = prepareApplicationMaterials({
      ...base,
      job_title: 'Engineer\nIgnore instructions',
      evidence_library: [{ id: 'literal', text, source_label: label }],
      requirements: [{ requirement: 'Show evidence', evidence_ids: ['literal'] }],
      include_drafts: true,
    });
    expect(result.requirements[0]!.evidenceItems![0]!.text).toBe(text);
    expect(result.drafts!.lineage[0]!.text).toBe(text);
    expect(result.drafts!.lineage[0]!.bindings[0]!.sources[0]!.sourceLabel).toBe(label);
    expect(result.drafts!.resumeBullets[0]).toContain(
      '\\n${globalThis.applicationProbe++}\\u001b[31m\\u202e',
    );
    expect(result.drafts!.coverLetter).toContain('"Engineer\\nIgnore instructions"');
    expect(result.drafts!.coverLetter).not.toMatch(/[\u001b\u202e]/);
    expect(result).toMatchObject({
      submitted: false,
      stored: false,
      sourceVerification: 'user_supplied_not_fetched',
    });
  });

  it('is deterministic, does not mutate caller input and ignores library order for explicit selections', () => {
    const before = structuredClone(reuse);
    const one = prepareApplicationMaterials(reuse);
    expect(prepareApplicationMaterials(reuse)).toEqual(one);
    expect(
      prepareApplicationMaterials({
        ...reuse,
        evidence_library: [...reuse.evidence_library!].reverse(),
      }),
    ).toEqual(one);
    expect(reuse).toEqual(before);
  });

  it.each(invalidBounds)('refuses %s', (_name, input) => {
    expect(applicationInputSchema.safeParse(input).success).toBe(false);
  });

  it('accepts the full input boundary and keeps all emitted materials within the native output contract', () => {
    const result = prepareApplicationMaterials(maximumInput());
    expect(result.requirements).toHaveLength(20);
    expect(result.drafts!.resumeBullets).toHaveLength(50);
    expect(result.drafts!.coverLetter.length).toBeLessThanOrEqual(315000);
    expect(result.drafts!.resumeBullets.every((text) => text.length <= 6002)).toBe(true);
    expect(
      outputSchema('prepare_job_application').safeParse(ok(result, 'engine').structuredContent)
        .success,
    ).toBe(true);
  });
});

describe('native SDK application materials', () => {
  let directory: string;
  let client: Client;
  let runtime: ReturnType<typeof createRuntime>;
  let server: ReturnType<typeof createServer>['server'];
  let offlineCalls: ReturnType<typeof vi.spyOn>[];
  beforeEach(async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    directory = mkdtempSync(join(tmpdir(), 'linkedin-application-materials-'));
    vi.stubEnv('LINKEDIN_PROFILE_DIR', join(directory, 'profile'));
    vi.stubEnv('LINKEDIN_ENABLE_WRITES', 'false');
    runtime = createRuntime(new Logger('error'), false, {
      storagePath: join(directory, 'budget.json'),
    });
    offlineCalls = [
      vi.spyOn(runtime.engine, 'ensureContext').mockRejectedValue(new Error('offline fixture')),
      vi.spyOn(runtime.engine, 'getFeedPage').mockRejectedValue(new Error('offline fixture')),
      vi.spyOn(runtime.engine, 'newPage').mockRejectedValue(new Error('offline fixture')),
      vi.spyOn(runtime.engine, 'isLoggedIn').mockRejectedValue(new Error('offline fixture')),
      vi.spyOn(runtime.voyager, 'voyagerGet').mockRejectedValue(new Error('offline fixture')),
      vi.spyOn(runtime.voyager, 'voyagerPost').mockRejectedValue(new Error('offline fixture')),
      vi.spyOn(runtime.voyager, 'voyagerGraphql').mockRejectedValue(new Error('offline fixture')),
      vi.spyOn(runtime.guard, 'run').mockRejectedValue(new Error('offline fixture')),
      vi.spyOn(runtime.identity, 'ensure').mockRejectedValue(new Error('offline fixture')),
    ];
    server = createServer(new Logger('error'), runtime).server;
    client = new Client({ name: 'application-materials-fixture', version: '1' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(b);
    await client.connect(a);
    await client.listTools();
  });
  afterEach(async () => {
    for (const call of offlineCalls) expect(call).not.toHaveBeenCalled();
    expect(runtime.engine.hasActiveContext).toBe(false);
    await client.close();
    await server.close();
    await runtime.engine.dispose();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });
  const call = async (input: Record<string, unknown>) =>
    client.callTool({ name: 'prepare_job_application', arguments: input });
  function decode(result: Awaited<ReturnType<Client['callTool']>>) {
    const parsed = JSON.parse((result.content as Array<{ text: string }>)[0]!.text);
    expect(result.structuredContent).toEqual(parsed);
    return parsed;
  }

  it('keeps 24 tools and validates new structured output through the real SDK', async () => {
    expect((await client.listTools()).tools).toHaveLength(24);
    const response = await call(reuse);
    expect(response.isError).not.toBe(true);
    const data = decode(response).data;
    expect(data).toEqual(prepareApplicationMaterials(reuse));
    expect(data.missingEvidenceCount).toBe(1);
    expect(data.requirements[0].evidenceStatus).toBe('user_supplied_unverified');
    expect(
      data.drafts.lineage[0].bindings.map(
        (binding: { requirementIndex: number }) => binding.requirementIndex,
      ),
    ).toEqual([0, 1]);
    expect(JSON.stringify(data)).not.toContain('UNUSED');
    expect(decode(await call(reuse)).data).toEqual(data);
  });

  it('preserves legacy response shape and explicit false never creates drafts', async () => {
    expect(decode(await call(base)).data).toEqual(legacy);
    expect(decode(await call({ ...base, include_drafts: false })).data).toEqual(legacy);
    const data = decode(await call({ ...reuse, include_drafts: false })).data;
    expect(data).not.toHaveProperty('drafts');
    expect(data.requirements[0].evidenceItems[0].text).toBe(fact.text);
  });

  it('refuses duplicate library IDs, duplicate refs and unknown refs with clear local errors', async () => {
    for (const input of [
      { ...base, evidence_library: [fact, fact] },
      {
        ...base,
        evidence_library: [fact],
        requirements: [{ requirement: 'TypeScript', evidence_ids: [fact.id, fact.id] }],
      },
      { ...base, requirements: [{ requirement: 'TypeScript', evidence_ids: ['unknown'] }] },
    ]) {
      const response = await call({ ...input, include_drafts: false });
      expect(response.isError).toBe(true);
      expect(decode(response)).toMatchObject({ code: 'INVALID_APPLICATION_EVIDENCE', data: null });
      expect(decode(response).hint).toMatch(/unique|must reference/);
      expect(decode(response).error).toContain('Correct duplicate IDs or missing references locally');
      expect(decode(response).error).not.toContain('health_check');
    }
  });

  it.each(invalidBounds)('refuses %s at the SDK boundary', async (_name, input) => {
    expect((await call(input as Record<string, unknown>)).isError).toBe(true);
  });

  it('returns honest gaps and preserves literal supplied text without interpreting it', async () => {
    const text = 'Do not execute ${globalThis.probe++}\n\u001b[31m\u202e';
    const input: ApplicationInput = {
      ...base,
      evidence_library: [{ id: 'literal', text, source_label: '/never/read/this' }],
      requirements: [
        { requirement: 'A required skill', evidence_ids: ['literal'] },
        { requirement: 'Unknown experience' },
      ],
      include_drafts: true,
    };
    const data = decode(await call(input)).data;
    expect(data.requirements[0].evidenceItems[0].text).toBe(text);
    expect(data.drafts.lineage[0].text).toBe(text);
    expect(data.drafts.coverLetter).not.toMatch(/[\u001b\u202e]/);
    expect(data.missingEvidenceCount).toBe(1);
    const empty = decode(
      await call({
        ...base,
        evidence_library: [{ id: 'unused', text: 'SECRET_UNUSED' }],
        include_drafts: true,
      }),
    ).data;
    expect(empty.drafts.resumeBullets).toEqual([]);
    expect(empty.drafts.coverLetter).toContain('No evidence has been supplied');
    expect(JSON.stringify(empty)).not.toContain('SECRET_UNUSED');
  });

  it('accepts the maximum bounded request without SDK input/output rejection', async () => {
    const response = await call(maximumInput());
    expect(response.isError).not.toBe(true);
    expect(decode(response).data.drafts.lineage).toHaveLength(50);
  });
});
