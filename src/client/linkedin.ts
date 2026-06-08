/**
 * LinkedIn HTTP Client
 *
 * Core HTTP client for making requests to LinkedIn's APIs.
 * Features:
 * - Automatic rate limiting
 * - Response caching
 * - Retry with exponential backoff
 * - Structured error handling
 * - Support for both Voyager (cookie) and REST (OAuth) APIs
 */

import type { Logger } from '../types.js';
import { AuthManager, AuthError } from '../auth/manager.js';
import { RateLimiter } from '../middleware/rate-limiter.js';
import { Cache } from '../middleware/cache.js';
import type { LinkedInApiResponse } from './types.js';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
 */
export class LinkedInClient {
  private auth: AuthManager;
  private rateLimiter: RateLimiter;
  private cache: Cache;
  private logger: Logger;
  private config: LinkedInClientConfig;

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
   * Core request method with rate limiting, caching, and retries.
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

    // Build request headers
    const headers: Record<string, string> = {
      ...authHeaders,
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.linkedin.normalized+json+2.1',
      ...(options?.headers ?? {}),
    };

    if (options?.body) {
      headers['Content-Type'] = 'application/json';
    }

    // Retry loop
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.logger.debug('Request', {
          method,
          url: this.sanitizeUrl(url),
          attempt,
        });

        const response = await fetch(url, {
          method,
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });

        // Handle specific error codes
        if (response.status === 401 || response.status === 403) {
          throw new AuthError(
            `LinkedIn authentication failed (${response.status}). Your credentials may have expired.`,
          );
        }

        if (response.status === 429) {
          // Rate limited by LinkedIn
          const retryAfter = parseInt(response.headers.get('retry-after') ?? '60', 10);
          this.logger.warn('LinkedIn rate limit hit', { retryAfter, attempt });

          if (attempt < this.config.maxRetries) {
            await this.sleep(retryAfter * 1000);
            continue;
          }
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
        const data = (await response.json()) as T;

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
