/**
 * Authentication Manager
 *
 * Unified interface for both OAuth and Cookie authentication.
 * Automatically detects which method is configured and provides
 * the appropriate headers for LinkedIn API requests.
 */

import type { Logger } from '../types.js';
import type { EnvConfig } from '../config/env.js';
import { getAuthMethod } from '../config/env.js';
import { createCookieAuth, getCookieAuthHeaders, validateCookie } from './cookie.js';
import type { CookieAuth } from './cookie.js';
import { createOAuthAuth, getOAuthHeaders, validateOAuthToken } from './oauth.js';
import type { OAuthAuth } from './oauth.js';

export type AuthMethod = 'oauth' | 'cookie' | 'none';

export interface AuthHeaders {
  [key: string]: string;
}

export interface AuthStatus {
  method: AuthMethod;
  configured: boolean;
  valid: boolean;
  details?: string;
}

/**
 * Authentication Manager — handles OAuth and Cookie auth strategies.
 */
export class AuthManager {
  private method: AuthMethod;
  private cookieAuth?: CookieAuth;
  private oauthAuth?: OAuthAuth;
  private logger: Logger;
  private _lastValidation?: { valid: boolean; timestamp: number };

  constructor(config: EnvConfig, logger: Logger) {
    this.logger = logger;
    this.method = getAuthMethod(config);

    if (config.LINKEDIN_ACCESS_TOKEN) {
      this.oauthAuth = createOAuthAuth(config.LINKEDIN_ACCESS_TOKEN);
      logger.info('Auth configured: OAuth 2.0');
    }

    if (config.LINKEDIN_COOKIE) {
      this.cookieAuth = createCookieAuth(config.LINKEDIN_COOKIE, config.LINKEDIN_CSRF_TOKEN);
      logger.info('Auth configured: Cookie (li_at)');
    }

    if (this.method === 'none') {
      logger.warn('No authentication configured. Set LINKEDIN_ACCESS_TOKEN or LINKEDIN_COOKIE.');
    }
  }

  /**
   * Get the current authentication method.
   */
  getMethod(): AuthMethod {
    return this.method;
  }

  /**
   * Check if any authentication is configured.
   */
  isConfigured(): boolean {
    return this.method !== 'none';
  }

  /**
   * Get the appropriate HTTP headers for the current auth method.
   * Returns headers for the Voyager API (cookie) or REST API (OAuth).
   */
  getHeaders(): AuthHeaders {
    if (this.method === 'oauth' && this.oauthAuth) {
      return getOAuthHeaders(this.oauthAuth) as unknown as AuthHeaders;
    }

    if (this.method === 'cookie' && this.cookieAuth) {
      return getCookieAuthHeaders(this.cookieAuth) as unknown as AuthHeaders;
    }

    return {};
  }

  /**
   * Get the base URL for API requests based on auth method.
   * - Cookie auth → Voyager API (internal LinkedIn API)
   * - OAuth → Official REST API
   */
  getBaseUrl(): string {
    if (this.method === 'oauth') {
      return 'https://api.linkedin.com/v2';
    }
    return 'https://www.linkedin.com/voyager/api';
  }

  /**
   * Validate the current authentication credentials.
   * Caches the result for 5 minutes to avoid excessive validation calls.
   */
  async validate(): Promise<AuthStatus> {
    // Return cached result if recent (within 5 minutes)
    if (
      this._lastValidation &&
      Date.now() - this._lastValidation.timestamp < 300000
    ) {
      return {
        method: this.method,
        configured: this.isConfigured(),
        valid: this._lastValidation.valid,
        details: 'Cached validation result',
      };
    }

    if (!this.isConfigured()) {
      return {
        method: 'none',
        configured: false,
        valid: false,
        details: 'No authentication configured',
      };
    }

    let valid = false;

    if (this.method === 'oauth' && this.oauthAuth) {
      valid = await validateOAuthToken(this.oauthAuth, this.logger);
    } else if (this.method === 'cookie' && this.cookieAuth) {
      valid = await validateCookie(this.cookieAuth, this.logger);
    }

    this._lastValidation = { valid, timestamp: Date.now() };

    return {
      method: this.method,
      configured: true,
      valid,
      details: valid ? 'Authentication valid' : 'Authentication invalid or expired',
    };
  }

  /**
   * Require authentication — throws if not configured.
   * Call this at the start of tools that need auth.
   */
  requireAuth(): AuthHeaders {
    if (!this.isConfigured()) {
      throw new AuthError(
        'Authentication required. Set LINKEDIN_COOKIE or LINKEDIN_ACCESS_TOKEN environment variable.',
      );
    }
    return this.getHeaders();
  }
}

/**
 * Custom error for authentication failures.
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}
