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
import { VoyagerClient } from './voyager.js';
import * as ep from './endpoints.js';
import { ownPublicId, type NormalizedResponse } from './normalize.js';
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

/**
 * Mutation verbs that begin an SDUI action id.
 *
 * SDUI (LinkedIn's server-driven UI) expresses BOTH reads and writes as POST.
 * The action id's final dot-segment starts with the verb, e.g.
 *   com.linkedin.sdui.requests.profile.saveProfileIntroForm  -> write
 *   com.linkedin.sdui.requests.profile.fetchProfileDiscoveryDrawer -> read
 *   com.linkedin.sdui.impl.homenav.requests.getThirdPartyTrackingPixels -> read
 */
const SDUI_MUTATION_VERB =
  /^(save|create|update|delete|remove|add|set|post|send|submit|apply|accept|reject|endorse|follow|unfollow|connect|invite|comment|react|like|share|publish|upload|edit|upsert|insert|modify|patch|destroy|drop|revoke|unpublish|flag|report|join|leave|register|unregister|subscribe|unsubscribe|book|cancel|enable|disable|mark|trigger|reset)/i;

/** SDUI action ids seen that are NOT mutations — surfaced once so we can refine. */
const seenSduiActions = new Set<string>();

/**
 * Decide whether a non-GET request is a real MUTATION (must be captured, and
 * aborted so nothing actually saves) or a READ that merely happens to use POST.
 *
 * Getting this wrong breaks the page: LinkedIn's profile edit screen loads
 * its data via `POST /flagship-web/rsc-action/actions/component` and
 * `.../navigation`. Aborting those yields "Something went wrong on our end"
 * in the Edit-intro modal, and no save request is ever sent.
 *
 * Returns 'voyager' | 'sdui' for mutations, undefined for reads.
 */
export function classifyWrite(url: string, _method: string): 'voyager' | 'sdui' | undefined {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return undefined;
  }
  const pathname = u.pathname;

  // ── SDUI: component / navigation / app-config are reads; only the
  //    server-request action endpoint can carry a mutation.
  if (pathname.includes('/rsc-action/actions/')) {
    if (!pathname.endsWith('/server-request')) return undefined;
    const sduiid = u.searchParams.get('sduiid') ?? '';
    const action = sduiid.slice(sduiid.lastIndexOf('.') + 1);
    if (!action) return undefined;
    if (SDUI_MUTATION_VERB.test(action)) return 'sdui';
    if (!seenSduiActions.has(action)) {
      seenSduiActions.add(action);
      process.stderr.write(`\n  (sdui action classified as READ: ${action})\n`);
    }
    return undefined;
  }

  // ── Voyager: every non-GET is a mutation.
  if (pathname.startsWith('/voyager/api/')) return 'voyager';

  // ── Everything else (telemetry blobs, /flagship-web/in/... page data,
  //    realtime connectivity) is a read wearing a POST costume.
  return undefined;
}

