/**
 * In-page Voyager client — the core of the v2 architecture.
 *
 * Instead of a stateless Node `fetch` (which Cloudflare 302-loops forever), we
 * run the `fetch` INSIDE the challenge-cleared, authenticated LinkedIn tab via
 * `page.evaluate`. Because the call originates from https://www.linkedin.com to
 * https://www.linkedin.com/voyager/api/... it is SAME-ORIGIN — no CORS, no
 * preflight — the identical network path LinkedIn's own SPA uses. The browser
 * auto-attaches __cf_bm + li_at + JSESSIONID with the genuine in-browser
 * fingerprint, so Voyager returns structured normalized JSON.
 *
 * Redirect strategy: `redirect:'manual'`. A logged-in, challenge-passed request
 * returns 200 directly. A 302 self-redirect (the Cloudflare/auth loop) surfaces
 * as an opaque redirect (`type:'opaqueredirect'`, `status:0`) which we classify
 * as AUTH_REQUIRED rather than following into an infinite loop.
 */

import type { Page } from 'patchright';
import type { BrowserEngine } from './engine.js';
import type { Logger } from '../types.js';

export type VoyagerErrorCode =
  | 'AUTH_REQUIRED'
  | 'CLOUDFLARE_BLOCKED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'HTTP_ERROR'
  | 'PARSE_ERROR';

export class VoyagerError extends Error {
  constructor(
    public readonly code: VoyagerErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'VoyagerError';
  }
}

/** Raw result of an in-page fetch, marshalled back to Node. */
interface RawFetchResult {
  status: number;
  ok: boolean;
  type: string;
  url: string;
  body: string;
}

const NORMALIZED_ACCEPT = 'application/vnd.linkedin.normalized+json+2.1';
const X_LI_TRACK = JSON.stringify({
  clientVersion: '1.13.0',
  mpVersion: '1.13.0',
  osName: 'web',
  timezoneOffset: 0,
  deviceFormFactor: 'DESKTOP',
  mpName: 'voyager-web',
});

export class VoyagerClient {
  constructor(
    private readonly engine: BrowserEngine,
    private readonly logger: Logger,
  ) {}

  /**
   * GET a Voyager REST-li endpoint, e.g. voyagerGet('/me') or
   * voyagerGet('/identity/profiles/<id>/profileView'). Returns parsed JSON.
   */
  async voyagerGet<T = unknown>(apiPath: string): Promise<T> {
    const page = await this.engine.getFeedPage();
    const url = `/voyager/api${apiPath}`;
    const raw = await this.inPageFetch(page, url, 'GET');
    return this.handle<T>(raw, apiPath);
  }

  /**
   * POST to a Voyager REST-li endpoint with a JSON body.
   */
  async voyagerPost<T = unknown>(apiPath: string, body: unknown): Promise<T> {
    const page = await this.engine.getFeedPage();
    const url = `/voyager/api${apiPath}`;
    const raw = await this.inPageFetch(page, url, 'POST', body);
    return this.handle<T>(raw, apiPath);
  }

  /**
   * Query a Voyager GraphQL endpoint by queryId + variables.
   * queryIds rotate — callers should source them from endpoints.ts, never hardcode.
   */
  async voyagerGraphql<T = unknown>(
    queryId: string,
    variables: string,
  ): Promise<T> {
    const page = await this.engine.getFeedPage();
    const url = `/voyager/api/graphql?queryId=${encodeURIComponent(queryId)}&variables=${variables}`;
    const raw = await this.inPageFetch(page, url, 'GET');
    return this.handle<T>(raw, url);
  }

  /** Execute the fetch inside the page's JS context. */
  private async inPageFetch(
    page: Page,
    url: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<RawFetchResult> {
    return page.evaluate(
      async ({ url, method, body, accept, track }) => {
        // CSRF token must equal the JSESSIONID cookie value (quotes stripped).
        const m = document.cookie.match(/JSESSIONID="?([^";]+)"?/);
        const csrf = m ? m[1] : '';
        const headers: Record<string, string> = {
          accept,
          'csrf-token': csrf,
          'x-restli-protocol-version': '2.0.0',
          'x-li-lang': 'en_US',
          'x-li-track': track,
        };
        if (body != null) headers['content-type'] = 'application/json';

        const res = await fetch(url, {
          method,
          headers,
          credentials: 'include',
          redirect: 'manual',
          body: body != null ? JSON.stringify(body) : undefined,
        });
        // opaqueredirect bodies are unreadable; guard the .text() call.
        let text = '';
        try {
          text = await res.text();
        } catch {
          text = '';
        }
        return {
          status: res.status,
          ok: res.ok,
          type: res.type,
          url: res.url,
          body: text,
        };
      },
      { url, method, body: body ?? null, accept: NORMALIZED_ACCEPT, track: X_LI_TRACK },
    );
  }

  /** Classify the raw result and parse JSON, or throw a typed VoyagerError. */
  private handle<T>(raw: RawFetchResult, ctx: string): T {
    // Opaque redirect / status 0 == the 302 auth/Cloudflare loop.
    if (raw.type === 'opaqueredirect' || raw.status === 0) {
      throw new VoyagerError(
        'AUTH_REQUIRED',
        `Voyager redirected (not authenticated or Cloudflare challenge) for ${ctx}. Run --login.`,
        302,
      );
    }
    if (raw.status === 401 || raw.status === 403) {
      throw new VoyagerError(
        'AUTH_REQUIRED',
        `LinkedIn rejected the request (${raw.status}) for ${ctx}. Session may have expired — run --login.`,
        raw.status,
      );
    }
    if (raw.status === 429) {
      throw new VoyagerError('RATE_LIMITED', `Rate limited by LinkedIn for ${ctx}.`, 429);
    }
    if (raw.status === 404) {
      throw new VoyagerError('NOT_FOUND', `Not found: ${ctx}.`, 404);
    }
    // A JSON endpoint returning HTML == a Cloudflare/interstitial page.
    const trimmed = raw.body.trimStart();
    if (trimmed.startsWith('<')) {
      throw new VoyagerError(
        'CLOUDFLARE_BLOCKED',
        `Expected JSON but got HTML for ${ctx} — likely a Cloudflare challenge. Try --login (headful) on a clean IP.`,
        raw.status,
      );
    }
    if (!raw.ok) {
      throw new VoyagerError('HTTP_ERROR', `HTTP ${raw.status} for ${ctx}.`, raw.status);
    }
    try {
      return JSON.parse(raw.body) as T;
    } catch {
      throw new VoyagerError('PARSE_ERROR', `Failed to parse JSON for ${ctx}.`, raw.status);
    }
  }
}
