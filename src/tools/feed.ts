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
import { run } from './result.js';
import { registerTool } from './register.js';
import { readRows } from './provider-shape.js';
import { pageFields, pageStart, pageResult } from './pagination.js';

export function registerFeedTools(
  server: McpServer,
  voyager: VoyagerClient,
  guard: Guard,
  logger: Logger,
): void {
  registerTool(
    server,
    'get_feed',
    'Get recent posts from your LinkedIn home feed (author + post text).',
    {
      ...pageFields,
      count: z.number().int().min(1).max(25).default(10).describe('Number of posts (default 10)'),
    },
    async ({ count, offset, cursor }) =>
      run(logger, 'get_feed', async () => {
        const start = pageStart('get_feed', null, count, offset, cursor);
        const raw = await guard.run(ACTIONS.readGeneric, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.mainFeed(start, count)),
        );
        return pageResult('get_feed', null, count, start, readRows(raw, shapeFeed(raw)), raw);
      }),
  );

  registerTool(
    server,
    'get_notifications',
    'Get your recent LinkedIn notifications (headline, time, read state).',
    {
      ...pageFields,
      count: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe('Number of notifications (default 20)'),
    },
    async ({ count, offset, cursor }) =>
      run(logger, 'get_notifications', async () => {
        const start = pageStart('get_notifications', null, count, offset, cursor);
        const raw = await guard.run(ACTIONS.readGeneric, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.notificationCards(start, count)),
        );
        return pageResult(
          'get_notifications',
          null,
          count,
          start,
          readRows(raw, shapeNotifications(raw)),
          raw,
        );
      }),
  );

  logger.debug('Feed tools registered');
}