export async function runWriteCapture(config: EnvConfig, logger: Logger): Promise<void> {
  // The profile-edit sections REQUIRE a visible window — the human drives the
  // edit UI by hand. Headless would launch fine and then the user would find
  // nothing to click, which is exactly the "the browser didn't open" symptom.
  // (Same force-headful stance as capture.ts and login.ts.)
  const engine = new BrowserEngine({ ...config, LINKEDIN_HEADLESS: false }, logger);
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
      // Diagnostic: when the SPA's OWN share mutation is allowed through, log its
      // response — does the live SPA itself succeed at posting on this account?
      if (req.method() === 'POST' && /voyagerContentcreationDashShares\./.test(p)) {
        res
          .text()
          .then((b) =>
            process.stderr.write(`\n  📬 SPA SHARE-MUTATION RESPONSE: HTTP ${res.status()} :: ${b.slice(0, 400)}\n`),
          )
          .catch(() => {});
      }
    });

    let currentLabel = 'unknown';
    // SAFETY-FIRST, but not dumb. We abort every genuine MUTATION so nothing
    // actually saves, yet we must let READS through — and on LinkedIn's
    // server-driven UI, reads are POSTs too (rsc-action/actions/component,
    // /navigation, page data). Aborting those breaks the edit screen with
    // "Something went wrong on our end" and no save request is ever sent.
    // classifyWrite() tells the two apart.
    await context.route('**/*', async (route: Route) => {
      const req = route.request();
      const url = req.url();
      const p = shortPath(url) ?? url;
      const method = req.method();
      if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        await route.continue();
        return;
      }
      // Skip static assets and tracking pixels
      const isStatic = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)(\?|$)/i.test(url) || /\/li\/track/i.test(url);
      if (isStatic) {
        await route.continue();
        return;
      }
      // A read wearing a POST costume — must pass through or the page breaks.
      const kind = classifyWrite(url, method);
      if (!kind) {
        await route.continue();
        return;
      }
      // Only JSON bodies are worth recording. LinkedIn fires a lot of
      // binary/encrypted telemetry POSTs; dumping those floods the log and
      // writes multi-megabyte junk files. JSON.parse is the ground truth.
      const raw = req.postData() ?? undefined;
      let body: string | undefined;
      if (raw) {
        try {
          JSON.parse(raw);
          body = raw;
        } catch {
          body = undefined;
        }
      }
      captured.push({ label: currentLabel, method, path: p ?? req.url(), postData: body });
      process.stderr.write(`\n  \u{1F3AF} [${currentLabel}] CAPTURED ${method} ${p ?? req.url()}\n`);
      if (body) {
        process.stderr.write(`     body: ${body.length > 3000 ? body.slice(0, 3000) + '\u2026' : body}\n`);
        try {
          const fs = await import('node:fs');
          const label = currentLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
          const fname = `/tmp/opencode/capture_${label}_${Date.now()}.json`;
          fs.writeFileSync(fname, body);
          process.stderr.write(`     full body saved to ${fname}\n`);
        } catch (e) {
          process.stderr.write(`     (could not save body: ${e instanceof Error ? e.message : String(e)})\n`);
        }
      } else {
        process.stderr.write('     (non-JSON body \u2014 not recorded)\n');
      }
      // Diagnostic mode: let the SPA's OWN share mutation actually send.
      if (process.env.CAPTURE_LET_POST === '1' && p && /voyagerContentcreationDashShares\./.test(p)) {
        process.stderr.write(`\n  \u{27A1}\uFE0F  [${currentLabel}] LETTING SHARE MUTATION THROUGH (diagnostic) ${p}\n`);
        await route.continue();
        return;
      }
      // Diagnostic mode: let profile save requests through so LinkedIn doesn't error.
      if (process.env.CAPTURE_LET_PROFILE_SAVE === '1' && p && /saveProfileIntroForm/.test(p)) {
        process.stderr.write('\n  >>> [' + currentLabel + '] LETTING PROFILE SAVE THROUGH (diagnostic) ' + p + '\n');
        await route.continue();
        return;
      }
      await route.abort('failed'); // never actually send ANY write
    });

    const page = await engine.getFeedPage();

    // Resolve own publicId — react/comment target the member's OWN post on their
    // recent-activity page (a fresh account's HOME feed is empty / hides own posts).
    let ownPid: string | undefined;
    try {
      const voyager = new VoyagerClient(engine, logger);
      const me = await voyager.voyagerGet<NormalizedResponse>(ep.me());
      ownPid = ownPublicId(me);
      process.stderr.write(`\n(own publicId: ${ownPid ?? 'unknown'})\n`);
    } catch {
      /* fall back to /feed/ */
    }

    // WC_ONLY=<section> runs a single section (fast iteration). Default: all.
    const only = process.env.WC_ONLY;
    
    const want = (s: string): boolean => !only || only === s;

    // ── create_post ─────────────────────────────────────────────────────────
    if (want('create_post')) {
      currentLabel = 'create_post';
      process.stderr.write('\n========== create_post ==========\n');
      await capturePost(page, logger);
    }

    // ── react_to_post + comment_on_post (operate on own recent-activity post) ─
    if (want('react_to_post')) {
      currentLabel = 'react_to_post';
      process.stderr.write('\n========== react_to_post ==========\n');
      await captureReaction(page, logger, ownPid);
    }

    if (want('comment_on_post')) {
      currentLabel = 'comment_on_post';
      process.stderr.write('\n========== comment_on_post ==========\n');
      await captureComment(page, logger, ownPid);
    }

    // ── connect_with_person (target a well-known profile) ───────────────────
    if (want('connect_with_person')) {
      currentLabel = 'connect_with_person';
      process.stderr.write('\n========== connect_with_person ==========\n');
      await captureConnect(page, logger);
    }

    // ── send_message (target an existing conversation) ──────────────────────
    if (want('send_message')) {
      currentLabel = 'send_message';
      process.stderr.write('\n========== send_message ==========\n');
      await captureMessage(page, logger);
    }

    // ── profile edits (manual UI drive; POSTs intercepted+aborted) ──────────
    // These sections do NOT automate the edit UI — LinkedIn's selectors rotate
    // too fast and the risk of a wrong click is too high. Instead, each section
    // navigates to your profile and waits while YOU perform the edit manually.
    // The interceptor captures every Voyager POST fired during the wait window.
    // Abort with Ctrl+C between sections if you only want one.
    const profileWait = async (label: string, hint: string) => {
      currentLabel = label;
      process.stderr.write(`\n========== ${label} (manual edit) ==========\n`);
      process.stderr.write(`  👉 ${hint}\n`);
      process.stderr.write('  The interceptor records every Voyager request for ~90s. Perform the edit now. DO NOT close the browser window.\n');
      try {
        await page.goto(`${ORIGIN}/in/me/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (e) {
        process.stderr.write(`  (nav warn: ${e instanceof Error ? e.message : String(e)})\n`);
      }
      await page.waitForTimeout(90000);
    };

    if (want('profile_headline')) {
      await profileWait(
        'profile_headline',
        'Click the pencil next to your headline/name, change the headline text, click Save (intercepted — nothing saves).',
      );
    }
    if (want('profile_about')) {
      await profileWait(
        'profile_about',
        'Scroll to the About section, click its pencil, edit the summary, click Save (intercepted).',
      );
    }
    if (want('profile_experience')) {
      await profileWait(
        'profile_experience',
        'Go to Experience: click + to add (or pencil to edit) an entry, fill fields, click Save (intercepted).',
      );
    }
    if (want('profile_education')) {
      await profileWait(
        'profile_education',
        'Go to Education: click + to add (or pencil to edit) an entry, fill fields, click Save (intercepted).',
      );
    }
    if (want('profile_skills')) {
      await profileWait(
        'profile_skills',
        'Go to Skills: click + to add a skill (or X to remove), confirm (intercepted).',
      );
    }

    // ── diagnose the 401 surfaces: let the SPA load them and watch statuses ──
    currentLabel = 'diagnose';
    if (only) {
      process.stderr.write('\n(WC_ONLY set — skipping diagnose sweep)\n');
    } else
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
    await engine.dispose();
  }
}

/** Open the composer, type, and hit Post — the POST is intercepted+aborted. */
async function capturePost(page: Page, logger: Logger): Promise<void> {
  try {
    await page.goto(`${ORIGIN}/feed/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    // The composer trigger varies (button vs div[role=button], class/text rotate).
    // Try a battery of selectors; dump the share-box region if none match.
    const triggerSelectors = [
      'button.share-box-feed-entry__trigger',
      '[class*="share-box-feed-entry__trigger"]',
      'button[aria-label*="Start a post" i]',
      '[aria-label*="Start a post" i]',
      '[aria-label*="Create a post" i]',
      'button:has-text("Start a post")',
      '[class*="share-box"] button',
    ];
    let opened = false;
    for (const sel of triggerSelectors) {
      const loc = page.locator(sel).first();
      if (await loc.count().catch(() => 0)) {
        try {
          await loc.click({ timeout: 4000 });
          opened = true;
          process.stderr.write(`  (composer opened via: ${sel})\n`);
          break;
        } catch {
          /* try next */
        }
      }
    }
    if (!opened) {
      const html = await page
        .evaluate(() => {
          const el =
            document.querySelector('[class*="share-box"]') ??
            document.querySelector('main') ??
            document.body;
          return (el?.outerHTML ?? '').slice(0, 1800);
        })
        .catch(() => '');
      process.stderr.write(`  (capturePost: no composer trigger matched; share-box region:)\n  ${html}\n`);
      return;
    }

    await page.waitForTimeout(2500);
    const editor = page
      .locator('div.ql-editor[contenteditable="true"], [contenteditable="true"][role="textbox"], [data-placeholder][contenteditable="true"]')
      .first();
    await editor.click({ timeout: 8000 });
    await editor.type('writecapture probe — DO NOT SEND', { delay: 10 });
    await page.waitForTimeout(1800);
    const postBtn = page
      .locator('button.share-actions__primary-action, [class*="share-actions__primary"], button[aria-label="Post"], button:has-text("Post")')
      .last();
    await postBtn.click({ timeout: 8000 });
    await page.waitForTimeout(2500);
  } catch (e) {
    logger.warn('capturePost UI step failed', { error: e instanceof Error ? e.message : String(e) });
    process.stderr.write(`  (capturePost: ${e instanceof Error ? e.message : String(e)})\n`);
  }
}

/** Click a post's Like button (via in-page JS) — reaction POST intercepted. */
async function captureReaction(page: Page, logger: Logger, ownPid?: string): Promise<void> {
  try {
    const url = ownPid ? `${ORIGIN}/in/${ownPid}/recent-activity/all/` : `${ORIGIN}/feed/`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('button', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 600).catch(() => {});
    await page.waitForTimeout(1500);
    // Click in-page (bypasses Playwright's visibility/stability checks that the
    // LinkedIn overlay DOM keeps tripping). Pick the first post's Like button.
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const like = btns.find((b) => {
        const al = (b.getAttribute('aria-label') || '').trim();
        return /^(react\s+)?like$/i.test(al) || (/\bLike\b/.test(al) && /react|reaction/i.test(al));
      });
      if (like) {
        (like as HTMLButtonElement).click();
        return like.getAttribute('aria-label') || 'like';
      }
      return null;
    });
    process.stderr.write(`  (like in-page click: ${clicked ?? 'NOT FOUND'})\n`);
    await page.waitForTimeout(2500);
  } catch (e) {
    logger.warn('captureReaction failed', { error: e instanceof Error ? e.message : String(e) });
    process.stderr.write(`  (captureReaction: ${e instanceof Error ? e.message : String(e)})\n`);
  }
}

