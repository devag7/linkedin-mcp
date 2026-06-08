import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkedInClient, LinkedInApiError } from '../src/client/linkedin.js';
import { AuthManager, AuthError } from '../src/auth/manager.js';
import { Logger } from '../src/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { firstName: 'Test' } }),
    });

    const result = await client.voyagerGet('/identity/profiles/testuser/profileView');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0]!;
    expect(url).toBe('https://www.linkedin.com/voyager/api/identity/profiles/testuser/profileView');
    expect(options.method).toBe('GET');
    expect(options.headers).toHaveProperty('Cookie');
    expect(options.headers).toHaveProperty('csrf-token');
    expect(options.headers['User-Agent']).toContain('Mozilla');
    expect(result).toEqual({ data: { firstName: 'Test' } });
  });

  it('should cache GET responses', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'cached_value' }),
    });

    // First call - should fetch
    await client.voyagerGet('/test/cached');
    // Second call - should use cache
    await client.voyagerGet('/test/cached');

    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('should skip cache when requested', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'fresh' }),
    });

    await client.voyagerGet('/test/fresh', { skipCache: true });
    await client.voyagerGet('/test/fresh', { skipCache: true });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should throw AuthError on 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(client.voyagerGet('/test/auth')).rejects.toThrow(AuthError);
  });

  it('should throw AuthError on 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    await expect(client.voyagerGet('/test/forbidden')).rejects.toThrow(AuthError);
  });

  it('should throw LinkedInApiError on 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(client.voyagerGet('/test/missing')).rejects.toThrow(LinkedInApiError);
  });

  it('should retry on server errors', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'server error',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'recovered' }),
      });

    const result = await client.voyagerGet('/test/retry', { skipCache: true });
    expect(result).toEqual({ data: 'recovered' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should handle rate limit 429 with retry', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Map([['retry-after', '1']]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'after_rate_limit' }),
      });

    // Mock headers.get for rate limit
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => '1' },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'recovered' }),
      });

    const result = await client.voyagerGet('/test/ratelimit', { skipCache: true });
    expect(result).toEqual({ data: 'recovered' });
  });

  it('should make POST requests without caching', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

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
