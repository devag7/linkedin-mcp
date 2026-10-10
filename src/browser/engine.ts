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
 *  - One owned persistent context. Root-browser closure alone cannot certify
 *    that every detached or reparented native auxiliary exited.
 */

import * as fs from 'fs';
import { chromium, type BrowserContext, type Page } from 'patchright';
import type { Logger } from '../types.js';
import type { EnvConfig } from '../config/env.js';
import { BrowserSafety } from './safety.js';
import { CircuitBreaker } from '../safety/circuit-breaker.js';
import { StateLock, profilePath, canonicalPath, SafetyStateError } from '../safety/state-lock.js';
import { CircuitFileStorage, circuitStatePath } from '../safety/circuit-storage.js';

const FEED_URL = 'https://www.linkedin.com/feed/';
const ORIGIN = 'https://www.linkedin.com';

export class BrowserEngine {
  private context?: BrowserContext;
  private feedPage?: Page;
  private launching?: Promise<BrowserContext>;
  private idleTimer?: NodeJS.Timeout;
  private signalsWired = false;
  private disposed = false;
  private closing?: Promise<void>;
  private shutdownFailed = false;
  private ownership?: StateLock;
  private epoch = 0;
  private readonly resolvedProfile: string;

  constructor(
    private readonly config: EnvConfig,
    private readonly logger: Logger,
    private readonly manageSignals = true,
    readonly safety: BrowserSafety | null = new BrowserSafety(
      new CircuitBreaker({
        storage: new CircuitFileStorage(circuitStatePath(config.LINKEDIN_PROFILE_DIR)),
        logger,
      }),
    ),
  ) {
    this.resolvedProfile = profilePath(config.LINKEDIN_PROFILE_DIR);
  }

  /** Resolve the persistent profile directory (cookies + cf clearance live here). */
  private profileDir(): string {
    const dir = this.resolvedProfile;
    if (canonicalPath(dir) !== dir)
      throw new SafetyStateError(
        'STATE_INVALID',
        'Browser profile path changed. Stop automation and repair local state.',
      );
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }

  /**
   * Ensure a live browser context exists. Idempotent and concurrency-safe:
   * overlapping callers await the same in-flight launch.
   */
  async ensureContext(): Promise<BrowserContext> {
    if (this.disposed) throw new Error('Browser runtime is shutting down.');
    if (this.shutdownFailed)
      throw new SafetyStateError(
        'STATE_INVALID',
        'Browser shutdown failed. Stop automation and repair ownership.',
      );
    if (this.closing) await this.closing;
    if (this.disposed) throw new Error('Browser runtime is shutting down.');
    this.safety?.assertAllowed();
    if (this.context) {
      this.ownership?.assertOwned();
      return this.context;
    }
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
    this.ownership ??= new StateLock(`${userDataDir}.owner`, true);
    this.ownership.acquire();
    let context: BrowserContext;
    try {
      // A previous owner may have persisted a stop after runtime construction.
      this.safety?.breaker.refresh();
      this.safety?.assertAllowed();
      this.logger.info('Launching browser', { headless: this.config.LINKEDIN_HEADLESS });
      context = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: this.config.LINKEDIN_HEADLESS,
        viewport: null,
        executablePath: this.config.LINKEDIN_CHROME_PATH || undefined,
        args: ['--disable-blink-features=AutomationControlled'],
      });
    } catch (error) {
      if (this.epoch === 0) this.ownership.release();
      throw error;
    }
    this.epoch++;
    if (this.manageSignals) this.wireSignals();
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
      this.feedPage = context.pages().find((p) => !p.isClosed()) ?? (await context.newPage());
    }

    if (this.safety) await this.safety.inspectPage(this.feedPage);
    if (!this.feedPage.url().startsWith(`${ORIGIN}/`)) {
      const response = await this.feedPage.goto(FEED_URL, { waitUntil: 'domcontentloaded' });
      if (this.safety) await this.safety.inspectPage(this.feedPage, response?.status());
    }
    return this.feedPage;
  }

  /** A fresh short-lived page for DOM-fallback work. Caller must close it. */
  async newPage(): Promise<Page> {
    const context = await this.ensureContext();
    this.bumpIdleTimer();
    return context.newPage();
  }

  /** Inspect a DOM fallback before extracting content or trying another request. */
  async assertPageSafe(page: Page, status?: number): Promise<void> {
    if (this.safety) await this.safety.inspectPage(page, status);
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

  /** Close context/browser; native descendant cleanup requires separate proof. */
  async shutdown(): Promise<void> {
    if (this.shutdownFailed)
      throw new SafetyStateError(
        'STATE_INVALID',
        'Browser shutdown failed. Ownership remains locked; stop the browser and repair the lock manually.',
      );
    if (this.closing) return this.closing;
    this.closing = this.closeContext();
    try {
      await this.closing;
    } finally {
      this.closing = undefined;
    }
  }

  private async closeContext(): Promise<void> {
    // A listener can stop while Chrome is still launching. Reap that context too.
    if (this.launching) await this.launching.catch(() => undefined);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    const context = this.context;
    this.context = undefined;
    this.feedPage = undefined;
    if (!context) return;

    // For a persistent context, closing the context closes its browser. We also
    // close the Browser handle explicitly as belt-and-suspenders against the
    // competitor's zombie-Chrome leak.
    const browser = context.browser();
    let closeTimer: NodeJS.Timeout | undefined;
    let closed = false;
    try {
      await Promise.race([
        context.close().then(() => {
          closed = true;
        }),
        new Promise((r) => {
          closeTimer = setTimeout(r, 5000);
        }),
      ]);
    } catch {
      this.logger.warn('Error during context close');
    } finally {
      if (closeTimer) clearTimeout(closeTimer);
    }
    try {
      if (browser) {
        await browser.close();
        closed = true;
      }
    } catch {
      /* A successful context close is sufficient even if its browser is gone. */
    }
    if (!closed) {
      this.shutdownFailed = true;
      throw new SafetyStateError(
        'STATE_INVALID',
        'Browser shutdown could not be verified. Ownership remains locked; stop the browser and repair the lock manually.',
      );
    }
  }

  get hasActiveContext(): boolean {
    return !!this.context;
  }

  /** Changes on every browser launch; identity must be reverified for a new session. */
  get sessionEpoch(): number {
    return this.epoch;
  }

  /** Final process-owned shutdown; queued work must not relaunch Chrome. */
  async dispose(): Promise<void> {
    this.disposed = true;
    await this.shutdown();
    this.ownership?.release();
  }

  private wireSignals(): void {
    if (this.signalsWired) return;
    this.signalsWired = true;
    const close = () => {
      void this.dispose().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    process.once('SIGHUP', close);
    process.once('beforeExit', () => void this.dispose());
  }
}
