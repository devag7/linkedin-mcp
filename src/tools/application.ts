/** Local worksheet only. Listing text and candidate claims remain unverified input. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTool } from './register.js';
import { failure, ok } from './result.js';

const boundedText = z.string().trim().min(1).max(1000);

export function registerApplicationTools(server: McpServer): void {
  registerTool(
    server,
    'prepare_job_application',
    'Create a local, unsaved worksheet from a job you selected and evidence you provide. This does not fetch, fill, upload or submit an application. Verify every claim and the current listing yourself.',
    {
      job_id: z
        .string()
        .regex(/^[0-9]{1,20}$/)
        .describe('Numeric LinkedIn job ID'),
      job_title: boundedText.describe('Title copied from the selected listing; not verified here'),
      company: boundedText.optional().describe('Optional company copied from the listing'),
      requirements: z
        .array(
          z.object({
            requirement: boundedText.describe('One requirement copied or summarized by you'),
            evidence: boundedText
              .optional()
              .describe('Your own truthful evidence; omit if unknown'),
          }),
        )
        .min(1)
        .max(20)
        .describe('At most 20 requirements and your matching evidence'),
    },
    async ({ job_id, job_title, company, requirements }) => {
      const rows = requirements.map(({ requirement, evidence }) => ({
        requirement,
        evidence: evidence ?? null,
        evidenceStatus: evidence ? ('user_supplied_unverified' as const) : ('missing' as const),
      }));
      return ok(
        {
          status: 'draft_only' as const,
          jobId: job_id,
          sourceUrl: `https://www.linkedin.com/jobs/view/${job_id}/`,
          jobTitle: job_title,
          company: company ?? null,
          sourceVerification: 'user_supplied_not_fetched' as const,
          requirements: rows,
          missingEvidenceCount: rows.filter((row) => row.evidence === null).length,
          nextSteps: [
            'Open the current job listing and verify its identity, requirements and application method.',
            'Check every evidence statement against your own resume and records; fill missing answers truthfully.',
            'Review the application and submit it yourself on LinkedIn or the employer site; keep its receipt privately.',
          ],
          submitted: false as const,
          stored: false as const,
        },
        'engine',
      );
    },
  );

  registerTool(
    server,
    'export_application_tracker',
    'Format up to 50 application statuses that you enter into a CSV. It does not inspect LinkedIn, infer submission, or save data. A receipt-verified status requires your explicit confirmation.',
    {
      records: z
        .array(
          z.object({
            job_id: z.string().regex(/^[0-9]{1,20}$/),
            title: boundedText,
            company: boundedText.optional(),
            status: z.enum([
              'interested',
              'drafting',
              'submitted_unverified',
              'receipt_verified',
              'rejected',
              'withdrawn',
            ]),
            updated_at: z.string().datetime(),
            receipt_confirmed: z.boolean().default(false),
          }),
        )
        .min(1)
        .max(50),
    },
    async ({ records }) => {
      const ids = records.map((record) => record.job_id);
      if (new Set(ids).size !== ids.length)
        return failure(
          'export_application_tracker',
          'INVALID_TRACKER_RECORD',
          'Each job ID may appear only once.',
        );
      if (
        records.some(
          (record) => (record.status === 'receipt_verified') !== record.receipt_confirmed,
        )
      )
        return failure(
          'export_application_tracker',
          'INVALID_TRACKER_RECORD',
          'Receipt confirmation must match receipt-verified status.',
        );
      const rows = records.map((record) => ({
        jobId: record.job_id,
        title: record.title,
        company: record.company ?? null,
        status: record.status,
        updatedAt: record.updated_at,
        receiptConfirmed: record.receipt_confirmed,
        sourceUrl: `https://www.linkedin.com/jobs/view/${record.job_id}/`,
      }));
      const cell = (value: string) => {
        const flat = value.replace(/[\r\n\t]/g, ' ');
        const safe = /^\s*[=+\-@]/.test(flat) ? `'${flat}` : flat;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      const csv = [
        'job_id,title,company,status,updated_at,receipt_confirmed,source_url',
        ...rows.map((row) =>
          [
            row.jobId,
            row.title,
            row.company ?? '',
            row.status,
            row.updatedAt,
            String(row.receiptConfirmed),
            row.sourceUrl,
          ]
            .map(cell)
            .join(','),
        ),
      ].join('\n');
      return ok(
        {
          status: 'export_only' as const,
          sourceVerification: 'user_supplied_not_fetched' as const,
          records: rows,
          csv,
          stored: false as const,
          submittedByTool: false as const,
        },
        'engine',
      );
    },
  );
}
