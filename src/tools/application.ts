/** Local worksheet only. Listing text and candidate claims remain unverified input. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerTool } from './register.js';
import { failure, ok } from './result.js';
import {
  applicationInputShape,
  ApplicationEvidenceError,
  prepareApplicationMaterials,
} from './application-materials.js';

const boundedText = z.string().trim().min(1).max(1000);

export function registerApplicationTools(server: McpServer): void {
  registerTool(
    server,
    'prepare_job_application',
    'Create a local, unsaved application worksheet with optional reusable evidence, resume/cover-letter drafts and interview practice when supported by the input schema. Only explicitly selected user-supplied evidence is used; nothing is fetched, filled, uploaded, submitted, sent or stored. Verify every claim and the current listing yourself.',
    applicationInputShape,
    async (input) => {
      try {
        return ok(prepareApplicationMaterials(input), 'engine');
      } catch (error) {
        if (!(error instanceof ApplicationEvidenceError)) throw error;
        return failure('prepare_job_application', 'INVALID_APPLICATION_EVIDENCE', error.message);
      }
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
            next_action: boundedText.optional(),
            follow_up_at: z.string().datetime().optional(),
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
          (record) =>
            (record.status === 'receipt_verified' && !record.receipt_confirmed) ||
            (record.receipt_confirmed &&
              ['interested', 'drafting', 'submitted_unverified'].includes(record.status)),
        )
      )
        return failure(
          'export_application_tracker',
          'INVALID_TRACKER_RECORD',
          'Receipt confirmation is required for receipt-verified status and may remain recorded after rejection or withdrawal.',
        );
      const rows = records.map((record) => ({
        jobId: record.job_id,
        title: record.title,
        company: record.company ?? null,
        status: record.status,
        updatedAt: record.updated_at,
        receiptConfirmed: record.receipt_confirmed,
        nextAction: record.next_action ?? null,
        followUpAt: record.follow_up_at ?? null,
        sourceUrl: `https://www.linkedin.com/jobs/view/${record.job_id}/`,
      }));
      const cell = (value: string) => {
        const flat = value.replace(/[\r\n\t]/g, ' ');
        const safe = /^\s*[=+\-@]/.test(flat) ? `'${flat}` : flat;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      const csv = [
        'job_id,title,company,status,updated_at,receipt_confirmed,next_action,follow_up_at,source_url',
        ...rows.map((row) =>
          [
            row.jobId,
            row.title,
            row.company ?? '',
            row.status,
            row.updatedAt,
            String(row.receiptConfirmed),
            row.nextAction ?? '',
            row.followUpAt ?? '',
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
