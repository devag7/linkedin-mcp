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
      process.stderr.write('\n❌ Not logged in. Run `--login` first.\n');
      return;
    }

    process.stderr.write('\n▶ voyagerGet("/me") …\n');
    const me = await voyager.voyagerGet<Record<string, unknown>>('/me');
    const meKeys = Object.keys(me ?? {});
    process.stderr.write(`  ✅ 200 JSON, top keys: [${meKeys.join(', ')}]\n`);

    // Resolve own public identifier from /me, then fetch the full profileView.
    const miniProfileUrn = findMiniProfileUrn(me);
    process.stderr.write(`  self miniProfile: ${miniProfileUrn ?? '(not found)'}\n`);

    process.stderr.write(
      '\n▶ voyagerGet("/identity/profiles/me/profileView") …\n',
    );
    const pv = await voyager.voyagerGet<Record<string, unknown>>(
      '/identity/profiles/me/profileView',
    );
    const pvKeys = Object.keys(pv ?? {});
    process.stderr.write(`  ✅ 200 JSON, top keys: [${pvKeys.join(', ')}]\n`);
    process.stderr.write('\n🎯 ARCHITECTURE CONFIRMED — in-page Voyager fetch returns structured JSON.\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\n❌ Spike failed: ${msg}\n`);
  } finally {
    await engine.shutdown();
  }
}

function findMiniProfileUrn(me: unknown): string | undefined {
  if (me && typeof me === 'object' && 'data' in me) {
    const data = (me as { data?: Record<string, unknown> }).data;
    const urn = data?.['*miniProfile'] ?? data?.['entityUrn'];
    if (typeof urn === 'string') return urn;
  }
  return undefined;
}
