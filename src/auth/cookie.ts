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
 * 4. Copy the `JSESSIONID` cookie value (required for CSRF)
 * 5. Set LINKEDIN_COOKIE and LINKEDIN_CSRF_TOKEN environment variables
 */

import type { Logger } from '../types.js';

export interface CookieAuth {
  cookie: string;
  csrfToken: string;
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
 * Both cookie and csrfToken are required for LinkedIn API access.
 */
export function createCookieAuth(cookie: string, csrfToken?: string): CookieAuth {
  // Clean the cookie value — remove quotes if present
  const cleanCookie = cookie.replace(/^["']|["']$/g, '');

  if (!csrfToken) {
    throw new Error(
      'LINKEDIN_CSRF_TOKEN is required for cookie authentication. ' +
      'Copy the JSESSIONID cookie value from your browser ' +
      '(DevTools → Application → Cookies → linkedin.com → JSESSIONID).',
    );
  }

  // Clean CSRF token — remove quotes if present
  const cleanCsrf = csrfToken.replace(/^["']|["']$/g, '');

  return {
    cookie: cleanCookie,
    csrfToken: cleanCsrf,
  };
}

/**
 * Generate the HTTP headers needed for authenticated LinkedIn API requests.
 */
export function getCookieAuthHeaders(auth: CookieAuth): CookieAuthHeaders {
  return {
    Cookie: `li_at=${auth.cookie}; JSESSIONID="${auth.csrfToken}"`,
    'csrf-token': auth.csrfToken,
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
 * Uses redirect:'manual' to handle Cloudflare cookie bounces.
 */
export async function validateCookie(auth: CookieAuth, logger: Logger): Promise<boolean> {
  try {
    const headers = getCookieAuthHeaders(auth);
    const allHeaders: Record<string, string> = {
      ...headers,
      Accept: 'application/vnd.linkedin.normalized+json+2.1',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };

    // Follow up to 3 Cloudflare bounces
    let url = 'https://www.linkedin.com/voyager/api/me';
    for (let bounce = 0; bounce < 3; bounce++) {
      const response = await fetch(url, {
        method: 'GET',
        headers: allHeaders,
        signal: AbortSignal.timeout(10000),
        redirect: 'manual',
      });

      // Capture Set-Cookie and merge into headers
      const setCookies = response.headers.getSetCookie?.() ?? [];
      for (const sc of setCookies) {
        const nameValue = sc.split(';')[0]?.trim();
        if (!nameValue) continue;
        const eqIdx = nameValue.indexOf('=');
        if (eqIdx < 0) continue;
        const name = nameValue.substring(0, eqIdx).trim();
        const value = nameValue.substring(eqIdx + 1).trim();
        if (name && value && name !== 'li_at' && name !== 'JSESSIONID') {
          // Append to Cookie header
          allHeaders['Cookie'] = `${allHeaders['Cookie']}; ${name}=${value}`;
        }
      }

      // Handle redirect bounce
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        url = location ? new URL(location, url).toString() : url;
        logger.debug('Cookie validation redirect bounce', { status: response.status, bounce });
        continue;
      }

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
    }

    logger.warn('Cookie validation failed: too many redirects (Cloudflare bounce)');
    return false;
  } catch (error) {
    logger.error('Cookie validation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
