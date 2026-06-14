/**
 * Write-request capture harness (`--writecapture`).
 *
 * The five write tools (connect / message / post / react / comment) ship with
 * BEST-KNOWN payloads from the `linkedin-api` lineage that were never verified
 * against the current Voyager deploy ("verified-stale"). Guessing payloads is
 * exactly what makes them fragile. This harness recovers GROUND TRUTH instead:
 * it drives the authenticated burner UI to the moment each write fires, then
 * INTERCEPTS the outgoing POST and `route.abort()`s it — so we record the exact
 * method + path + query + JSON body the live SPA sends, with ZERO side effects
 * (no real post, invite, message, reaction, or comment is ever created).
 *
 * It also passively records the SPA's own GET requests + response statuses for
 * the jobs / notifications / messaging surfaces, to diagnose why our replayed
 * calls 401 on a fresh account while the SPA's identical-looking calls succeed.
 *
 * Read-only to the account by construction. Run headful or headless on a burner.
 */

import { BrowserEngine } from './engine.js';
import type { Logger } from '../types.js';
import type { EnvConfig } from '../config/env.js';
import type { Page, Route } from 'patchright';

const ORIGIN = 'https://www.linkedin.com';

interface CapturedWrite {
  label: string;
  method: string;
  path: string; // after /voyager/api
  postData?: string;
}

interface ObservedCall {
  method: string;
  path: string;
  status?: number;
  queryId?: string;
}

function shortPath(url: string): string | undefined {
  const i = url.indexOf('/voyager/api/');
  if (i < 0) return undefined;
  try {
    const u = new URL(url);
    return u.pathname.slice('/voyager/api'.length) + (u.search || '');
  } catch {
    return undefined;
  }
}

/** Heuristic: is this voyager path a write (a mutation), not a read? */
function looksLikeWrite(method: string, path: string): boolean {
  if (method !== 'POST') return false;
  return /normInvitations|invitation|messag|normShares|contentcreation|Shares|reaction|Reaction|comment|Comment|relationships|memberRelationships|graphql/i.test(
    path,
  );
}

