/**
 * Feed & notifications read tools (M1). Verified live 2026-06-13:
 * home feed via voyagerFeedDashMainFeed, notifications via the REST-li
 * notification cards collection.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VoyagerClient } from '../browser/voyager.js';
import type { Guard } from '../browser/guard.js';
import { ACTIONS } from '../browser/guard.js';
import type { Logger } from '../types.js';
import { shapeFeed, shapeNotifications, type NormalizedResponse } from '../browser/normalize.js';
import * as ep from '../browser/endpoints.js';
import { ok, run } from './result.js';

export function registerFeedTools(
  server: McpServer,
  voyager: VoyagerClient,
  guard: Guard,
  logger: Logger,
): void {
  server.tool(
    'get_feed',
    'Get recent posts from your LinkedIn home feed (author + post text).',
    {
      count: z.number().int().min(1).max(25).default(10).describe('Number of posts (default 10)'),
    },
    async ({ count }) =>
      run(logger, 'get_feed', async () => {
        const raw = await guard.run(ACTIONS.readGeneric, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.mainFeed(0, count)),
        );
        return ok(shapeFeed(raw));
      }),
  );

  server.tool(
    'get_notifications',
    'Get your recent LinkedIn notifications (headline, time, read state).',
    {
      count: z.number().int().min(1).max(50).default(20).describe('Number of notifications (default 20)'),
    },
    async ({ count }) =>
      run(logger, 'get_notifications', async () => {
        const raw = await guard.run(ACTIONS.readGeneric, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.notificationCards(0, count)),
        );
        return ok(shapeNotifications(raw));
      }),
  );

  logger.debug('Feed tools registered');
}
