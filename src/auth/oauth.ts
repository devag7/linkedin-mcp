/**
 * LinkedIn OAuth 2.0 Authentication
 *
 * Supports LinkedIn's OAuth 2.0 flow for official API access.
 * This provides access to the Community Management API, Marketing API, etc.
 *
 * OAuth tokens are more limited in what they can access compared to cookies,
 * but they're the official, TOS-compliant method.
 *
 * Setup:
 * 1. Create an app at https://www.linkedin.com/developers/
 * 2. Get your access token
 * 3. Set LINKEDIN_ACCESS_TOKEN environment variable
 */

import type { Logger } from '../types.js';

export interface OAuthAuth {
  accessToken: string;
}

export interface OAuthHeaders {
  Authorization: string;
  'LinkedIn-Version': string;
  'X-Restli-Protocol-Version': string;
  Accept: string;
}

/**
 * Create OAuth authentication from an access token.
 */
export function createOAuthAuth(accessToken: string): OAuthAuth {
  return {
    accessToken: accessToken.trim(),
  };
}

/**
 * Generate HTTP headers for OAuth-authenticated LinkedIn API requests.
 */
export function getOAuthHeaders(auth: OAuthAuth): OAuthHeaders {
  return {
    Authorization: `Bearer ${auth.accessToken}`,
    'LinkedIn-Version': '202605',
    'X-Restli-Protocol-Version': '2.0.0',
    Accept: 'application/json',
  };
}

/**
 * Validate that an OAuth token is still valid.
 */
export async function validateOAuthToken(auth: OAuthAuth, logger: Logger): Promise<boolean> {
  try {
    const headers = getOAuthHeaders(auth);

    const response = await fetch('https://api.linkedin.com/v2/userinfo', {
      method: 'GET',
      headers: {
        ...headers,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      logger.debug('OAuth token validation successful');
      return true;
    }

    if (response.status === 401 || response.status === 403) {
      logger.warn('OAuth token expired or invalid', { status: response.status });
      return false;
    }

    logger.warn('OAuth validation returned unexpected status', {
      status: response.status,
    });
    return false;
  } catch (error) {
    logger.error('OAuth validation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
