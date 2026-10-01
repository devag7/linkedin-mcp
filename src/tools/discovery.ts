/**
 * Job search + messaging inbox tools (M2). Verified live 2026-06-13:
 * jobs via REST-li voyagerJobsDashJobCards (q=jobSearch), inbox via the
 * messaging GraphQL host (messengerConversations).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VoyagerError, type VoyagerClient } from '../browser/voyager.js';
import { SafetyStateError } from '../safety/state-lock.js';
import { BrowserSafetyError } from '../browser/safety.js';
import type { BrowserEngine } from '../browser/engine.js';
import type { Guard } from '../browser/guard.js';
import { ACTIONS } from '../browser/guard.js';
import type { Logger } from '../types.js';
import {
  shapeJobs,
  shapeJobDetails,
  shapeInbox,
  shapeConversationMessages,
  shapePendingInvitations,
  ownFsdId,
  type NormalizedResponse,
} from '../browser/normalize.js';
import {
  scrapePeopleSearch,
  scrapeCompany,
  scrapeCompanySearch,
  scrapeCompanyPosts,
  scrapeCompanyEmployees,
} from '../browser/dom.js';
import * as ep from '../browser/endpoints.js';
import { ok, run, ToolError } from './result.js';
import { registerTool } from './register.js';
import { assertReadResponse, readRows } from './provider-shape.js';
import { pageFields, pageStart, pageResult, firstPage } from './pagination.js';

export function registerDiscoveryTools(
  server: McpServer,
  voyager: VoyagerClient,
  engine: BrowserEngine,
  guard: Guard,
  logger: Logger,
): void {
  registerTool(
    server,
    'search_people',
    'Search LinkedIn people by keywords. Returns name, headline, location, and public identifier (pass that to get_profile for full details).',
    {
      keywords: z.string().min(1).describe('Search keywords, e.g. "recruiter at Google"'),
      count: z.number().int().min(1).max(25).default(10).describe('Results (default 10)'),
    },
    async ({ keywords, count }) =>
      run(logger, 'search_people', async () => {
        const people = await guard.run(ACTIONS.search, () =>
          scrapePeopleSearch(engine, keywords, count, logger),
        );
        return firstPage(people, count, 'dom');
      }),
  );

  registerTool(
    server,
    'search_jobs',
    'Search LinkedIn jobs by keywords (and optional location). Returns title, location, posted time.',
    {
      keywords: z.string().min(1).describe('Job search keywords, e.g. "software engineer"'),
      ...pageFields,
      location_geo_id: z
        .string()
        .optional()
        .describe('Optional LinkedIn geo URN id to scope the location'),
      count: z.number().int().min(1).max(25).default(10).describe('Results (default 10)'),
    },
    async ({ keywords, location_geo_id, count, offset, cursor }) =>
      run(logger, 'search_jobs', async () => {
        const query = { keywords, location_geo_id };
        const start = pageStart('search_jobs', query, count, offset, cursor);
        const raw = await guard.run(ACTIONS.search, () =>
          voyager.voyagerGet<NormalizedResponse>(
            ep.jobCardsSearch(keywords, location_geo_id, start, count),
          ),
        );
        return pageResult('search_jobs', query, count, start, readRows(raw, shapeJobs(raw)), raw);
      }),
  );

  registerTool(
    server,
    'get_inbox',
    'List a bounded first page of recent conversations with participant names, headlines and profile links. Continuation is not verified.',
    { count: z.number().int().min(1).max(50).default(20) },
    async ({ count }) =>
      run(logger, 'get_inbox', async () => {
        const data = await guard.run(ACTIONS.readGeneric, async () => {
          const me = await voyager.voyagerGet<NormalizedResponse>(ep.me());
          const fsd = ownFsdId(me);
          if (!fsd) throw new Error('Could not resolve own profile id from /me.');
          const raw = await voyager.voyagerGet<NormalizedResponse>(ep.inboxConversations(fsd));
          return readRows(raw, shapeInbox(raw));
        });
        return firstPage(data, count, 'voyager');
      }),
  );

  registerTool(
    server,
    'get_job_details',
    'Get full details for a job posting by its numeric id (the digits in /jobs/view/<id> or from search_jobs jobUrn).',
    {
      job_id: z
        .string()
        .regex(/^[0-9]{1,20}$/)
        .describe('Numeric job id, e.g. "4423697734"'),
    },
    async ({ job_id }) =>
      run(logger, 'get_job_details', async () => {
        const raw = await guard.run(ACTIONS.readGeneric, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.jobPostingGraphql(job_id)),
        );
        assertReadResponse(raw);
        const job = shapeJobDetails(raw);
        if (!job.title || !job.jobUrn) throw new ToolError('RESPONSE_SHAPE_CHANGED');
        return ok({ ...job, sourceUrl: `https://www.linkedin.com/jobs/view/${job_id}/` });
      }),
  );

  registerTool(
    server,
    'search_companies',
    'Search LinkedIn companies by keywords. Returns name + universalName slug (pass that to get_company for full details).',
    {
      keywords: z.string().min(1).describe('Search keywords, e.g. "fintech bangalore"'),
      count: z.number().int().min(1).max(25).default(10).describe('Results (default 10)'),
    },
    async ({ keywords, count }) =>
      run(logger, 'search_companies', async () => {
        const companies = await guard.run(ACTIONS.search, () =>
          scrapeCompanySearch(engine, keywords, count, logger),
        );
        return firstPage(companies, count, 'dom');
      }),
  );

  registerTool(
    server,
    'get_company',
    'Get a company by its LinkedIn URL slug (e.g. "google", "microsoft"). Returns name, description, website, industry, size, HQ.',
    {
      universal_name: z.string().min(1).describe('Company URL slug, e.g. "google"'),
    },
    async ({ universal_name }) =>
      run(logger, 'get_company', async () => {
        const company = await guard.run(ACTIONS.readGeneric, () =>
          scrapeCompany(engine, universal_name, logger),
        );
        if (!company.name) throw new ToolError('RESPONSE_SHAPE_CHANGED');
        return ok(
          {
            ...company,
            sourceUrl: `https://www.linkedin.com/company/${encodeURIComponent(universal_name)}/`,
          },
          'dom',
          true,
        );
      }),
  );

  registerTool(
    server,
    'get_company_posts',
    'Get a company\'s recent posts by its LinkedIn URL slug (e.g. "google"). Returns post text + a short meta line.',
    {
      universal_name: z.string().min(1).describe('Company URL slug, e.g. "google"'),
      count: z.number().int().min(1).max(25).default(10).describe('Posts to return (default 10)'),
    },
    async ({ universal_name, count }) =>
      run(logger, 'get_company_posts', async () => {
        const posts = await guard.run(ACTIONS.readGeneric, () =>
          scrapeCompanyPosts(engine, universal_name, count, logger),
        );
        return firstPage(posts, count, 'dom');
      }),
  );

  registerTool(
    server,
    'get_company_employees',
    'List employees LinkedIn surfaces for a company (by URL slug). Returns name, headline, and public identifier (feed the slug to get_profile). Prospecting core.',
    {
      universal_name: z.string().min(1).describe('Company URL slug, e.g. "anthropicresearch"'),
      count: z
        .number()
        .int()
        .min(1)
        .max(25)
        .default(10)
        .describe('Employees to return (default 10)'),
    },
    async ({ universal_name, count }) =>
      run(logger, 'get_company_employees', async () => {
        const people = await guard.run(ACTIONS.search, () =>
          scrapeCompanyEmployees(engine, universal_name, count, logger),
        );
        return firstPage(people, count, 'dom');
      }),
  );

  registerTool(
    server,
    'get_pending_invitations',
    'List your pending connection invitations — received (inbound, with the urn/sharedSecret to accept later) and sent (outbound). Read-only.',
    {
      direction: z
        .enum(['received', 'sent', 'both'])
        .default('both')
        .describe('Which queue to return (default both)'),
      count: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(50)
        .describe('Max per direction (default 50)'),
    },
    async ({ direction, count }) =>
      run(logger, 'get_pending_invitations', async () => {
        const result: { received?: unknown[]; sent?: unknown[]; errors?: Record<string, string> } =
          {};
        const errors: Record<string, string> = {};
        await guard.run(ACTIONS.readGeneric, async () => {
          if (direction === 'received' || direction === 'both') {
            try {
              const raw = await voyager.voyagerGet<NormalizedResponse>(
                ep.invitationsReceived(0, count),
              );
              result.received = readRows(raw, shapePendingInvitations(raw)).slice(0, count);
            } catch (e) {
              if (
                e instanceof BrowserSafetyError ||
                e instanceof SafetyStateError ||
                (e instanceof VoyagerError &&
                  ['AUTH_REQUIRED', 'RATE_LIMITED', 'CLOUDFLARE_BLOCKED'].includes(e.code)) ||
                (e instanceof ToolError && e.code === 'CANCELLED')
              )
                throw e;
              errors.received =
                'Received invitation page failed; use health_check before retrying.';
            }
          }
          if (direction === 'sent' || direction === 'both') {
            try {
              const raw = await voyager.voyagerGet<NormalizedResponse>(
                ep.invitationsSent(0, count),
              );
              result.sent = readRows(raw, shapePendingInvitations(raw)).slice(0, count);
            } catch (e) {
              if (
                e instanceof BrowserSafetyError ||
                e instanceof SafetyStateError ||
                (e instanceof VoyagerError &&
                  ['AUTH_REQUIRED', 'RATE_LIMITED', 'CLOUDFLARE_BLOCKED'].includes(e.code)) ||
                (e instanceof ToolError && e.code === 'CANCELLED')
              )
                throw e;
              errors.sent = 'Sent invitation page failed; use health_check before retrying.';
            }
          }
        });
        if (Object.keys(errors).length && !result.received && !result.sent)
          throw new ToolError('PROVIDER_ERROR');
        const partial = true; // Two bounded first pages; provider completeness is unknown.
        if (Object.keys(errors).length) result.errors = errors;
        return ok(result, 'voyager', partial);
      }),
  );

  registerTool(
    server,
    'get_conversation',
    'Read a bounded page of messages by the conversation URN from get_inbox, sorted oldest-first with sender attribution when present. Continuation is not verified.',
    {
      count: z.number().int().min(1).max(100).default(50),
      conversation_urn: z
        .string()
        .min(1)
        .describe('Full urn:li:msg_conversation:(...) from a get_inbox result'),
    },
    async ({ conversation_urn, count }) =>
      run(logger, 'get_conversation', async () => {
        const raw = await guard.run(ACTIONS.readGeneric, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.conversationMessages(conversation_urn)),
        );
        return firstPage(readRows(raw, shapeConversationMessages(raw)), count, 'voyager');
      }),
  );

  logger.debug('Discovery tools registered');
}
