/**
 * BrowserEngine — the v2 stealth data layer.
 *
 * Drives a real Chrome via patchright (an undetected Playwright fork) so that
 * Cloudflare's bot-management JS challenge is executed with a genuine browser
 * TLS/JS fingerprint. Once a page has cleared the challenge, LinkedIn's own
 * Voyager API can be queried via an in-page `fetch` (see voyager.ts) — the same
 * network path the LinkedIn SPA uses — returning structured JSON rather than
 * scraped DOM text.
 *
 * Design decisions (locked — do not "optimize" away):
 *  - ONE persistent BrowserContext per process, reused across all tool calls.
 *    Relaunch resumes an already-authenticated, already-challenge-passed profile.
 *  - patchright max-stealth recipe: channel 'chrome', viewport null, NO custom
 *    userAgent, NO extra fingerprint args, NO navigator.webdriver patching,
 *    NO stealth initScripts. patchright IS the anti-detection layer.
 *  - Singleton guarded by an in-flight launch mutex (idempotent ensureContext).
 *  - Exactly one browser process, reaped on shutdown — fixes the competitor's
 *    zombie chrome-headless leak.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { chromium, type BrowserContext, type Page } from 'patchright';
import type { Logger } from '../types.js';
import type { EnvConfig } from '../config/env.js';

const FEED_URL = 'https://www.linkedin.com/feed/';
const ORIGIN = 'https://www.linkedin.com';

export class BrowserEngine {
  private context?: BrowserContext;
  private feedPage?: Page;
  private launching?: Promise<BrowserContext>;
  private idleTimer?: NodeJS.Timeout;
  private signalsWired = false;

  constructor(
    private readonly config: EnvConfig,
    private readonly logger: Logger,
  ) {}

  /** Resolve the persistent profile directory (cookies + cf clearance live here). */
  private profileDir(): string {
    const dir =
      this.config.LINKEDIN_PROFILE_DIR ||
      path.join(os.homedir(), '.linkedin-mcp', 'profile');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }

  /**
   * Ensure a live browser context exists. Idempotent and concurrency-safe:
   * overlapping callers await the same in-flight launch.
   */
  async ensureContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    if (this.launching) return this.launching;

    this.launching = this.launch();
    try {
      this.context = await this.launching;
      return this.context;
    } finally {
      this.launching = undefined;
    }
  }

  private async launch(): Promise<BrowserContext> {
    const userDataDir = this.profileDir();
    this.logger.info('Launching browser', {
      headless: this.config.LINKEDIN_HEADLESS,
      userDataDir,
    });

    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chrome',
      headless: this.config.LINKEDIN_HEADLESS,
      viewport: null,
      executablePath: this.config.LINKEDIN_CHROME_PATH || undefined,
      // Block heavy media to cut bandwidth/latency; never touch fingerprint args.
      args: ['--disable-blink-features=AutomationControlled'],
    });

    this.wireSignals();
    this.bumpIdleTimer();
    return context;
  }

  /**
   * Return the long-lived "fetch host" tab, pinned to /feed/. Re-asserts origin
   * so in-page fetches are same-origin with a live JSESSIONID cookie.
   */
  async getFeedPage(): Promise<Page> {
    const context = await this.ensureContext();
    this.bumpIdleTimer();

    if (!this.feedPage || this.feedPage.isClosed()) {
      this.feedPage =
        context.pages().find((p) => !p.isClosed()) ?? (await context.newPage());
    }

    if (!this.feedPage.url().startsWith(ORIGIN)) {
      await this.feedPage.goto(FEED_URL, { waitUntil: 'domcontentloaded' });
    }
    return this.feedPage;
  }

  /** A fresh short-lived page for DOM-fallback work. Caller must close it. */
  async newPage(): Promise<Page> {
    const context = await this.ensureContext();
    this.bumpIdleTimer();
    return context.newPage();
  }

  /**
   * Logged-in check: presence of the li_at session cookie on linkedin.com.
   * Does not navigate — cheap to call.
   */
  async isLoggedIn(): Promise<boolean> {
    if (!this.context) return false;
    const cookies = await this.context.cookies(ORIGIN);
    return cookies.some((c) => c.name === 'li_at' && !!c.value);
  }

  private bumpIdleTimer(): void {
    const ms = this.config.LINKEDIN_IDLE_TIMEOUT_MS;
    if (!ms) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.logger.info('Idle timeout reached, closing browser');
      void this.shutdown();
    }, ms);
    this.idleTimer.unref?.();
  }

  /** Close the context and guarantee the Chrome process is gone (zombie reap). */
  async shutdown(): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    const context = this.context;
    this.context = undefined;
    this.feedPage = undefined;
    if (!context) return;

    const proc = context.browser()?.process();
    const pid = proc?.pid;
    try {
      await Promise.race([
        context.close(),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    } catch (err) {
      this.logger.warn('Error during context close', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    // Force-kill if the process survived the graceful close.
    if (pid) {
      try {
        process.kill(pid, 0); // throws if already dead
        process.kill(pid, 'SIGKILL');
        this.logger.warn('Force-killed surviving Chrome process', { pid });
      } catch {
        /* already dead — good */
      }
    }
  }

  private wireSignals(): void {
    if (this.signalsWired) return;
    this.signalsWired = true;
    const close = () => {
      void this.shutdown().finally(() => process.exit(0));
    };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    process.once('SIGHUP', close);
    process.once('beforeExit', () => void this.shutdown());
  }
}
