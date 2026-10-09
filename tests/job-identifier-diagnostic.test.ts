/** Disposable synthetic identifiers only; no provider, profile or retained payload. */
import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  summarizeJobIdentifierStructure,
  IDENTIFIER_DIAGNOSTIC_LIMITS,
  JOB_IDENTIFIER_NAMESPACES,
} from '../src/browser/job-identifier-diagnostic.js';
import { selectJobDetailNode } from '../src/browser/job-detail-selection.js';
import { encodeDiagnosticReceipt } from '../scripts/job-brief-observation.js';

const requested = '8765432109';
const candidate = (entityUrn: unknown, reference?: unknown) => ({
  title: 'PRIVATE_TITLE_DO_NOT_RETAIN',
  description: { text: 'PRIVATE_DESCRIPTION_DO_NOT_RETAIN' },
  entityUrn,
  '*jobPosting': reference,
  jobId: requested,
  sourceUrl: `https://www.linkedin.com/jobs/view/${requested}/`,
  arbitraryPrivateKey: 'PRIVATE_EXTRA_DO_NOT_RETAIN',
});
const observe = (entity: unknown, reference?: unknown) =>
  summarizeJobIdentifierStructure({ data: candidate(entity, reference) }, requested);

describe('identifier disclosure policy', () => {
  it.each(['8765432109\n', '8765432109\r', '8765432109\u2028', '8765432109\u2029', '8765432109 '])(
    'requires the complete requested numeric ID: %j',
    (requestedId) => {
      expect(() => summarizeJobIdentifierStructure({ data: {} }, requestedId)).toThrow(
        'INVALID_REQUESTED_ID',
      );
    },
  );
  it('retains only code-owned labels, tuple shape and exact comparisons', () => {
    const report = observe(
      `urn:li:fsd_jobPostingCard:(${requested},PRIVATE_TRACKING_TOKEN)`,
      `urn:li:fsd_jobPosting:${requested}`,
    );
    expect(report).toEqual({
      schema: 'job-identifier-structure/v1',
      diagnosticComplete: true,
      supportedEntityBinding: 'none',
      candidates: [
        {
          origin: 'data',
          entityUrn: {
            kind: 'urn',
            namespace: 'fsd_jobPostingCard',
            payload: {
              kind: 'tuple',
              items: [{ kind: 'number', comparison: 'requested_id_equal' }, { kind: 'opaque' }],
            },
          },
          jobPostingReference: {
            kind: 'urn',
            namespace: 'fsd_jobPosting',
            payload: { kind: 'number', comparison: 'requested_id_equal' },
          },
          relationship: 'different',
        },
      ],
    });
    expect(JSON.stringify(report)).not.toMatch(
      /8765432109|PRIVATE_|https:|sourceUrl|jobId|arbitraryPrivateKey/,
    );
    // Observing a matching tuple atom/reference never permits production selection.
    expect(() =>
      selectJobDetailNode(
        {
          data: candidate(
            `urn:li:fsd_jobPostingCard:(${requested},PRIVATE_TRACKING_TOKEN)`,
            `urn:li:fsd_jobPosting:${requested}`,
          ),
        },
        requested,
      ),
    ).toThrow('JOB_DETAIL_SELECTION_REJECTED');
  });
  it.each([
    'PRIVATE_NAMESPACE',
    'fsd_jobPostingCardPRIVATE',
    'Fsd_jobPostingCard',
    'fsd_jobpostingcard',
    'fsd_jobPostingCard_8765432109',
    'person@example.com',
  ])('never discloses an unreviewed namespace: %s', (namespace) => {
    const report = observe(`urn:li:${namespace}:${requested}`);
    expect(report.diagnosticComplete).toBe(false);
    expect(report.supportedEntityBinding).toBe('incomplete');
    expect(report.candidates[0]!.entityUrn).toMatchObject({
      kind: 'urn',
      namespace: 'unrecognized',
    });
    expect(JSON.stringify(report)).not.toContain(namespace);
    expect(JSON.stringify(report)).not.toContain(requested);
  });
  it.each([undefined, null, '', 123, {}, ['PRIVATE_ARRAY']])(
    'redacts missing/non-string identifiers: %j',
    (value) => {
      const report = observe(value);
      expect(report.candidates[0]!.entityUrn.kind).toBe(
        value == null || value === '' ? 'missing' : 'non_string',
      );
      expect(JSON.stringify(report)).not.toMatch(/123|PRIVATE_ARRAY/);
    },
  );

  it.each([undefined, 'old-reference-counts'])(
    'rejects the superseded runner scope before profile setup: %s',
    (scope) => {
      const dir = realpathSync(mkdtempSync(join(tmpdir(), 'identifier-consent-')));
      try {
        const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
        const env: NodeJS.ProcessEnv = {
          ...Object.fromEntries(
            ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec', 'COMSPEC', 'TMP', 'TEMP', 'TMPDIR']
              .filter((key) => process.env[key])
              .map((key) => [key, process.env[key]]),
          ),
          PATH: process.env.PATH,
          HOME: dir,
          LINKEDIN_PROFILE_DIR: join(dir, 'disposable-profile'),
          LINKEDIN_JOB_SHAPE_CONSENT_SHA: head,
          LINKEDIN_JOB_SHAPE_OUTPUT: join(dir, 'receipt.json'),
        };
        if (scope) env.LINKEDIN_JOB_IDENTIFIER_SCOPE = scope;
        const result = spawnSync(
          process.execPath,
          ['node_modules/tsx/dist/cli.mjs', 'scripts/diagnose-job-brief.ts'],
          { env, encoding: 'utf8', timeout: 10000, stdio: 'pipe' },
        );
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain('CHANGED_RETENTION_CONSENT_REQUIRED');
        expect(existsSync(join(dir, 'disposable-profile'))).toBe(false);
        expect(existsSync(join(dir, 'receipt.json.started'))).toBe(false);
        expect(existsSync(join(dir, 'receipt.json'))).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    15000,
  );
  it.each([
    { value: requested, equal: true },
    { value: '0' + requested, equal: false },
    { value: requested + '0', equal: false },
    { value: '0000000000', equal: false },
    { value: `%38${requested.slice(1)}`, equal: false },
    { value: 'prefix' + requested, equal: false },
    { value: requested + 'suffix', equal: false },
  ])('compares whole decimal atoms without coercion or decoding: $value', ({ value, equal }) => {
    const report = observe('urn:li:fsd_jobPostingCard:(' + value + ',PRIVATE_OPAQUE)');
    const text = JSON.stringify(report);
    expect(text.includes('requested_id_equal')).toBe(equal);
    expect(text).not.toContain(requested);
    expect(report.supportedEntityBinding).toBe('none');
  });
  it.each([
    ' ' + requested,
    requested + ' ',
    requested + '\n',
    '(' + requested + ',)',
    '(' + requested,
    requested + ')',
    '(' + requested + ',PRIVATE_OPAQUE))',
  ])('rejects unsupported grammar without salvaging a match: %j', (value) => {
    const report = observe('urn:li:fsd_jobPostingCard:' + value);
    expect(report.diagnosticComplete).toBe(false);
    expect(report.candidates[0]!.entityUrn.kind).toBe('invalid');
    expect(JSON.stringify(report)).not.toContain('requested_id_equal');
  });
  it('shows nested structure while redacting all nested values', () => {
    const report = observe(
      `urn:li:fsd_jobPostingCard:(urn:li:fsd_jobPosting:${requested},PRIVATE_OPAQUE)`,
    );
    expect(report.diagnosticComplete).toBe(true);
    expect(JSON.stringify(report)).toContain('requested_id_equal');
    expect(JSON.stringify(report)).not.toMatch(/8765432109|PRIVATE_OPAQUE/);
    expect(report.supportedEntityBinding).toBe('none');
  });
  it.each([
    'x'.repeat(2049),
    '('.repeat(6) + requested + ')'.repeat(6),
    '(' + Array(5).fill(requested).join(',') + ')',
    '9'.repeat(21),
  ])('bounds oversized/deep/overlong input', (value) => {
    const report = observe('urn:li:fsd_jobPostingCard:' + value);
    expect(report.diagnosticComplete).toBe(false);
    expect(report.supportedEntityBinding).toBe('incomplete');
    expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(
      IDENTIFIER_DIAGNOSTIC_LIMITS.reportBytes,
    );
  });
  it('does not expose other URN families, encoded private namespaces or opaque payloads', () => {
    const report = observe(
      'urn:PRIVATE_FAMILY:PRIVATE_NAMESPACE:PRIVATE_ID',
      'urn:li:%50RIVATE_NAMESPACE:PRIVATE_VALUE',
    );
    expect(report.diagnosticComplete).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE_|%50/);
  });
  it('keeps the disclosure vocabulary immutable and separate from accepted identities', () => {
    expect(Object.isFrozen(JOB_IDENTIFIER_NAMESPACES)).toBe(true);
    expect(() =>
      selectJobDetailNode({ data: candidate('urn:li:fsd_jobPostingCard:' + requested) }, requested),
    ).toThrow();
  });
});

describe('candidate relationships and ambiguity', () => {
  it('persists a worst-case bounded graph within the consented compact 8 KiB report cap', () => {
    const urn = `urn:li:fsd_jobPostingCard:((${requested},9,${requested},9),(${requested},9,${requested},9),urn:li:fsd_jobPosting:${requested},urn:li:fsd_jobPosting:9)`;
    const report = summarizeJobIdentifierStructure(
      { included: Array.from({ length: 4 }, () => candidate(urn, urn)) },
      requested,
    );
    expect(report.diagnosticComplete).toBe(true);
    expect(report.candidates).toHaveLength(4);
    expect(Buffer.byteLength(JSON.stringify(report, null, 2))).toBeGreaterThan(8192);
    expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(8192);
    const dir = mkdtempSync(join(tmpdir(), 'compact-diagnostic-'));
    try {
      const file = join(dir, 'receipt.json');
      writeFileSync(file, encodeDiagnosticReceipt({ identifierObservations: [report] }), {
        mode: 0o600,
        flag: 'wx',
      });
      const text = readFileSync(file, 'utf8');
      expect(text.split('\n')).toHaveLength(2);
      const stored = JSON.parse(text).identifierObservations[0];
      expect(stored).toEqual(report);
      expect(Buffer.byteLength(JSON.stringify(stored))).toBeLessThanOrEqual(8192);
      expect(text).not.toMatch(/8765432109|PRIVATE_/);
      expect(() =>
        encodeDiagnosticReceipt({ identifierObservations: [{ unexpected: 'x'.repeat(8193) }] }),
      ).toThrow('DIAGNOSTIC_REPORT_TOO_LARGE');
      expect(() => encodeDiagnosticReceipt({ identifierObservations: [report, report] })).toThrow(
        'INVALID_DIAGNOSTIC_REPORT_COUNT',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('bounds branching identifier nodes as well as tuple arity and depth', () => {
    const report = observe('urn:li:fsd_jobPostingCard:((1,2,3,4),(1,2,3,4),(1,2,3,4),(1,2,3,4))');
    expect(report.diagnosticComplete).toBe(false);
    expect(report.candidates[0]!.entityUrn.kind).toBe('limited');
  });
  it('uses a finite output string vocabulary for adversarial synthetic input', () => {
    const allowed = new Set([
      'job-identifier-structure/v1',
      'data',
      'included',
      'none',
      'unique',
      'ambiguous',
      'incomplete',
      'equal',
      'different',
      'not_comparable',
      'missing',
      'non_string',
      'opaque',
      'invalid',
      'limited',
      'number_over_limit',
      'number',
      'tuple',
      'urn',
      'unrecognized',
      'requested_id_equal',
      'requested_id_different',
      ...JOB_IDENTIFIER_NAMESPACES,
    ]);
    const inspect = (value: unknown) => {
      if (typeof value === 'string') expect(allowed.has(value)).toBe(true);
      else if (value && typeof value === 'object')
        for (const child of Object.values(value)) inspect(child);
    };
    for (let i = 0; i < 100; i++) {
      const report = observe(
        `urn:li:PRIVATE_NAMESPACE_${i}:(8765432109,PRIVATE_SECRET_${i})`,
        `urn:li:fsd_jobPosting:${i}`,
      );
      inspect(report);
      expect(JSON.stringify(report)).not.toMatch(/PRIVATE_|8765432109/);
    }
  });
  it.each(['jobPosting', 'fsd_jobPosting'])(
    'identifies one existing supported match without retaining its ID: %s',
    (namespace) => {
      const urn = 'urn:li:' + namespace + ':' + requested;
      const report = observe(urn, urn);
      expect(report.supportedEntityBinding).toBe('unique');
      expect(report.candidates[0]!.relationship).toBe('equal');
      expect(JSON.stringify(report)).not.toContain(requested);
    },
  );
  it('rejects two distinct matching candidates even when their identifiers/objects look identical', () => {
    const one = candidate('urn:li:fsd_jobPosting:' + requested);
    const response = { data: one, included: [{ ...one }] };
    const report = summarizeJobIdentifierStructure(response, requested);
    expect(report.supportedEntityBinding).toBe('ambiguous');
    expect(report.candidates.map((c) => c.origin)).toEqual(['data', 'included']);
    expect(() => selectJobDetailNode(response, requested)).toThrow();
  });
  it('counts aliases once and never borrows a different candidate reference', () => {
    const one = candidate('urn:li:fsd_jobPosting:' + requested);
    const response = {
      data: { first: one },
      included: [
        one,
        candidate('urn:li:fsd_jobPostingCard:999', 'urn:li:fsd_jobPosting:' + requested),
      ],
    };
    const report = summarizeJobIdentifierStructure(response, requested);
    expect(report.candidates).toHaveLength(2);
    expect(report.supportedEntityBinding).toBe('unique');
    expect(report.candidates[0]!.jobPostingReference.kind).toBe('missing');
    expect(report.candidates[1]!.jobPostingReference).toMatchObject({
      payload: { comparison: 'requested_id_equal' },
    });
    expect(selectJobDetailNode(response, requested)).toBe(one);
  });
  it('cannot establish absence or uniqueness from a truncated candidate list', () => {
    const report = summarizeJobIdentifierStructure(
      {
        included: Array.from({ length: 5 }, () => candidate('urn:li:fsd_jobPosting:' + requested)),
      },
      requested,
    );
    expect(report.candidates).toHaveLength(4);
    expect(report.diagnosticComplete).toBe(false);
    expect(report.supportedEntityBinding).toBe('incomplete');
  });
  it('bounds traversal and cycles without exposing arbitrary keys', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(summarizeJobIdentifierStructure({ data: cycle }, requested).candidates).toEqual([]);
    const report = summarizeJobIdentifierStructure(
      { data: { PRIVATE_DYNAMIC_KEY: Array.from({ length: 10001 }, () => ({})) } },
      requested,
    );
    expect(report.diagnosticComplete).toBe(false);
    expect(JSON.stringify(report)).not.toContain('PRIVATE_DYNAMIC_KEY');
  });
});
