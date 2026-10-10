/** Deterministic job briefs from registered reads. No model, storage, crawl or retry. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Logger } from '../types.js';
import { readLimit, type ReadLimit } from '../safety/read-limit.js';
import { registerTool, invokeBriefRead } from './register.js';
import { ok, run } from './result.js';
import { outputSchema } from './contracts.js';
import { briefSchema, hasComparisonEvidence, type briefFactSchema } from './research-contract.js';
type Brief = z.infer<typeof briefSchema>;
type Fact = z.infer<typeof briefFactSchema>;
// A source is attributable only to the same supported numeric job identity.
// Exact equality rejects trailing controls and unsupported/normalized namespaces.
const source = (row: Record<string, unknown>): string | undefined => {
  if (typeof row.jobUrn !== 'string') return undefined;
  const match = /^urn:li:(?:fsd_)?jobPosting:([0-9]{1,20})$/.exec(row.jobUrn);
  if (!match || match[0] !== row.jobUrn) return undefined;
  const canonical = `https://www.linkedin.com/jobs/view/${match[1]}/`;
  return row.sourceUrl === canonical ? canonical : undefined;
};
const fields = ['title', 'location', 'listedAt'] as const;
// Escape source text, including controls and Markdown links; treat it only as quoted data.
const md = (text: string) =>
  Array.from(text, (char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char))
    .join('')
    .replace(/[\\`*_[\]<>#|]/g, '\\$&');
export function renderBrief(brief: Omit<Brief, 'markdown'>): string {
  const lines = [
    `# Job research: ${md(brief.topic)}`,
    `Generated ${brief.generatedAt}; status: ${brief.status}.`,
    `Comparison evidence: ${brief.comparisonEvidence.sufficientEntities}/${brief.entities.length} jobs have an observed title plus location or listing date. This does not establish fit or availability.`,
    ...(brief.entities.length && !brief.comparisonEvidence.sufficientEntities
      ? [
          'Insufficient evidence to compare these jobs. The source-linked observations below are retained, not presented as a useful comparison.',
        ]
      : []),
    brief.scope,
    `Query: first ${brief.query.count} results; location geo ID: ${brief.query.locationGeoId ?? 'not specified'}; search-only; detail enrichment is unavailable.`,
    `Bounds: ${brief.bounds.readAttempts}/2 explicit Voyager read attempts (identity included); ${brief.bounds.toolCalls}/1 tool calls; ${brief.entities.length}/10 entities. Browser navigation/assets are not counted.`,
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
    'Build a source-linked job comparison: one first-page search (up to ten jobs), search-only title/location/listing-date observations, exact field citations/fetch times, unknowns, gaps and Markdown. At most two explicit Voyager read attempts including identity; browser assets/navigation excluded. No crawling, writes, persistence, retry or inferred fit. Stop on any read error.',
    {
      keywords: z.string().trim().min(1).max(200),
      location_geo_id: z
        .string()
        .regex(/^[0-9]{1,20}$/)
        .optional(),
      count: z.number().int().min(1).max(10).default(5),
      enrich_first: z.literal(false).default(false),
    },
    async ({ keywords, location_geo_id, count, enrich_first }, extra) =>
      run(logger, 'research_jobs', async () => {
        const limit: ReadLimit = { maximum: 2, attempts: 0 };
        return readLimit.run(limit, async () => {
          const brief: Omit<Brief, 'markdown'> = {
            topic: keywords,
            query: { keywords, locationGeoId: location_geo_id, count, enrichFirst: enrich_first },
            generatedAt: new Date().toISOString(),
            status: 'ok',
            comparisonEvidence: { sufficientEntities: 0, insufficientEntities: 0 },
            scope: 'One first-page job search only. Source observations, not recommendations.',
            bounds: {
              maxReadAttempts: 2,
              readAttempts: 0,
              maxEntities: 10,
              maxToolCalls: 1,
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
          const read = async (tool: 'search_jobs', args: Record<string, unknown>) => {
            brief.bounds.toolCalls++;
            const result = await invokeBriefRead(server, tool, args, extra);
            const parsed = outputSchema(tool).safeParse(result.structuredContent);
            if (!parsed.success) {
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
              const max = 300;
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
              const url = source(row);
              if (!url) {
                brief.status = 'partial';
                brief.gaps.push(
                  'A search result has no supported exact job identity/source agreement and was omitted.',
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
            if (rows.length === 0 && !search.meta.partial) brief.status = 'empty';
          }
          for (const entity of brief.entities) {
            if (hasComparisonEvidence(entity.facts)) brief.comparisonEvidence.sufficientEntities++;
            else {
              brief.comparisonEvidence.insufficientEntities++;
              brief.status = 'partial';
              brief.gaps.push(
                'Some linked jobs lack a title plus location or listing date; their comparison evidence is insufficient. No missing facts are inferred or extra reads made.',
              );
            }
            entity.unknownFields = fields.filter(
              (field) => !entity.facts.some((f) => f.field === field),
            );
            if (entity.facts.some((f) => f.truncated))
              brief.gaps.push(
                'Long source fields are excerpts; truncation is marked on each affected fact.',
              );
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
