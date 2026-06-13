/**
 * LinkedIn HTTP Client
 *
 * Core HTTP client for making requests to LinkedIn's APIs.
 * Features:
 * - Automatic rate limiting
 * - Response caching
 * - Retry with exponential backoff
 * - Cookie jar for Cloudflare bot-management bounces
 * - Structured error handling
 * - Voyager response parsing
 */

import type { Logger } from '../types.js';
import { AuthManager, AuthError } from '../auth/manager.js';
import { RateLimiter } from '../middleware/rate-limiter.js';
import { Cache } from '../middleware/cache.js';
import type { LinkedInApiResponse } from './types.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Maximum number of redirect bounces to follow per request */
const MAX_REDIRECTS = 5;

export interface LinkedInClientConfig {
  rateLimitRpm: number;
  cacheTtlSeconds: number;
  requestTimeoutMs: number;
  maxRetries: number;
}

export interface RequestOptions {
  /** Skip cache and fetch fresh data */
  skipCache?: boolean;
  /** Custom cache TTL for this request */
  cacheTtl?: number;
  /** Skip rate limiting (for critical requests) */
  skipRateLimit?: boolean;
  /** Custom headers to add */
  headers?: Record<string, string>;
  /** Request body for POST/PUT */
  body?: unknown;
  /** HTTP method (default: GET) */
  method?: string;
}

/**
 * LinkedIn API Client — the core data access layer.
 *
 * Handles Cloudflare's bot-management cookie bounces by using
 * redirect: 'manual' and maintaining a persistent cookie jar.
 */
export class LinkedInClient {
  private auth: AuthManager;
  private rateLimiter: RateLimiter;
  private cache: Cache;
  private logger: Logger;
  private config: LinkedInClientConfig;

  /**
   * Persistent cookie jar — stores Cloudflare and LinkedIn session cookies
   * (e.g. __cf_bm, lidc, bcookie) across requests so that 302 cookie
   * bounces are handled automatically.
   */
  private cookieJar: Map<string, string> = new Map();

  constructor(auth: AuthManager, logger: Logger, config?: Partial<LinkedInClientConfig>) {
    this.auth = auth;
    this.logger = logger;
    this.config = {
      rateLimitRpm: config?.rateLimitRpm ?? 30,
      cacheTtlSeconds: config?.cacheTtlSeconds ?? 300,
      requestTimeoutMs: config?.requestTimeoutMs ?? 30000,
      maxRetries: config?.maxRetries ?? 3,
    };

    this.rateLimiter = new RateLimiter({ maxRpm: this.config.rateLimitRpm });
    this.cache = new Cache(this.config.cacheTtlSeconds);
  }

  /**
   * Make a GET request to LinkedIn's Voyager API.
   * Used with cookie-based authentication.
   */
  async voyagerGet<T = LinkedInApiResponse>(
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    const url = `https://www.linkedin.com/voyager/api${path}`;
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request to LinkedIn's Voyager API.
   */
  async voyagerPost<T = LinkedInApiResponse>(
    path: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(`https://www.linkedin.com/voyager/api${path}`, {
      ...options,
      method: 'POST',
      body,
      skipCache: true,
    });
  }

  /**
   * Make a GET request to LinkedIn's official REST API.
   * Used with OAuth authentication.
   */
  async restGet<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    const url = `https://api.linkedin.com/v2${path}`;
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request to LinkedIn's official REST API.
   */
  async restPost<T = unknown>(
    path: string,
    body: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(`https://api.linkedin.com/v2${path}`, {
      ...options,
      method: 'POST',
      body,
      skipCache: true,
    });
  }

  /**
   * Get the authentication manager.
   */
  getAuth(): AuthManager {
    return this.auth;
  }

  /**
   * Get cache stats.
   */
  getCacheStats(): { size: number; maxSize: number } {
    return this.cache.getStats();
  }

  /**
   * Clear the response cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ─── Private Methods ────────────────────────────────────

  /**
   * Core request method with rate limiting, caching, retries,
   * and Cloudflare cookie-bounce handling.
   */
  private async request<T>(url: string, options?: RequestOptions): Promise<T> {
    const method = options?.method ?? 'GET';

    // Check cache for GET requests
    if (method === 'GET' && !options?.skipCache) {
      const cacheKey = this.getCacheKey(url);
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== undefined) {
        this.logger.debug('Cache hit', { url: this.sanitizeUrl(url) });
        return cached;
      }
    }

    // Rate limiting
    if (!options?.skipRateLimit) {
      const waitMs = await this.rateLimiter.waitForToken();
      if (waitMs > 0) {
        this.logger.debug('Rate limited, waited', { waitMs, url: this.sanitizeUrl(url) });
      }
    }

    // Ensure auth is configured
    const authHeaders = this.auth.requireAuth();

    // Build request headers — merge auth headers with cookie jar
    const headers: Record<string, string> = {
      ...authHeaders,
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.linkedin.normalized+json+2.1',
      ...(options?.headers ?? {}),
    };

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    // Merge cookie jar into the Cookie header
    this.mergeCookieJar(headers);

    // Retry loop
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.logger.debug('Request', {
          method,
          url: this.sanitizeUrl(url),
          attempt,
        });

        const data = await this.fetchWithRedirects<T>(url, method, headers, options);

        // Cache GET responses
        if (method === 'GET' && !options?.skipCache) {
          const cacheKey = this.getCacheKey(url);
          this.cache.set(cacheKey, data, options?.cacheTtl);
        }

        return data;
      } catch (error) {
        if (error instanceof AuthError) throw error;
        if (error instanceof LinkedInApiError && error.status === 404) throw error;

        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          this.logger.warn('Request failed, retrying', {
            attempt,
            error: lastError.message,
            backoffMs,
          });
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Execute a fetch with manual redirect handling.
   *
   * Cloudflare bot-management returns 302 → same URL with Set-Cookie: __cf_bm.
   * Standard fetch auto-follows without capturing Set-Cookie, causing infinite loops.
   * We use redirect:'manual', capture cookies, and re-request.
   */
  private async fetchWithRedirects<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    options?: RequestOptions,
  ): Promise<T> {
    let currentUrl = url;

    for (let redirectCount = 0; redirectCount < MAX_REDIRECTS; redirectCount++) {
      const response = await fetch(currentUrl, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        redirect: 'manual',
      });

      // Capture Set-Cookie headers from every response
      this.captureSetCookies(response);

      // Handle redirects (301, 302, 303, 307, 308)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');

        // Resolve relative or same-URL redirects
        let nextUrl: string;
        if (location) {
          try {
            nextUrl = new URL(location, currentUrl).toString();
          } catch {
            nextUrl = currentUrl; // Same-URL bounce
          }
        } else {
          nextUrl = currentUrl; // No location = same-URL bounce
        }

        this.logger.debug('Redirect bounce', {
          status: response.status,
          from: this.sanitizeUrl(currentUrl),
          to: this.sanitizeUrl(nextUrl),
          cookies: this.cookieJar.size,
        });

        // Update Cookie header with new jar contents
        this.mergeCookieJar(headers);
        currentUrl = nextUrl;
        continue;
      }