export async function runWriteCapture(config: EnvConfig, logger: Logger): Promise<void> {
  const engine = new BrowserEngine(config, logger);
  const captured: CapturedWrite[] = [];
  const observed: ObservedCall[] = [];

  try {
    const context = await engine.ensureContext();
    if (!(await engine.isLoggedIn())) {
      process.stderr.write('\n❌ Not logged in on this profile. Run --login first.\n');
      return;
    }

    // Passive observation of every voyager response (status diagnosis).
    context.on('response', (res) => {
      const p = shortPath(res.url());
      if (!p) return;
      const req = res.request();
      let queryId: string | undefined;
      try {
        queryId = new URL(res.url()).searchParams.get('queryId') ?? undefined;
      } catch {
        /* ignore */
      }
      observed.push({ method: req.method(), path: p, status: res.status(), queryId });
    });

    let currentLabel = 'unknown';
    // Intercept ALL voyager traffic. SAFETY-FIRST: abort EVERY POST (Voyager
    // queries are GET; a POST is a mutation), so no write can ever fire for real
    // — even an unrecognized mutation the SPA auto-issues on a diagnose nav. We
    // still record the writes we recognize for the payload catalog; the rest are
    // aborted-and-logged. Reads (GET) pass through untouched.
    await context.route('**/voyager/api/**', async (route: Route) => {
      const req = route.request();
      const p = shortPath(req.url());
      if (req.method() === 'POST') {
        if (p && looksLikeWrite(req.method(), p)) {
          captured.push({ label: currentLabel, method: req.method(), path: p, postData: req.postData() ?? undefined });
          process.stderr.write(`\n  🎯 [${currentLabel}] CAPTURED POST ${p}\n`);
          const pd = req.postData();
          if (pd) process.stderr.write(`     body: ${pd.length > 1500 ? pd.slice(0, 1500) + '…' : pd}\n`);
        } else {
          process.stderr.write(`\n  ⛔ [${currentLabel}] BLOCKED unrecognized POST ${p ?? req.url()}\n`);
        }
        await route.abort('failed'); // never actually send ANY write
        return;
      }
      await route.continue();
    });

    const page = await engine.getFeedPage();

    // ── create_post ─────────────────────────────────────────────────────────
    currentLabel = 'create_post';
    process.stderr.write('\n========== create_post ==========\n');
    await capturePost(page, logger);

    // ── react_to_post + comment_on_post (operate on first feed post) ─────────
    currentLabel = 'react_to_post';
    process.stderr.write('\n========== react_to_post ==========\n');
    await captureReaction(page, logger);

    currentLabel = 'comment_on_post';
    process.stderr.write('\n========== comment_on_post ==========\n');
    await captureComment(page, logger);

    // ── connect_with_person (target a well-known profile) ───────────────────
    currentLabel = 'connect_with_person';
    process.stderr.write('\n========== connect_with_person ==========\n');
    await captureConnect(page, logger);

    // ── send_message (target same profile's Message button) ─────────────────
    currentLabel = 'send_message';
    process.stderr.write('\n========== send_message ==========\n');
    await captureMessage(page, logger);

    // ── diagnose the 401 surfaces: let the SPA load them and watch statuses ──
    currentLabel = 'diagnose';
    for (const [name, url] of [
      ['JOBS', `${ORIGIN}/jobs/search/?keywords=engineer`],
      ['NOTIFICATIONS', `${ORIGIN}/notifications/`],
      ['MESSAGING', `${ORIGIN}/messaging/`],
    ] as const) {
      observed.length = 0;
      process.stderr.write(`\n========== diagnose ${name} (SPA self-call statuses) ==========\n`);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(4000);
      } catch (e) {
        process.stderr.write(`  (nav warn: ${e instanceof Error ? e.message : String(e)})\n`);
      }
      const rows = observed
        .filter((o) => /jobs|notification|messag|voyagerJobs|MessagingGraphQL/i.test(o.path))
        .slice(0, 12);
      for (const r of rows) {
        process.stderr.write(
          `  ${r.status} ${r.method} ${r.path.slice(0, 160)}${r.queryId ? `  [qid=${r.queryId}]` : ''}\n`,
        );
      }
      if (!rows.length) process.stderr.write('  (no matching calls captured)\n');
    }

    // ── summary ──────────────────────────────────────────────────────────────
    process.stderr.write('\n\n================= CAPTURED WRITES =================\n');
    if (!captured.length) {
      process.stderr.write('(none captured — UI selectors may need tuning; see per-section logs)\n');
    }
    for (const c of captured) {
      process.stderr.write(`\n[${c.label}] ${c.method} ${c.path}\n`);
      if (c.postData) process.stderr.write(`  body=${c.postData}\n`);
    }
    process.stderr.write('\n✅ Write capture complete (no writes were actually sent).\n');
  } catch (err) {
    process.stderr.write(`\n❌ writecapture failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  } finally {
    await engine.shutdown();
  }
}

/** Click "Start a post", type, and hit Post — the POST is intercepted+aborted. */
async function capturePost(page: Page, logger: Logger): Promise<void> {
  try {
    await page.goto(`${ORIGIN}/feed/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    // The composer trigger button on the feed.
    const trigger = page
      .locator('button:has-text("Start a post"), button.share-box-feed-entry__trigger')
      .first();
    await trigger.click({ timeout: 10000 });
    await page.waitForTimeout(2000);
    const editor = page.locator('div.ql-editor[contenteditable="true"], div[role="textbox"]').first();
    await editor.click({ timeout: 8000 });
    await editor.type('writecapture probe — DO NOT SEND', { delay: 10 });
    await page.waitForTimeout(1500);
    const postBtn = page
      .locator('button.share-actions__primary-action, button:has-text("Post")')
      .last();
    await postBtn.click({ timeout: 8000 });
    await page.waitForTimeout(2500);
  } catch (e) {
    logger.warn('capturePost UI step failed', { error: e instanceof Error ? e.message : String(e) });
    process.stderr.write(`  (capturePost: ${e instanceof Error ? e.message : String(e)})\n`);
  }
}

