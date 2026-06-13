/**
 * Profile read tools (M1, P0). Query Voyager via the in-page fetch and return
 * shaped, compact profiles instead of the raw normalized firehose.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VoyagerClient } from '../browser/voyager.js';
import type { Guard } from '../browser/guard.js';
import { ACTIONS } from '../browser/guard.js';
import type { Logger } from '../types.js';
import { shapeProfileView, type NormalizedResponse } from '../browser/normalize.js';
import * as ep from '../browser/endpoints.js';
import { ok, run } from './result.js';

export function registerProfileTools(
  server: McpServer,
  voyager: VoyagerClient,
  guard: Guard,
  logger: Logger,
): void {
  server.tool(
    'get_my_profile',
    "Get the authenticated user's own LinkedIn profile (experience, education, headline, summary).",
    {},
    async () =>
      run(logger, 'get_my_profile', async () => {
        const raw = await guard.run(ACTIONS.getProfile, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.profileView('me')),
        );
        return ok(shapeProfileView(raw));
      }),
  );

  server.tool(
    'get_profile',
    'Get a LinkedIn profile by public identifier (the slug in the profile URL, e.g. "satyanadella").',
    {
      username: z
        .string()
        .min(1)
        .describe('LinkedIn public identifier / vanity slug, e.g. "williamhgates"'),
    },
    async ({ username }) =>
      run(logger, 'get_profile', async () => {
        const raw = await guard.run(ACTIONS.getProfile, () =>
          voyager.voyagerGet<NormalizedResponse>(ep.profileView(username)),
        );
        return ok(shapeProfileView(raw));
      }),
  );

  logger.debug('Profile tools registered');
}
