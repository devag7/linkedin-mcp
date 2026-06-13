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
  shapeInbox,
  shapeConversationMessages,
  ownFsdId,
  type NormalizedResponse,
} from '../browser/normalize.js';
import { scrapePeopleSearch } from '../browser/dom.js';
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