      // Handle specific error codes
      if (response.status === 401 || response.status === 403) {
        throw new AuthError(
          `LinkedIn authentication failed (${response.status}). Your credentials may have expired.`,
        );
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') ?? '60', 10);
        this.logger.warn('LinkedIn rate limit hit', { retryAfter });
        throw new LinkedInApiError(
          'Rate limited by LinkedIn. Try again later.',
          429,
        );
      }

      if (response.status === 404) {
        throw new LinkedInApiError('Resource not found on LinkedIn.', 404);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new LinkedInApiError(
          `LinkedIn API error: ${response.status} ${response.statusText}`,
          response.status,
          body,
        );
      }

      // Parse response
      return (await response.json()) as T;
    }

    throw new LinkedInApiError(
      `Too many redirects (${MAX_REDIRECTS}). LinkedIn may be blocking this request with Cloudflare bot-management. Try refreshing your li_at cookie.`,
      302,
    );
  }

  /**
   * Parse Set-Cookie headers from a response and store in the cookie jar.
   * Handles multiple Set-Cookie headers and extracts name=value pairs.
   */
  private captureSetCookies(response: Response): void {
    // getSetCookie() returns an array of Set-Cookie header values
    const setCookies = response.headers.getSetCookie?.() ?? [];

    for (const setCookie of setCookies) {
      // Extract "name=value" from "name=value; Path=/; ..."
      const parts = setCookie.split(';');
      const nameValue = parts[0]?.trim();
      if (!nameValue) continue;

      const eqIndex = nameValue.indexOf('=');
      if (eqIndex < 0) continue;

      const name = nameValue.substring(0, eqIndex).trim();
      const value = nameValue.substring(eqIndex + 1).trim();

      if (name && value) {
        this.cookieJar.set(name, value);
        this.logger.debug('Cookie captured', { name, valueLen: value.length });
      }
    }

    // Fallback: try raw 'set-cookie' header (some Node versions)
    if (setCookies.length === 0) {
      const raw = response.headers.get('set-cookie');
      if (raw) {
        // May contain multiple cookies comma-separated (RFC 6265 ambiguity)
        for (const part of raw.split(/,(?=[^ ])/)) {
          const nameValue = part.split(';')[0]?.trim();
          if (!nameValue) continue;
          const eqIndex = nameValue.indexOf('=');
          if (eqIndex < 0) continue;
          const name = nameValue.substring(0, eqIndex).trim();
          const value = nameValue.substring(eqIndex + 1).trim();
          if (name && value) {
            this.cookieJar.set(name, value);
          }
        }
      }
    }
  }

  /**
   * Merge cookie jar contents into the request's Cookie header.
   * Preserves existing auth cookies (li_at, JSESSIONID) and appends
   * jar cookies (__cf_bm, lidc, bcookie, etc.).
   */
  private mergeCookieJar(headers: Record<string, string>): void {
    if (this.cookieJar.size === 0) return;

    const existingCookie = headers['Cookie'] ?? '';

    // Parse existing cookies into a map
    const cookieMap = new Map<string, string>();
    for (const pair of existingCookie.split(';')) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex < 0) continue;
      const name = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      cookieMap.set(name, value);
    }

    // Merge jar cookies (jar values take precedence for non-auth cookies)
    for (const [name, value] of this.cookieJar) {
      // Don't overwrite the auth cookies from the auth manager
      if (name === 'li_at' || name === 'JSESSIONID') continue;
      cookieMap.set(name, value);
    }

    // Rebuild Cookie header
    const parts: string[] = [];
    for (const [name, value] of cookieMap) {
      parts.push(`${name}=${value}`);
    }

    headers['Cookie'] = parts.join('; ');
  }

  private getCacheKey(url: string): string {
    return `linkedin:${url}`;
  }

  private sanitizeUrl(url: string): string {
    // Remove sensitive query params from logs
    try {
      const u = new URL(url);
      return `${u.pathname}${u.search ? '?...' : ''}`;
    } catch {
      return url.split('?')[0] ?? url;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Custom error for LinkedIn API failures.
 */
export class LinkedInApiError extends Error {
  status: number;
  responseBody?: string;

  constructor(message: string, status: number, responseBody?: string) {
    super(message);
    this.name = 'LinkedInApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}
