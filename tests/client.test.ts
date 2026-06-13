import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkedInClient, LinkedInApiError } from '../src/client/linkedin.js';
import { AuthManager, AuthError } from '../src/auth/manager.js';
import { Logger } from '../src/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/**
 * Helper to create a mock Response that satisfies the cookie-jar code.
 * Includes getSetCookie() and headers.get() for proper redirect handling.
 */
function mockResponse(overrides: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
  setCookies?: string[];
  locationHeader?: string;
  retryAfterHeader?: string;
}) {
  const {
    ok = true,
    status = 200,
    statusText = 'OK',
    json = async () => ({}),
    text = async () => '',
    setCookies = [],
    locationHeader,
    retryAfterHeader,
  } = overrides;

  return {
    ok,
    status,
    statusText,
    json,
    text,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'location') return locationHeader ?? null;
        if (name.toLowerCase() === 'retry-after') return retryAfterHeader ?? null;
        if (name.toLowerCase() === 'set-cookie') return setCookies.join(', ') || null;
        return null;
      },
      getSetCookie: () => setCookies,
    },
  };
}

describe('LinkedInClient', () => {
  let client: LinkedInClient;
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new Logger('error');

    // Create auth manager with cookie config
    const config = {
      LINKEDIN_ACCESS_TOKEN: undefined,
      LINKEDIN_COOKIE: 'test_li_at_cookie',
      LINKEDIN_CSRF_TOKEN: 'test_csrf',
      PORT: 3000,
      TRANSPORT: 'stdio' as const,
      LOG_LEVEL: 'error' as const,
      CORS_ORIGIN: undefined,
      CACHE_TTL: 300,
      RATE_LIMIT_RPM: 60,
      REQUEST_TIMEOUT: 5000,
    };

    const auth = new AuthManager(config, logger);
    client = new LinkedInClient(auth, logger, {
      rateLimitRpm: 60,
      cacheTtlSeconds: 300,
      requestTimeoutMs: 5000,
      maxRetries: 2,
    });
  });

  it('should make voyager GET requests with proper headers', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({
      json: async () => ({ data: { firstName: 'Test' } }),
    }));

    const result = await client.voyagerGet('/identity/profiles/testuser/profileView');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://www.linkedin.com/voyager/api/identity/profiles/testuser/profileView');
    expect(options.method).toBe('GET');
    expect(options.headers).toHaveProperty('Cookie');
    expect(options.headers).toHaveProperty('csrf-token');
    expect(options.headers['User-Agent']).toContain('Mozilla');
    expect(options.redirect).toBe('manual');
    expect(result).toEqual({ data: { firstName: 'Test' } });
  });

  it('should handle Cloudflare 302 cookie bounce', async () => {
    // First call: 302 with Set-Cookie __cf_bm
    mockFetch
      .mockResolvedValueOnce(mockResponse({
        ok: false,
        status: 302,
        setCookies: ['__cf_bm=abc123; Path=/; HttpOnly'],
        locationHeader: 'https://www.linkedin.com/voyager/api/me',
      }))
      // Second call (after capturing cookies): 200
      .mockResolvedValueOnce(mockResponse({
        json: async () => ({ data: { firstName: 'Test' } }),
      }));

    const result = await client.voyagerGet('/me', { skipCache: true });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Second call should include __cf_bm in Cookie header
    const [, secondOptions] = mockFetch.mock.calls[1]!;
    expect(secondOptions.headers['Cookie']).toContain('__cf_bm=abc123');
    expect(result).toEqual({ data: { firstName: 'Test' } });
  });

  it('should fail clearly on too many redirects', async () => {
    // Return 302 forever
    mockFetch.mockResolvedValue(mockResponse({
      ok: false,
      status: 302,
      setCookies: ['__cf_bm=loop; Path=/'],
      locationHeader: 'https://www.linkedin.com/voyager/api/me',
    }));

    await expect(client.voyagerGet('/me', { skipCache: true })).rejects.toThrow(
      /Too many redirects/,
    );
  });

  it('should cache GET responses', async () => {
    mockFetch.mockResolvedValue(mockResponse({
      json: async () => ({ data: 'cached_value' }),
    }));

    // First call - should fetch
    await client.voyagerGet('/test/cached');
    // Second call - should use cache
    await client.voyagerGet('/test/cached');

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should skip cache when requested', async () => {
    mockFetch.mockResolvedValue(mockResponse({
      json: async () => ({ data: 'fresh' }),
    }));

    await client.voyagerGet('/test/fresh', { skipCache: true });
    await client.voyagerGet('/test/fresh', { skipCache: true });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should throw AuthError on 401', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    }));

    await expect(client.voyagerGet('/test/auth')).rejects.toThrow(AuthError);
  });

  it('should throw AuthError on 403', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }));

    await expect(client.voyagerGet('/test/forbidden')).rejects.toThrow(AuthError);
  });

  it('should throw LinkedInApiError on 404', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }));

    await expect(client.voyagerGet('/test/missing')).rejects.toThrow(LinkedInApiError);
  });

  it('should retry on server errors', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'server error',
      }))
      .mockResolvedValueOnce(mockResponse({
        json: async () => ({ data: 'recovered' }),
      }));

    const result = await client.voyagerGet('/test/retry', { skipCache: true });
    expect(result).toEqual({ data: 'recovered' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should throw on rate limit 429', async () => {
    // Both attempts return 429
    mockFetch
      .mockResolvedValueOnce(mockResponse({
        ok: false,
        status: 429,
        retryAfterHeader: '60',
      }))
      .mockResolvedValueOnce(mockResponse({
        ok: false,
        status: 429,
        retryAfterHeader: '60',
      }));

    await expect(client.voyagerGet('/test/ratelimit', { skipCache: true })).rejects.toThrow(
      /Rate limited/,
    );
  });

  it('should make POST requests without caching', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({
      json: async () => ({ success: true }),
    }));

    const result = await client.voyagerPost('/messaging/conversations', { body: 'hello' });

    const [, options] = mockFetch.mock.calls[0]!;
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(result).toEqual({ success: true });
  });

  it('should clear cache', () => {
    client.clearCache();
    const stats = client.getCacheStats();
    expect(stats.size).toBe(0);
  });

  it('should preserve auth cookies when merging cookie jar', async () => {
    // 302 with new cookies, then 200
    mockFetch
      .mockResolvedValueOnce(mockResponse({
        ok: false,
        status: 302,
        setCookies: [
          '__cf_bm=cftoken; Path=/',
          'lidc=newlidc; Path=/',
          'bcookie=newbc; Path=/',
        ],
        locationHeader: 'https://www.linkedin.com/voyager/api/me',
      }))
      .mockResolvedValueOnce(mockResponse({
        json: async () => ({ data: { id: 123 } }),
      }));

    await client.voyagerGet('/me', { skipCache: true });

    // Verify second request has original auth + jar cookies
    const [, opts] = mockFetch.mock.calls[1]!;
    const cookie = opts.headers['Cookie'];
    expect(cookie).toContain('li_at=test_li_at_cookie');
    expect(cookie).toContain('JSESSIONID');
    expect(cookie).toContain('__cf_bm=cftoken');
    expect(cookie).toContain('lidc=newlidc');
    expect(cookie).toContain('bcookie=newbc');
  });
});

describe('LinkedInApiError', () => {
  it('should include status and response body', () => {
    const error = new LinkedInApiError('Test error', 500, '{"detail":"fail"}');
    expect(error.name).toBe('LinkedInApiError');
    expect(error.status).toBe(500);
    expect(error.responseBody).toBe('{"detail":"fail"}');
    expect(error.message).toBe('Test error');
  });
});