/** Click the first feed post's Like button — reaction POST intercepted. */
async function captureReaction(page: Page, logger: Logger): Promise<void> {
  try {
    await page.goto(`${ORIGIN}/feed/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const like = page.locator('button[aria-label*="React Like" i], button:has-text("Like")').first();
    await like.click({ timeout: 10000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    logger.warn('captureReaction failed', { error: e instanceof Error ? e.message : String(e) });
    process.stderr.write(`  (captureReaction: ${e instanceof Error ? e.message : String(e)})\n`);
  }
}

/** Open the first post's comment box, type, submit — comment POST intercepted. */
async function captureComment(page: Page, logger: Logger): Promise<void> {
  try {
    await page.goto(`${ORIGIN}/feed/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const commentBtn = page.locator('button[aria-label*="Comment" i]').first();
    await commentBtn.click({ timeout: 10000 });
    await page.waitForTimeout(1500);
    const box = page.locator('div.ql-editor[contenteditable="true"], div[role="textbox"]').first();
    await box.click({ timeout: 8000 });
    await box.type('writecapture probe', { delay: 10 });
    await page.waitForTimeout(1000);
    const submit = page.locator('button.comments-comment-box__submit-button, button:has-text("Post")').last();
    await submit.click({ timeout: 8000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    logger.warn('captureComment failed', { error: e instanceof Error ? e.message : String(e) });
    process.stderr.write(`  (captureComment: ${e instanceof Error ? e.message : String(e)})\n`);
  }
}

/** Visit a profile and click Connect — invite POST intercepted+aborted. */
async function captureConnect(page: Page, logger: Logger): Promise<void> {
  try {
    await page.goto(`${ORIGIN}/in/williamhgates/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    // Connect may be a top-card button or hidden under the "More" overflow.
    let connect = page.locator('button[aria-label*="Invite" i][aria-label*="connect" i], main button:has-text("Connect")').first();
    if (!(await connect.count())) {
      const more = page.locator('button[aria-label="More actions"], main button:has-text("More")').first();
      await more.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1000);
      connect = page.locator('div[aria-label*="connect" i], span:has-text("Connect")').first();
    }
    await connect.click({ timeout: 10000 });
    await page.waitForTimeout(1500);
    // The "Send without a note" button in the invite modal fires the invite.
    const send = page.locator('button[aria-label*="Send" i], button:has-text("Send")').first();
    await send.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
  } catch (e) {
    logger.warn('captureConnect failed', { error: e instanceof Error ? e.message : String(e) });
    process.stderr.write(`  (captureConnect: ${e instanceof Error ? e.message : String(e)})\n`);
  }
}

/** Visit a profile, click Message, type, send — message POST intercepted. */
async function captureMessage(page: Page, logger: Logger): Promise<void> {
  try {
    await page.goto(`${ORIGIN}/in/williamhgates/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const msgBtn = page.locator('main button:has-text("Message")').first();
    await msgBtn.click({ timeout: 10000 });
    await page.waitForTimeout(2000);
    const box = page.locator('div.msg-form__contenteditable[contenteditable="true"], div[role="textbox"]').first();
    await box.click({ timeout: 8000 });
    await box.type('writecapture probe', { delay: 10 });
    await page.waitForTimeout(1000);
    const send = page.locator('button.msg-form__send-button, button[type="submit"]:has-text("Send")').first();
    await send.click({ timeout: 8000 });
    await page.waitForTimeout(2000);
  } catch (e) {
    logger.warn('captureMessage failed', { error: e instanceof Error ? e.message : String(e) });
    process.stderr.write(`  (captureMessage: ${e instanceof Error ? e.message : String(e)})\n`);
  }
}
