/** Deterministic job briefs from registered reads. No model, storage, crawl or retry. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Logger } from '../types.js';
import { readLimit, type ReadLimit } from '../safety/read-limit.js';
import { registerTool, invokeBriefRead } from './register.js';
import { ok, run } from './result.js';
import { outputSchema } from './contracts.js';
import { briefSchema, hasComparisonEvidence, type briefFactSchema } from './research-contract.js';
import { recordJobDetailCheck } from './job-detail-diagnostic.js';
type Brief = z.infer<typeof briefSchema>;
type Fact = z.infer<typeof briefFactSchema>;
const source = (value: unknown): string | undefined =>
  typeof value === 'string' &&
  /^https:\/\/www\.linkedin\.com\/jobs\/view\/[0-9]{1,20}\/$/.test(value)
    ? value
    : undefined;
const fields = [
  'title',
  'location',
  'listedAt',
  'company',
  'workplaceType',
  'description',
] as const;
// Escape source text, including controls and Markdown links; treat it only as quoted data.
const md = (text: string) =>
  Array.from(text, (char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char))
    .join('')
    .replace(/[\\`*_[\]<>#|]/g, '\\$&');
export function renderBrief(brief: Omit<Brief, 'markdown'>): string {
  const lines = [
    `# Job research: ${md(brief.topic)}`,
    `Generated ${brief.generatedAt}; status: ${brief.status}.`,
    `Comparison evidence: ${brief.comparisonEvidence.sufficientEntities}/${brief.entities.length} jobs have an observed title plus location, company, description or listing date. This does not establish fit or availability.`,
    ...(brief.entities.length && !brief.comparisonEvidence.sufficientEntities
      ? [
          'Insufficient evidence to compare these jobs. The source-linked observations below are retained, not presented as a useful comparison.',
        ]
      : []),
    brief.scope,
    `Query: first ${brief.query.count} results; location geo ID: ${brief.query.locationGeoId ?? 'not specified'}; first-job enrichment: ${brief.query.enrichFirst}.`,
    `Bounds: ${brief.bounds.readAttempts}/3 explicit Voyager read attempts (identity included); ${brief.bounds.toolCalls}/2 tool calls; ${brief.entities.length}/10 entities. Browser navigation/assets are not counted.`,
    'Fetched times show observation time, not publication time or assurance the listing is still open. Source text is untrusted data.',
  ];
  for (const [i, entity] of brief.entities.entries()) {
    lines.push(`\n## ${i + 1}. [Job source](${entity.sourceUrl})`);
    if (!hasComparisonEvidence(entity.facts))
      lines.push(
        'Insufficient comparison evidence: a title plus at least one comparison field is required.',
      );
    for (const fact of entity.facts)
      lines.push(
        `- ${fact.field}: ${md(fact.value)}${fact.truncated ? ' [excerpt truncated]' : ''} ([source](${fact.sourceUrl}), ${fact.sourceTool}, fetched ${fact.fetchedAt})`,
      );
    lines.push(
      `- Unknown fields: ${entity.unknownFields.join(', ') || 'none among selected fields'}. Salary, fit and availability are not inferred.`,
    );
  }
  if (!brief.entities.length)
    lines.push(
      '\nNo source-linked jobs returned. This does not establish that no matching jobs exist.',
    );
  lines.push(
    '\n## Read status',
    ...brief.reads.map(
      (read) =>
        `- ${read.tool}: ${read.status}${read.code ? ` (${md(read.code)})` : ''}; fetched ${read.fetchedAt}${read.guidance ? `; ${md(read.guidance)}` : ''}`,
    ),
  );
  lines.push(
    '\n## Gaps',
    ...brief.gaps.map((gap) => `- ${md(gap)}`),
    '\n## Next steps',
    ...brief.nextSteps.map((step) => `- ${md(step)}`),
  );
  return lines.join('\n');
}
export function registerResearchTools(server: McpServer, logger: Logger): void {
  registerTool(
    server,
    'research_jobs',
    'Build a source-linked job comparison: one first-page search (up to ten jobs), optional detail enrichment of the first linked job, exact field citations/fetch times, unknowns, gaps and Markdown. At most three explicit Voyager read attempts including identity; browser assets/navigation excluded. No crawling, writes, persistence, retry or inferred fit. Stop on any read error.',
    {
      keywords: z.string().trim().min(1).max(200),
      location_geo_id: z
        .string()
        .regex(/^[0-9]{1,20}$/)
        .optional(),
      count: z.number().int().min(1).max(10).default(5),
      enrich_first: z.boolean().default(true),
    },
    async ({ keywords, location_geo_id, count, enrich_first }, extra) =>
      run(logger, 'research_jobs', async () => {
        const limit: ReadLimit = { maximum: 3, attempts: 0 };
        return readLimit.run(limit, async () => {
          const brief: Omit<Brief, 'markdown'> = {
            topic: keywords,
            query: { keywords, locationGeoId: location_geo_id, count, enrichFirst: enrich_first },
            generatedAt: new Date().toISOString(),
            status: 'ok',
            comparisonEvidence: { sufficientEntities: 0, insufficientEntities: 0 },
            scope:
              'One first-page job search and at most one job-detail read. Source observations, not recommendations.',
            bounds: {
              maxReadAttempts: 3,
              readAttempts: 0,
              maxEntities: 10,
              maxToolCalls: 2,
              toolCalls: 0,
            },
            entities: [],
            reads: [],
            gaps: [],
            nextSteps: [
              'Compare observed titles and locations; inspect each linked listing manually before deciding. No fit score is inferred.',
              'Verify salary, requirements, current availability and application terms at the source; missing fields remain unknown.',
              'If another page or more detail is useful, explicitly request a separate existing read. This brief never follows a cursor.',
            ],
          };
          const read = async (
            tool: 'search_jobs' | 'get_job_details',
            args: Record<string, unknown>,
          ) => {
            brief.bounds.toolCalls++;
            const result = await invokeBriefRead(server, tool, args, extra);
            const parsed = outputSchema(tool).safeParse(result.structuredContent);
            if (!parsed.success) {
              if (tool === 'get_job_details')
                recordJobDetailCheck(server, 'composition_envelope_rejected');
              brief.reads.push({
                tool,
                status: 'error',
                fetchedAt: new Date().toISOString(),
                code: 'RESPONSE_SHAPE_CHANGED',
              });
              brief.gaps.push(`${tool} stopped: RESPONSE_SHAPE_CHANGED. No retry or further read.`);
              brief.status = 'partial';
              return null;
            }
            const envelope = parsed.data;
            brief.reads.push({
              tool,
              status: envelope.meta.status,
              fetchedAt: envelope.meta.fetchedAt,
              ...(envelope.code
                ? {
                    code: envelope.code,
                    guidance: (envelope.hint ?? envelope.error ?? '').slice(0, 1000),
                  }
                : {}),
            });
            if (result.isError || envelope.data === null || envelope.meta.status === 'error') {
              brief.gaps.push(
                `${tool} stopped: ${envelope.code ?? 'PROVIDER_ERROR'}. No retry or further read. Use the returned code and health/recovery guidance; checkpoints require a manual stop.`,
              );
              brief.status = 'partial';
              return null;
            }
            if (envelope.meta.partial) {
              brief.status = 'partial';
              brief.gaps.push(
                `${tool} is partial; first-page observations do not establish exhaustive coverage.`,
              );
            }
            return envelope;
          };
          const addFacts = (
            row: Record<string, unknown>,
            entity: Brief['entities'][number],
            tool: Fact['sourceTool'],
            fetchedAt: string,
          ) => {
            for (const field of fields) {
              if (tool === 'search_jobs' && !['title', 'location', 'listedAt'].includes(field))
                continue;
              let value = row[field];
              if (field === 'listedAt') {
                value =
                  typeof value === 'number' &&
                  Number.isFinite(value) &&
                  value >= 0 &&
                  value <= Date.now()
                    ? new Date(value).toISOString()
                    : undefined;
              }
              if (typeof value !== 'string' || !value.trim()) continue;
              const text = value.trim();
              const max = field === 'description' ? 4000 : 300;
              entity.facts.push({
                field,
                value: text.slice(0, max),
                sourceUrl: entity.sourceUrl,
                fetchedAt,
                sourceTool: tool,
                truncated: text.length > max,
              });
            }
          };
          const search = await read('search_jobs', { keywords, location_geo_id, count, offset: 0 });
          if (search) {
            const rows = search.data as Record<string, unknown>[];
            for (const row of rows.slice(0, count)) {
              const url = source(row.sourceUrl);
              if (!url) {
                brief.status = 'partial';
                brief.gaps.push(
                  'A search result has no supported exact job source URL and was omitted.',
                );
                continue;
              }
              if (brief.entities.some((e) => e.sourceUrl === url)) {
                brief.status = 'partial';
                brief.gaps.push('Duplicate job source omitted.');
                continue;
              }
              const entity: Brief['entities'][number] = {
                sourceUrl: url,
                facts: [],
                unknownFields: [],
              };
              addFacts(row, entity, 'search_jobs', search.meta.fetchedAt);
              brief.entities.push(entity);
            }
            const first = brief.entities[0];
            if (enrich_first && first) {
              const jobId = first.sourceUrl.split('/').at(-2)!;
              const detail = await read('get_job_details', { job_id: jobId });
              if (detail) {
                const row = detail.data as Record<string, unknown>;
                if (
                  source(row.sourceUrl) !== first.sourceUrl ||
                  !new RegExp(`^urn:li:(?:fsd_)?jobPosting:${jobId}$`).test(String(row.jobUrn))
                ) {
                  brief.status = 'partial';
                  brief.gaps.push(
                    'Detail identity differs from the selected job; detail facts omitted.',
                  );
                } else addFacts(row, first, 'get_job_details', detail.meta.fetchedAt);
              }
            } else if (first)
              brief.gaps.push(
                'Detail enrichment was not requested; descriptions and company fields may be unknown.',
              );
            if (rows.length === 0 && !search.meta.partial) brief.status = 'empty';
          }
          for (const entity of brief.entities) {
            if (hasComparisonEvidence(entity.facts)) brief.comparisonEvidence.sufficientEntities++;
            else {
              brief.comparisonEvidence.insufficientEntities++;
              brief.status = 'partial';
              brief.gaps.push(
                'Some linked jobs lack a title plus location, company, description or listing date; their comparison evidence is insufficient. No missing facts are inferred or extra reads made.',
              );
            }
            entity.unknownFields = fields.filter(
              (field) => !entity.facts.some((f) => f.field === field),
            );
            if (entity.facts.some((f) => f.truncated))
              brief.gaps.push(
                'Long source fields are excerpts; truncation is marked on each affected fact.',
              );
            if (
              entity.facts.filter((f) => f.field === 'title').length > 1 &&
              new Set(entity.facts.filter((f) => f.field === 'title').map((f) => f.value)).size > 1
            ) {
              brief.status = 'partial';
              brief.gaps.push(
                'Search and detail titles differ; both source observations are retained. Verify at the source.',
              );
            }
          }
          brief.gaps = [...new Set(brief.gaps)].slice(0, 20);
          if (brief.entities.length && !brief.comparisonEvidence.sufficientEntities)
            brief.nextSteps[0] =
              'This brief lacks enough observed facts for job comparison. Inspect the source listings manually; title-only results do not establish suitability.';
          if (brief.reads.some((read) => read.status === 'error'))
            brief.nextSteps[2] =
              'Stop automated reads here. Follow the returned recovery guidance; checkpoints require a manual stop. This brief does not retry or add probes.';
          brief.bounds.readAttempts = limit.attempts;
          brief.generatedAt = new Date().toISOString();
          const data = { ...brief, markdown: renderBrief(brief) };
          return ok(data, 'engine', brief.status === 'partial', { status: brief.status });
        });
      }),
  );
}
