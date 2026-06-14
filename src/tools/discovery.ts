/**
 * Job search + messaging inbox tools (M2). Verified live 2026-06-13:
 * jobs via REST-li voyagerJobsDashJobCards (q=jobSearch), inbox via the
 * messaging GraphQL host (messengerConversations).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VoyagerClient } from '../browser/voyager.js';
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
import { ok, run } from './result.js';

export function registerDiscoveryTools(
  server: McpServer,
  voyager: VoyagerClient,
  engine: BrowserEngine,
  guard: Guard,
  logger: Logger,
): void {
  server.tool(
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
        return ok(people, 'dom');
      }),
  );

  server.tool(
    'search_jobs',
    'Search LinkedIn jobs by keywords (and optional location). Returns title, location, posted time.',
    {
      keywords: z.string().min(1).describe('Job search keywords, e.g. "software engineer"'),
      location_geo_id: z
        .string()
        .optional()
        .describe('Optional LinkedIn geo URN id to scope the location'),
      count: z.number().int().min(1).max(25).default(10).describe('Results (default 10)'),
    },
    async ({ keywords, location_geo_id, count }) =>
      run(logger, 'search_jobs', async () => {
        const raw = await guard.run(ACTIONS.search, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.jobCardsSearch(keywords, location_geo_id, 0, count)),
        );
        return ok(shapeJobs(raw));
      }),
  );

  server.tool(
    'get_inbox',
    'List your recent LinkedIn messaging conversations (title, last activity, unread count).',
    {},
    async () =>
      run(logger, 'get_inbox', async () => {
        const data = await guard.run(ACTIONS.readGeneric, async () => {
          const me = await voyager.voyagerGet<NormalizedResponse>(ep.me());
          const fsd = ownFsdId(me);
          if (!fsd) throw new Error('Could not resolve own profile id from /me.');
          const raw = await voyager.voyagerGet<NormalizedResponse>(ep.inboxConversations(fsd));
          return shapeInbox(raw);
        });
        return ok(data);
      }),
  );

  server.tool(
    'get_job_details',
    'Get full details for a job posting by its numeric id (the digits in /jobs/view/<id> or from search_jobs jobUrn).',
    {
      job_id: z.string().min(1).describe('Numeric job id, e.g. "4423697734"'),
    },
    async ({ job_id }) =>
      run(logger, 'get_job_details', async () => {
        const raw = await guard.run(ACTIONS.readGeneric, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.jobPostingGraphql(job_id)),
        );
        return ok(shapeJobDetails(raw));
      }),
  );

  server.tool(
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
        return ok(companies, 'dom');
      }),
  );

  server.tool(
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
        return ok(company, 'dom');
      }),
  );

  server.tool(
    'get_company_posts',
    "Get a company's recent posts by its LinkedIn URL slug (e.g. \"google\"). Returns post text + a short meta line.",
    {
      universal_name: z.string().min(1).describe('Company URL slug, e.g. "google"'),
      count: z.number().int().min(1).max(25).default(10).describe('Posts to return (default 10)'),
    },
    async ({ universal_name, count }) =>
      run(logger, 'get_company_posts', async () => {
        const posts = await guard.run(ACTIONS.readGeneric, () =>
          scrapeCompanyPosts(engine, universal_name, count, logger),
        );
        return ok(posts, 'dom');
      }),
  );

  server.tool(
    'get_company_employees',
    'List employees LinkedIn surfaces for a company (by URL slug). Returns name, headline, and public identifier (feed the slug to get_profile). Prospecting core.',
    {
      universal_name: z.string().min(1).describe('Company URL slug, e.g. "anthropicresearch"'),
      count: z.number().int().min(1).max(25).default(10).describe('Employees to return (default 10)'),
    },
    async ({ universal_name, count }) =>
      run(logger, 'get_company_employees', async () => {
        const people = await guard.run(ACTIONS.search, () =>
          scrapeCompanyEmployees(engine, universal_name, count, logger),
        );
        return ok(people, 'dom');
      }),
  );

  server.tool(
    'get_pending_invitations',
    'List your pending connection invitations — received (inbound, with the urn/sharedSecret to accept later) and sent (outbound). Read-only.',
    {
      direction: z
        .enum(['received', 'sent', 'both'])
        .default('both')
        .describe('Which queue to return (default both)'),
      count: z.number().int().min(1).max(100).default(50).describe('Max per direction (default 50)'),
    },
    async ({ direction, count }) =>
      run(logger, 'get_pending_invitations', async () => {
        const result: { received?: unknown[]; sent?: unknown[]; errors?: Record<string, string> } = {};
        const errors: Record<string, string> = {};
        await guard.run(ACTIONS.readGeneric, async () => {
          if (direction === 'received' || direction === 'both') {
            try {
              const raw = await voyager.voyagerGet<NormalizedResponse>(ep.invitationsReceived(0, count));
              result.received = shapePendingInvitations(raw);
            } catch (e) {
              errors.received = e instanceof Error ? e.message : String(e);
            }
          }
          if (direction === 'sent' || direction === 'both') {
            try {
              const raw = await voyager.voyagerGet<NormalizedResponse>(ep.invitationsSent(0, count));
              result.sent = shapePendingInvitations(raw);
            } catch (e) {
              errors.sent = e instanceof Error ? e.message : String(e);
            }
          }
        });
        const partial = Object.keys(errors).length > 0;
        if (partial) result.errors = errors;
        return ok(result, 'voyager', partial);
      }),
  );

  server.tool(
    'get_conversation',
    'Read messages in a LinkedIn conversation by its URN (get the URN from get_inbox).',
    {
      conversation_urn: z
        .string()
        .min(1)
        .describe('Full urn:li:msg_conversation:(...) from a get_inbox result'),
    },
    async ({ conversation_urn }) =>
      run(logger, 'get_conversation', async () => {
        const raw = await guard.run(ACTIONS.readGeneric, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.conversationMessages(conversation_urn)),
        );
        return ok(shapeConversationMessages(raw));
      }),
  );

  logger.debug('Discovery tools registered');
}
