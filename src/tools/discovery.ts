/**
 * Job search + messaging inbox tools (M2). Verified live 2026-06-13:
 * jobs via REST-li voyagerJobsDashJobCards (q=jobSearch), inbox via the
 * messaging GraphQL host (messengerConversations).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VoyagerClient } from '../browser/voyager.js';
import type { Guard } from '../browser/guard.js';
import { ACTIONS } from '../browser/guard.js';
import type { Logger } from '../types.js';
import {
  shapeJobs,
  shapeInbox,
  ownFsdId,
  type NormalizedResponse,
} from '../browser/normalize.js';
import * as ep from '../browser/endpoints.js';
import { ok, run } from './result.js';

export function registerDiscoveryTools(
  server: McpServer,
  voyager: VoyagerClient,
  guard: Guard,
  logger: Logger,
): void {
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

  logger.debug('Discovery tools registered');
}
