/**
 * Cookie-based Authentication for LinkedIn.
 *
 * Uses the `li_at` session cookie from the user's browser.
 * This is the quickest way to authenticate — just copy the cookie value.
 *
 * How to get it:
 * 1. Log in to LinkedIn in your browser
 * 2. Open DevTools → Application → Cookies → linkedin.com
 * 3. Copy the `li_at` cookie value
 * 4. Set LINKEDIN_COOKIE environment variable
 */

import type { Logger } from '../types.js';

export interface CookieAuth {
  cookie: string;
  csrfToken?: string;
}

export interface CookieAuthHeaders {
  Cookie: string;
  'csrf-token': string;
  'x-li-lang': string;
  'x-li-track': string;
  'x-restli-protocol-version': string;
}

/**
 * Validate and prepare cookie-based authentication headers.
 */
export function createCookieAuth(cookie: string, csrfToken?: string): CookieAuth {
  // Clean the cookie value — remove quotes if present
  const cleanCookie = cookie.replace(/^["']|["']$/g, '');

  // Clean CSRF token — remove quotes if present
  const cleanCsrf = csrfToken ? csrfToken.replace(/^["']|["']$/g, '') : undefined;

  return {
    cookie: cleanCookie,
    csrfToken: cleanCsrf,
  };
}

/**
 * Generate the HTTP headers needed for authenticated LinkedIn API requests.
 */
export function getCookieAuthHeaders(auth: CookieAuth): CookieAuthHeaders {
  // The CSRF token is either provided or derived from JSESSIONID
  const csrf = auth.csrfToken || generateCsrfPlaceholder();

  return {
    Cookie: `li_at=${auth.cookie}; JSESSIONID="${csrf}"`,
    'csrf-token': csrf,
    'x-li-lang': 'en_US',
    'x-li-track': JSON.stringify({
      clientVersion: '1.13.0',
      mpVersion: '1.13.0',
      osName: 'web',
      timezoneOffset: 0,
      deviceFormFactor: 'DESKTOP',
      mpName: 'voyager-web',
    }),
    'x-restli-protocol-version': '2.0.0',
  };
}

/**
 * Validate that a cookie is still valid by making a lightweight API call.
 */
export async function validateCookie(auth: CookieAuth, logger: Logger): Promise<boolean> {
  try {
    const headers = getCookieAuthHeaders(auth);

    const response = await fetch(
      'https://www.linkedin.com/voyager/api/me',
      {
        method: 'GET',
        headers: {
          ...headers,
          Accept: 'application/vnd.linkedin.normalized+json+2.1',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (response.ok) {
      logger.debug('Cookie validation successful');
      return true;
    }

    if (response.status === 401 || response.status === 403) {
      logger.warn('Cookie expired or invalid', { status: response.status });
      return false;
    }

    logger.warn('Cookie validation returned unexpected status', {
      status: response.status,
    });
    return false;
  } catch (error) {
    logger.error('Cookie validation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Generate a placeholder CSRF token.
 * LinkedIn sometimes accepts requests with a custom CSRF value.
 */
function generateCsrfPlaceholder(): string {
  return `ajax:${Date.now()}`;
}
