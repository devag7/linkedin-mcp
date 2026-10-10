import { z } from 'zod';
/** Minimum observed comparison evidence; does not establish fit or availability. */
export function hasComparisonEvidence(facts: readonly { field: string }[]): boolean {
  return (
    facts.some((fact) => fact.field === 'title') &&
    facts.some((fact) => ['location', 'listedAt'].includes(fact.field))
  );
}
export const briefFactSchema = z.object({
  field: z.enum(['title', 'location', 'listedAt']),
  value: z.string().min(1).max(300),
  sourceUrl: z.string().regex(/^https:\/\/www\.linkedin\.com\/jobs\/view\/[0-9]{1,20}\/$/),
  fetchedAt: z.string().datetime(),
  sourceTool: z.literal('search_jobs'),
  truncated: z.boolean(),
});
export const briefSchema = z.object({
  topic: z.string().max(200),
  query: z.object({
    keywords: z.string().max(200),
    locationGeoId: z.string().optional(),
    count: z.number().int().min(1).max(10),
    enrichFirst: z.literal(false),
  }),
  generatedAt: z.string().datetime(),
  status: z.enum(['ok', 'empty', 'partial']),
  comparisonEvidence: z.object({
    sufficientEntities: z.number().int().min(0).max(10),
    insufficientEntities: z.number().int().min(0).max(10),
  }),
  scope: z.literal('One first-page job search only. Source observations, not recommendations.'),
  bounds: z.object({
    maxReadAttempts: z.literal(2),
    readAttempts: z.number().int().min(0).max(2),
    maxEntities: z.literal(10),
    maxToolCalls: z.literal(1),
    toolCalls: z.number().int().min(0).max(1),
  }),
  entities: z
    .array(
      z.object({
        sourceUrl: z.string().url(),
        facts: z.array(briefFactSchema).max(3),
        unknownFields: z.array(z.enum(['title', 'location', 'listedAt'])).max(3),
      }),
    )
    .max(10),
  reads: z
    .array(
      z.object({
        tool: z.literal('search_jobs'),
        status: z.enum(['ok', 'empty', 'partial', 'error']),
        fetchedAt: z.string().datetime(),
        code: z.string().optional(),
        guidance: z.string().max(1000).optional(),
      }),
    )
    .max(1),
  gaps: z.array(z.string()).max(20),
  nextSteps: z.array(z.string()).max(5),
  markdown: z.string().max(50000),
});
