/** Validate source facts in memory; emit only fixed status, counts and field presence. */
import assert from 'node:assert/strict';
import { outputSchema } from '../src/tools/contracts.js';
import { briefSchema } from '../src/tools/research-contract.js';
import { briefObservation } from './job-brief-observation.js';

export function searchOnlyObservation(incoming: unknown, start: number, end: number) {
  const observed = briefObservation(incoming, start, end);
  const result = incoming as { structuredContent: unknown };
  const envelope = outputSchema('research_jobs').parse(result.structuredContent);
  assert.equal(envelope.meta.source, 'engine');
  assert.ok(
    Date.parse(envelope.meta.fetchedAt) >= start && Date.parse(envelope.meta.fetchedAt) <= end,
  );
  const fieldPresence = { title: 0, location: 0, listedAt: 0 };
  if (envelope.data === null)
    return {
      dataStatus: 'error' as const,
      metaStatus: envelope.meta.status,
      partial: envelope.meta.partial,
      contractChecked: true,
      entities: 0,
      usefulEntities: 0,
      facts: 0,
      factChecks: 0,
      fieldPresence,
      readFailed: true,
      toolCalls: 0,
      readAttempts: 0,
    };
  const brief = briefSchema.parse(envelope.data);
  assert.equal(brief.query.enrichFirst, false);
  assert.ok(brief.entities.length <= brief.query.count);
  assert.equal(brief.bounds.maxReadAttempts, 2);
  assert.equal(brief.bounds.maxToolCalls, 1);
  assert.equal(brief.bounds.toolCalls, 1);
  assert.equal(brief.reads.length, 1);
  assert.equal(brief.reads[0]!.tool, 'search_jobs');
  assert.equal(envelope.meta.partial, brief.status === 'partial');
  assert.ok(Date.parse(brief.generatedAt) >= start && Date.parse(brief.generatedAt) <= end);
  for (const entity of brief.entities)
    for (const fact of entity.facts) {
      assert.equal(fact.sourceTool, 'search_jobs');
      assert.ok(fact.value.trim());
      assert.ok(['title', 'location', 'listedAt'].includes(fact.field));
      if (fact.field === 'listedAt') {
        assert.ok(Number.isFinite(Date.parse(fact.value)) && Date.parse(fact.value) <= end);
      }
      fieldPresence[fact.field as keyof typeof fieldPresence]++;
    }
  return {
    dataStatus: brief.status,
    metaStatus: envelope.meta.status,
    partial: envelope.meta.partial,
    contractChecked: true,
    entities: brief.entities.length,
    usefulEntities: observed.usefulEntities,
    facts: observed.facts!,
    factChecks: observed.factChecks!,
    fieldPresence,
    readFailed: brief.reads.some((read) => read.status === 'error'),
    toolCalls: brief.bounds.toolCalls,
    readAttempts: brief.bounds.readAttempts,
  };
}
