/**
 * Profile read tools (M1, P0). Query Voyager via the in-page fetch and return
 * shaped, compact profiles. The full profile is assembled from the DASH profile
 * core (name/headline/summary) plus the lazy-loaded experience/education
 * component sections.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VoyagerClient } from '../browser/voyager.js';
import type { Guard } from '../browser/guard.js';
import { ACTIONS } from '../browser/guard.js';
import type { Logger } from '../types.js';
import {
  shapeProfileView,
  ownPublicId,
  fsdProfileId,
  collectComponentEntries,
  type NormalizedResponse,
} from '../browser/normalize.js';
import * as ep from '../browser/endpoints.js';
import { ok, run } from './result.js';

/** Fetch the DASH core profile + experience/education components and merge. */
async function buildProfile(voyager: VoyagerClient, slug: string): Promise<unknown> {
  const profileResp = await voyager.voyagerGet<NormalizedResponse>(ep.dashProfile(slug));
  const core = shapeProfileView(profileResp);
  const fsd = fsdProfileId(profileResp);

  let experience: unknown[] = [];
  let education: unknown[] = [];
  if (fsd) {
    const expResp = await voyager.voyagerGet<NormalizedResponse>(
      ep.profileComponents(fsd, 'experience'),
    );
    experience = collectComponentEntries(expResp).map((e) => ({
      title: e.title,
      company: e.subtitle,
      dates: e.caption,
      location: e.meta,
    }));
    const eduResp = await voyager.voyagerGet<NormalizedResponse>(
      ep.profileComponents(fsd, 'education'),
    );
    education = collectComponentEntries(eduResp).map((e) => ({
      school: e.title,
      degree: e.subtitle,
      dates: e.caption,
    }));
  }

  // Drop the (empty) typed arrays from the core and attach the rich ones.
  const { experience: _e, education: _ed, ...rest } = core;
  void _e;
  void _ed;
  return { ...rest, experience, education };
}

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
        const data = await guard.run(ACTIONS.getProfile, async () => {
          const me = await voyager.voyagerGet<NormalizedResponse>(ep.me());
          const publicId = ownPublicId(me);
          if (!publicId) throw new Error('Could not resolve own publicIdentifier from /me.');
          return buildProfile(voyager, publicId);
        });
        return ok(data);
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
        const data = await guard.run(ACTIONS.getProfile, () => buildProfile(voyager, username));
        return ok(data);
      }),
  );

  logger.debug('Profile tools registered');
}
