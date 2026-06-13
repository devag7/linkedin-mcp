/**
 * Interactive login (Path A) and the M0 architecture spike.
 *
 * Path A: open a real Chrome window, let the human log in (and solve any
 * captcha / 2FA themselves), then persist the session in the profile dir.
 * No credential injection, no fabricated tokens — the maintainer of the
 * competing project found cookie-only injection less stable than a real session.
 */

import { BrowserEngine } from './engine.js';
import { VoyagerClient } from './voyager.js';
import * as ep from './endpoints.js';
import {
  ownPublicId,
  shapeProfileView,
  shapeFeed,
  shapeNotifications,
  collectComponentEntries,
  type NormalizedResponse,
} from './normalize.js';
import type { Logger } from '../types.js';
import type { EnvConfig } from '../config/env.js';

const LOGIN_URL = 'https://www.linkedin.com/login';
const FEED_URL = 'https://www.linkedin.com/feed/';

/**
 * Run a headful interactive login. Forces a visible window regardless of the
 * LINKEDIN_HEADLESS setting, waits until the li_at cookie appears (max 5 min),
 * then leaves the persisted profile ready for the server to reuse.
 */
export async function interactiveBrowserLogin(
  config: EnvConfig,
  logger: Logger,
): Promise<boolean> {
  const engine = new BrowserEngine({ ...config, LINKEDIN_HEADLESS: false }, logger);
  const context = await engine.ensureContext();

  const page = await engine.getFeedPage();
  if (await engine.isLoggedIn()) {
    process.stderr.write('\n✅ Already logged in — session is valid.\n');
    await engine.shutdown();
    return true;
  }

  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
  process.stderr.write(
    '\n🔐 A Chrome window opened. Log in to LinkedIn there (solve any captcha/2FA).\n' +
      '   Waiting up to 5 minutes for login to complete…\n',
  );

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    if (await engine.isLoggedIn()) {
      await page.goto(FEED_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      process.stderr.write('\n✅ Logged in. Session saved to the persistent profile.\n');
      await engine.shutdown();
      return true;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  process.stderr.write('\n❌ Login timed out after 5 minutes.\n');
  await engine.shutdown();
  void context;
  return false;
}

/**
 * M0 verify spike — the architecture go/no-go.
 * Proves a real Voyager call returns parsed JSON through the in-page fetch.
 */
export async function runSpike(config: EnvConfig, logger: Logger): Promise<void> {
  const engine = new BrowserEngine(config, logger);
  const voyager = new VoyagerClient(engine, logger);
  try {
    await engine.ensureContext();
    if (!(await engine.isLoggedIn())) {
      process.stderr.write('\n❌ Not logged in. Run `npm run login` first.\n');
      return;
    }

    process.stderr.write('\n▶ /me …\n');
    const me = await voyager.voyagerGet<NormalizedResponse>(ep.me());
    const publicId = ownPublicId(me);
    process.stderr.write(`  ✅ 200. publicIdentifier = ${publicId ?? '(not found)'}\n`);
    if (!publicId) throw new Error('No publicIdentifier in /me');

    process.stderr.write(`\n▶ full DASH profile for "${publicId}" …\n`);
    const prof = await voyager.voyagerGet<NormalizedResponse>(ep.dashProfile(publicId));
    process.stderr.write(`  ✅ 200. data keys: [${Object.keys(prof.data ?? {}).join(', ')}]\n`);

    // Histogram of included $type (last segment) so the shaper can be tuned.
    const hist = new Map<string, number>();
    for (const e of prof.included ?? []) {
      const t = typeof e.$type === 'string' ? e.$type.split('.').pop()! : '?';
      hist.set(t, (hist.get(t) ?? 0) + 1);
    }
    process.stderr.write(`  included[${(prof.included ?? []).length}] $types:\n`);
    for (const [t, n] of [...hist.entries()].sort((a, b) => b[1] - a[1])) {
      process.stderr.write(`    ${n}x ${t}\n`);
    }
    const profileEntity = (prof.included ?? []).find((e) => 'firstName' in e);
    if (profileEntity) {
      process.stderr.write(`  profile entity keys: [${Object.keys(profileEntity).join(', ')}]\n`);
    }
    const positionEntity = (prof.included ?? []).find(
      (e) => typeof e.$type === 'string' && e.$type.endsWith('Position'),
    );
    if (positionEntity) {
      process.stderr.write(`  Position keys: [${Object.keys(positionEntity).join(', ')}]\n`);
    }

    process.stderr.write('\n— shaped output —\n');
    process.stderr.write(JSON.stringify(shapeProfileView(prof), null, 2) + '\n');

    // Resolve own fsd_profile id (for components probe).
    const fsdId =
      (profileEntity?.['entityUrn'] as string | undefined)?.match(
        /urn:li:fsd_profile:([^,)]+)/,
      )?.[1] ?? '';

    // Probe the next batch of endpoints; dump structure to lock shapers.
    const probe = async (label: string, path: string, dumpType?: string): Promise<void> => {
      try {
        const r = await voyager.voyagerGet<NormalizedResponse>(path);
        const types = new Map<string, number>();
        for (const e of r.included ?? []) {
          const t = typeof e.$type === 'string' ? e.$type.split('.').pop()! : '?';
          types.set(t, (types.get(t) ?? 0) + 1);
        }
        const hist = [...types.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n}x ${t}`);
        process.stderr.write(
          `\n▶ ${label} → ✅ 200  data:[${Object.keys(r.data ?? {}).join(',')}]  included[${(r.included ?? []).length}]: ${hist.join(', ')}\n`,
        );
        if (dumpType) {
          const sample = (r.included ?? []).find(
            (e) => typeof e.$type === 'string' && e.$type.endsWith(dumpType),
          );
          if (sample) {
            process.stderr.write(`   ${dumpType} keys: [${Object.keys(sample).join(', ')}]\n`);
            const json = JSON.stringify(sample);
            process.stderr.write(`   ${dumpType} sample: ${json.length > 600 ? json.slice(0, 600) + '…' : json}\n`);
          }
          // Company + components carry their real fields in data.data (GraphQL primary).
          if (label.includes('Components') || label.includes('company')) {
            process.stderr.write(`   data.data: ${JSON.stringify(r.data).slice(0, 900)}…\n`);
          }
        }
      } catch (e) {
        process.stderr.write(`\n▶ ${label} → ❌ ${e instanceof Error ? e.message : String(e)}\n`);
      }
    };

    if (fsdId) await probe('profileComponents(experience)', ep.profileComponents(fsdId, 'experience'), 'Position');
    await probe('company(microsoft)', ep.companyGraphql('microsoft'), 'Company');
    await probe('feed', ep.mainFeed(0, 5), 'Update');
    await probe('notifications', ep.notificationCards(0, 10), 'Card');
    await probe('jobsSearch', ep.jobCardsSearch('software engineer', undefined, 0, 5), 'JobPostingCard');
    if (fsdId) await probe('inbox', ep.inboxConversations(fsdId), 'Conversation');

    // Confirm the experience/education component walker.
    if (fsdId) {
      try {
        const exp = await voyager.voyagerGet<NormalizedResponse>(ep.profileComponents(fsdId, 'experience'));
        process.stderr.write('\n— experience (shaped) —\n' + JSON.stringify(collectComponentEntries(exp), null, 2) + '\n');
        const edu = await voyager.voyagerGet<NormalizedResponse>(ep.profileComponents(fsdId, 'education'));
        process.stderr.write('\n— education (shaped) —\n' + JSON.stringify(collectComponentEntries(edu), null, 2) + '\n');
      } catch (e) {
        process.stderr.write(`\n(exp/edu preview failed: ${e instanceof Error ? e.message : String(e)})\n`);
      }
    }

    // Show the two newly-wired tools producing clean shaped output.
    try {
      const feed = await voyager.voyagerGet<NormalizedResponse>(ep.mainFeed(0, 5));
      process.stderr.write(
        '\n— get_feed (shaped, first 3) —\n' +
          JSON.stringify(shapeFeed(feed).slice(0, 3), null, 2) + '\n',
      );
      const notifs = await voyager.voyagerGet<NormalizedResponse>(ep.notificationCards(0, 5));
      process.stderr.write(
        '\n— get_notifications (shaped, first 3) —\n' +
          JSON.stringify(shapeNotifications(notifs).slice(0, 3), null, 2) + '\n',
      );
    } catch (e) {
      process.stderr.write(`\n(shaped-output preview failed: ${e instanceof Error ? e.message : String(e)})\n`);
    }

    process.stderr.write('\n🎯 ARCHITECTURE CONFIRMED — in-page Voyager fetch returns structured JSON.\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\n❌ Spike failed: ${msg}\n`);
  } finally {
    await engine.shutdown();
  }
}
