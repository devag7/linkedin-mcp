import { z } from 'zod';
/** Minimum observed comparison evidence; does not establish fit or availability. */
export function hasComparisonEvidence(facts: readonly { field: string }[]): boolean {
  return (
    facts.some((fact) => fact.field === 'title') &&
    facts.some((fact) => ['location', 'company', 'description', 'listedAt'].includes(fact.field))
  );
}
export const briefFactSchema = z.object({
  field: z.enum(['title', 'location', 'listedAt', 'company', 'workplaceType', 'description']),
  value: z.string().min(1).max(4000),
  sourceUrl: z.string().regex(/^https:\/\/www\.linkedin\.com\/jobs\/view\/[0-9]{1,20}\/$/),
  fetchedAt: z.string().datetime(),
  sourceTool: z.enum(['search_jobs', 'get_job_details']),
  truncated: z.boolean(),
});
export const briefSchema = z.object({
  topic: z.string().max(200),
  query: z.object({
    keywords: z.string().max(200),
    locationGeoId: z.string().optional(),
    count: z.number().int().min(1).max(10),
    enrichFirst: z.boolean(),
  }),
  generatedAt: z.string().datetime(),
  status: z.enum(['ok', 'empty', 'partial']),
  comparisonEvidence: z.object({
    sufficientEntities: z.number().int().min(0).max(10),
    insufficientEntities: z.number().int().min(0).max(10),
  }),
  scope: z.literal(
    'One first-page job search and at most one job-detail read. Source observations, not recommendations.',
  ),
  bounds: z.object({
    maxReadAttempts: z.literal(3),
    readAttempts: z.number().int().min(0).max(3),
    maxEntities: z.literal(10),
    maxToolCalls: z.literal(2),
    toolCalls: z.number().int().min(0).max(2),
  }),
  entities: z
    .array(
      z.object({
        sourceUrl: z.string().url(),
        facts: z.array(briefFactSchema).max(10),
        unknownFields: z.array(z.string()).max(6),
      }),
    )
    .max(10),
  reads: z
    .array(
      z.object({
        tool: z.enum(['search_jobs', 'get_job_details']),
        status: z.enum(['ok', 'empty', 'partial', 'error']),
        fetchedAt: z.string().datetime(),
        code: z.string().optional(),
        guidance: z.string().max(1000).optional(),
      }),
    )
    .max(2),
  gaps: z.array(z.string()).max(20),
  nextSteps: z.array(z.string()).max(5),
  markdown: z.string().max(50000),
});