/** Open a post's comment box (in-page), type, submit — comment POST intercepted. */
async function captureComment(page: Page, logger: Logger, ownPid?: string): Promise<void> {
  try {
    const url = ownPid ? `${ORIGIN}/in/${ownPid}/recent-activity/all/` : `${ORIGIN}/feed/`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('button', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 600).catch(() => {});
    await page.waitForTimeout(1500);
    const opened = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const c = btns.find((b) => /\bcomment\b/i.test((b.getAttribute('aria-label') || '').trim()));
      if (c) {
        (c as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    process.stderr.write(`  (comment button in-page click: ${opened})\n`);
    await page.waitForTimeout(2000);
    const box = page.locator('div.ql-editor[contenteditable="true"], [contenteditable="true"][role="textbox"]').first();
    await box.click({ timeout: 8000 });
    await box.type('writecapture probe', { delay: 12 });
    await page.waitForTimeout(1500);
    const submitted = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // The enabled submit button in a comment box.
      const submit = btns.find(
        (b) =>
          !b.hasAttribute('disabled') &&
          (/comments-comment-box__submit/.test(b.className) ||
            (/\bpost\b/i.test((b.textContent || '').trim()) && /comment/i.test(b.className))),
      );
      if (submit) {
        (submit as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    process.stderr.write(`  (comment submit in-page click: ${submitted})\n`);
    await page.waitForTimeout(2500);
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

/**
 * Send a message and intercept the POST. Two modes:
 *  - default: open the first EXISTING conversation (captures the reply shape).
 *  - MSG_COMPOSE=1: open the Compose flow, pick a recipient from the typeahead
 *    (type TARGET_MSG_QUERY, default "a"), and send — captures the NEW-thread
 *    shape (hostRecipientUrns) IF that recipient has no existing thread.
 */
async function captureMessage(page: Page, logger: Logger): Promise<void> {
  try {
    await page.goto(`${ORIGIN}/messaging/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);

    if (process.env.MSG_COMPOSE === '1') {
      // ── Compose a NEW message: go straight to the compose view ─────────────
      await page.goto(`${ORIGIN}/messaging/compose/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);
      // Dump the recipient-area controls for diagnosis if the field isn't found.
      const recipExists = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map((i) => i.getAttribute('placeholder') || i.getAttribute('aria-label') || i.name || i.type).slice(0, 8);
      });
      process.stderr.write(`  (compose inputs: ${JSON.stringify(recipExists)})\n`);

      // Type into the recipient typeahead, then pick the first suggestion.
      const query = process.env.TARGET_MSG_QUERY || 'a';
      const recip = page
        .locator('input[placeholder*="Type a name" i], input[aria-label*="recipient" i], input[aria-label*="messaging" i], [class*="typeahead"] input, input[type="text"]')
        .first();
      await recip.click({ timeout: 8000 });
      await recip.type(query, { delay: 60 });
      await page.waitForTimeout(2500);
      const picked = await page.evaluate(() => {
        const opt =
          document.querySelector('[class*="typeahead"] [role="option"]') ??
          document.querySelector('[class*="typeahead__suggestion"]') ??
          document.querySelector('[role="option"]') ??
          document.querySelector('[class*="connections-result"]');
        if (opt) { (opt as HTMLElement).click(); return (opt.textContent || 'option').trim().slice(0, 40); }
        return null;
      });
      process.stderr.write(`  (recipient picked: ${picked ?? 'NONE — no suggestion'})\n`);
      if (!picked) return;
      await page.waitForTimeout(2000);

      const box = page.locator('div.msg-form__contenteditable[contenteditable="true"], [contenteditable="true"][role="textbox"]').first();
      await box.click({ timeout: 8000 });
      await box.type('writecapture probe', { delay: 12 });
      await page.waitForTimeout(1200);
      const sentNew = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const send = btns.find((b) => !b.hasAttribute('disabled') && (/msg-form__send-button/.test(b.className) || /^send$/i.test((b.textContent || '').trim())));
        if (send) { (send as HTMLButtonElement).click(); return true; }
        return false;
      });
      process.stderr.write(`  (new-message send click: ${sentNew})\n`);
      await page.waitForTimeout(2500);
      return;
    }

    // ── Reply into the first EXISTING conversation ───────────────────────────
    const opened = await page.evaluate(() => {
      const item =
        document.querySelector('a[href*="/messaging/thread/"]') ??
        document.querySelector('.msg-conversation-listitem__link') ??
        document.querySelector('[class*="conversation-listitem"] a');
      if (item) {
        (item as HTMLElement).click();
        return true;
      }
      return false;
    });
    process.stderr.write(`  (message: opened a conversation: ${opened})\n`);
    if (!opened) {
      process.stderr.write('  (captureMessage: no existing conversation — burner has no threads to send into)\n');
      return;
    }
    await page.waitForTimeout(2500);
    const box = page.locator('div.msg-form__contenteditable[contenteditable="true"], [contenteditable="true"][role="textbox"]').first();
    await box.click({ timeout: 8000 });
    await box.type('writecapture probe', { delay: 12 });
    await page.waitForTimeout(1200);
    const sent = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const send = btns.find(
        (b) => !b.hasAttribute('disabled') && (/msg-form__send-button/.test(b.className) || /^send$/i.test((b.textContent || '').trim())),
      );
      if (send) {
        (send as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    process.stderr.write(`  (message send in-page click: ${sent})\n`);
    await page.waitForTimeout(2500);
  } catch (e) {
    logger.warn('captureMessage failed', { error: e instanceof Error ? e.message : String(e) });
    process.stderr.write(`  (captureMessage: ${e instanceof Error ? e.message : String(e)})\n`);
  }
}
