/** Validate a live/synthetic result in memory; return counts/codes only. */
import assert from 'node:assert/strict';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { outputSchema } from '../src/tools/contracts.js';
import { briefSchema, hasComparisonEvidence } from '../src/tools/research-contract.js';
export function briefObservation(incoming: unknown, start: number, end: number) {
  const result = CallToolResultSchema.parse(incoming);
  const envelope = outputSchema('research_jobs').parse(result.structuredContent);
  assert.ok(Array.isArray(result.content), 'TEXT_CONTENT_REQUIRED');
  const text = (result.content as { type: string; text: string }[])[0];
  assert.equal(text?.type, 'text');
  // JSON omits undefined object members. Compare their actual JSON representation,
  // separately from schema validation, rather than the parser's in-memory object.
  assert.deepEqual(JSON.parse(text!.text), JSON.parse(JSON.stringify(result.structuredContent)));
  if (envelope.data === null)
    return {
      metaStatus: envelope.meta.status,
      code: envelope.code,
      contractChecked: true,
      usefulEntities: 0,
    };
  const brief = briefSchema.parse(envelope.data);
  assert.equal(brief.status, envelope.meta.status);
  const usefulEntities = brief.entities.filter((entity) =>
    hasComparisonEvidence(entity.facts),
  ).length;
  assert.equal(brief.comparisonEvidence.sufficientEntities, usefulEntities);
  assert.equal(
    brief.comparisonEvidence.insufficientEntities,
    brief.entities.length - usefulEntities,
  );
  if (brief.comparisonEvidence.insufficientEntities) {
    assert.equal(brief.status, 'partial');
    assert.equal(envelope.meta.partial, true);
  }
  assert.ok(
    brief.entities.length <= 3 && brief.bounds.readAttempts <= 3 && brief.bounds.toolCalls <= 2,
  );
  let factChecks = 0;
  for (const entity of brief.entities) {
    assert.match(entity.sourceUrl, /^https:\/\/www\.linkedin\.com\/jobs\/view\/[0-9]{1,20}\/$/);
    for (const fact of entity.facts) {
      assert.equal(fact.sourceUrl, entity.sourceUrl);
      assert.ok(
        brief.reads.some(
          (read) =>
            read.tool === fact.sourceTool &&
            read.fetchedAt === fact.fetchedAt &&
            read.status !== 'error',
        ),
      );
      assert.ok(Date.parse(fact.fetchedAt) >= start && Date.parse(fact.fetchedAt) <= end);
      assert.ok(brief.markdown.includes(`[source](${fact.sourceUrl})`));
      factChecks++;
    }
  }
  return {
    dataStatus: brief.status,
    metaStatus: envelope.meta.status,
    contractChecked: true,
    factChecks,
    entities: brief.entities.length,
    facts: brief.entities.reduce((n, entity) => n + entity.facts.length, 0),
    usefulEntities,
    reads: brief.reads.map((read) => ({ tool: read.tool, status: read.status, code: read.code })),
    bounds: brief.bounds,
  };
}
