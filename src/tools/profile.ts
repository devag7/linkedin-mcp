/**
 * Profile read tools (M1, P0). Query Voyager via the in-page fetch and return
 * shaped, compact profiles. The full profile is assembled from the DASH profile
 * core (name/headline/summary) plus the lazy-loaded experience/education
 * component sections.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { VoyagerError, type VoyagerClient } from '../browser/voyager.js';
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

/**
 * Fetch one profile section's component entries, tolerant of a section that
 * does not exist (returns []). Never truncates — collects every entry walked
 * (avoids the competitor's #360 "stops at 30" bug).
 */
async function section(
  voyager: VoyagerClient,
  fsd: string,
  name: ep.ProfileSection,
): Promise<ReturnType<typeof collectComponentEntries>> {
  try {
    const resp = await voyager.voyagerGet<NormalizedResponse>(ep.profileComponents(fsd, name));
    return collectComponentEntries(resp);
  } catch (e) {
    // A 404 means the profile simply has no such section — legitimately empty.
    // Everything else (AUTH_REQUIRED / RATE_LIMITED / CLOUDFLARE_BLOCKED / …) is
    // a real failure that must propagate, or the profile silently looks empty.
    if (e instanceof VoyagerError && e.code === 'NOT_FOUND') return [];
    throw e;
  }
}

/** Fetch the DASH core profile + lazy-loaded section components and merge. */
async function buildProfile(voyager: VoyagerClient, slug: string): Promise<unknown> {
  const profileResp = await voyager.voyagerGet<NormalizedResponse>(ep.dashProfile(slug));
  const core = shapeProfileView(profileResp);
  const fsd = fsdProfileId(profileResp);

  let experience: unknown[] = [];
  let education: unknown[] = [];
  let skills: unknown[] = [];
  let certifications: unknown[] = [];
  let languages: unknown[] = [];
  if (fsd) {
    // Sections lazy-load independently; fetch in parallel.
    const [exp, edu, sk, certs, langs] = await Promise.all([
      section(voyager, fsd, 'experience'),
      section(voyager, fsd, 'education'),
      section(voyager, fsd, 'skills'),
      section(voyager, fsd, 'certifications'),
      section(voyager, fsd, 'languages'),
    ]);
    experience = exp.map((e) => ({ title: e.title, company: e.subtitle, dates: e.caption, location: e.meta }));
    education = edu.map((e) => ({ school: e.title, degree: e.subtitle, dates: e.caption }));
    skills = sk.map((e) => ({ name: e.title, detail: e.subtitle }));
    certifications = certs.map((e) => ({ name: e.title, issuer: e.subtitle, dates: e.caption }));
    languages = langs.map((e) => ({ name: e.title, proficiency: e.subtitle }));
  }

  // Drop the (empty) typed arrays from the core and attach the rich ones.
  const { experience: _e, education: _ed, ...rest } = core;
  void _e;
  void _ed;
  return { ...rest, experience, education, skills, certifications, languages };
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
