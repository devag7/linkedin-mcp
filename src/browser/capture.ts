/**
 * Endpoint capture tool (`--capture`).
 *
 * The architecture is proven: in-page Voyager fetch returns JSON. But Voyager's
 * REST-li paths get deprecated (HTTP 410) and its GraphQL queryIds rotate, so
 * they cannot be hardcoded long-term — they must be observed from the live SPA.
 *
 * This drives the authenticated browser through the main sections (profile,
 * people search, jobs, companies, messaging, feed) and records every
 * `/voyager/api/...` request the page itself fires. The deduped output is the
 * ground-truth endpoint catalog to wire into endpoints.ts.
 */

import { BrowserEngine } from './engine.js';
import type { Logger } from '../types.js';
import type { EnvConfig } from '../config/env.js';

interface CapturedCall {
  method: string;
  path: string; // pathname after /voyager/api
  queryId?: string;
  decorationId?: string;
  q?: string;
  count: number;
}

const ORIGIN = 'https://www.linkedin.com';

export async function runCapture(config: EnvConfig, logger: Logger): Promise<void> {
  const engine = new BrowserEngine({ ...config, LINKEDIN_HEADLESS: false }, logger);
  const context = await engine.ensureContext();

  if (!(await engine.isLoggedIn())) {
    process.stderr.write('\n❌ Not logged in. Run `npm run login` first.\n');
    await engine.shutdown();
    return;
  }

  const calls = new Map<string, CapturedCall>();
  context.on('request', (req) => {
    const url = req.url();
    const i = url.indexOf('/voyager/api/');
    if (i < 0) return;
    try {
      const u = new URL(url);
      const path = u.pathname.slice('/voyager/api'.length);
      const queryId = u.searchParams.get('queryId') ?? undefined;
      const decorationId = u.searchParams.get('decorationId') ?? undefined;
      const q = u.searchParams.get('q') ?? undefined;
      // Key by path + queryId so distinct GraphQL ops are kept separate.
      const key = `${req.method()} ${path} ${queryId ?? ''} ${q ?? ''}`;
      const existing = calls.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        calls.set(key, { method: req.method(), path, queryId, decorationId, q, count: 1 });
      }
    } catch {
      /* ignore unparseable */
    }
  });

  const page = await engine.getFeedPage();

  const sections: { name: string; url: string }[] = [
    { name: 'OWN PROFILE', url: `${ORIGIN}/in/me/` },
    { name: 'PROFILE DETAIL (skills)', url: `${ORIGIN}/in/me/details/skills/` },
    { name: 'PEOPLE SEARCH', url: `${ORIGIN}/search/results/people/?keywords=engineer` },
    { name: 'JOBS SEARCH', url: `${ORIGIN}/jobs/search/?keywords=software%20engineer` },
    { name: 'COMPANY', url: `${ORIGIN}/company/microsoft/` },
    { name: 'COMPANY PEOPLE', url: `${ORIGIN}/company/microsoft/people/` },
    { name: 'MESSAGING', url: `${ORIGIN}/messaging/` },
    { name: 'NOTIFICATIONS', url: `${ORIGIN}/notifications/` },
    { name: 'MY NETWORK', url: `${ORIGIN}/mynetwork/invitation-manager/` },
    { name: 'FEED', url: `${ORIGIN}/feed/` },
  ];

  for (const section of sections) {
    calls.clear();
    process.stderr.write(`\n\n========== ${section.name} ==========\n${section.url}\n`);
    try {
      await page.goto(section.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Let the SPA fire its data calls; scroll to trigger lazy loads.
      await page.waitForTimeout(3500);
      await page.mouse.wheel(0, 2000).catch(() => {});
      await page.waitForTimeout(2000);
    } catch (err) {
      process.stderr.write(`  (nav warning: ${err instanceof Error ? err.message : String(err)})\n`);
    }

    const rows = [...calls.values()].sort((a, b) => b.count - a.count);
    if (!rows.length) {
      process.stderr.write('  (no voyager calls captured)\n');
      continue;
    }
    for (const r of rows) {
      const tag = r.queryId
        ? `GRAPHQL queryId=${r.queryId}`
        : `REST-li${r.q ? ` q=${r.q}` : ''}${r.decorationId ? ` deco=${r.decorationId}` : ''}`;
      process.stderr.write(`  [${r.count}x] ${r.method} ${r.path}  ::  ${tag}\n`);
    }
  }

  process.stderr.write('\n\n✅ Capture complete. Paste the sections above to lock endpoints.\n');
  await engine.shutdown();
}
