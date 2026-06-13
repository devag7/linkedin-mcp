import { describe, it, expect } from 'vitest';

describe('LinkedIn MCP Server', () => {
  it('should export a valid version', async () => {
    const { VERSION } = await import('../src/server.js');
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('Config', () => {
  it('should parse default config', async () => {
    const { loadConfig } = await import('../src/config/env.js');
    const config = loadConfig();
    expect(config.PORT).toBe(3000);
    expect(config.TRANSPORT).toBe('stdio');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.CACHE_TTL).toBe(300);
    expect(config.RATE_LIMIT_RPM).toBe(30);
    expect(config.CORS_ORIGIN).toBeUndefined();
  });

  it('should detect no auth when no credentials set', async () => {
    const { loadConfig, hasAuth, getAuthMethod } = await import('../src/config/env.js');
    const config = loadConfig();
    expect(hasAuth(config)).toBe(false);
    expect(getAuthMethod(config)).toBe('none');
  });
});

describe('Logger', () => {
  it('should create logger with default level', async () => {
    const { Logger } = await import('../src/types.js');
    const logger = new Logger();
    expect(logger).toBeDefined();
  });

  it('should create logger with custom level', async () => {
    const { Logger } = await import('../src/types.js');
    const logger = new Logger('debug');
    expect(logger).toBeDefined();
  });
});

describe('Cookie Auth', () => {
  it('should create cookie auth with cleaned values', async () => {
    const { createCookieAuth } = await import('../src/auth/cookie.js');
    const auth = createCookieAuth('"test_cookie_value"', '"test_csrf"');
    expect(auth.cookie).toBe('test_cookie_value');
    expect(auth.csrfToken).toBe('test_csrf');
  });

  it('should throw when CSRF token is missing', async () => {
    const { createCookieAuth } = await import('../src/auth/cookie.js');
    expect(() => createCookieAuth('my_cookie')).toThrow('LINKEDIN_CSRF_TOKEN is required');
    expect(() => createCookieAuth('my_cookie', undefined)).toThrow('LINKEDIN_CSRF_TOKEN is required');
  });

  it('should generate proper headers', async () => {
    const { createCookieAuth, getCookieAuthHeaders } = await import('../src/auth/cookie.js');
    const auth = createCookieAuth('my_li_at', 'my_csrf');
    const headers = getCookieAuthHeaders(auth);
    expect(headers.Cookie).toContain('li_at=my_li_at');
    expect(headers['csrf-token']).toBe('my_csrf');
    expect(headers['x-restli-protocol-version']).toBe('2.0.0');
  });
});

describe('OAuth Auth', () => {
  it('should create oauth auth', async () => {
    const { createOAuthAuth } = await import('../src/auth/oauth.js');
    const auth = createOAuthAuth('  test_token  ');
    expect(auth.accessToken).toBe('test_token');
  });

  it('should generate proper headers', async () => {
    const { createOAuthAuth, getOAuthHeaders } = await import('../src/auth/oauth.js');
    const auth = createOAuthAuth('my_token');
    const headers = getOAuthHeaders(auth);
    expect(headers.Authorization).toBe('Bearer my_token');
    expect(headers['X-Restli-Protocol-Version']).toBe('2.0.0');
  });
});

describe('Auth Manager', () => {
  it('should detect no auth when unconfigured', async () => {
    const { AuthManager } = await import('../src/auth/manager.js');
    const { Logger } = await import('../src/types.js');
    const { loadConfig } = await import('../src/config/env.js');
    const config = loadConfig();
    const logger = new Logger('error');
    const mgr = new AuthManager(config, logger);
    expect(mgr.isConfigured()).toBe(false);
    expect(mgr.getMethod()).toBe('none');
  });

  it('should throw on requireAuth when unconfigured', async () => {
    const { AuthManager, AuthError } = await import('../src/auth/manager.js');
    const { Logger } = await import('../src/types.js');
    const { loadConfig } = await import('../src/config/env.js');
    const config = loadConfig();
    const logger = new Logger('error');
    const mgr = new AuthManager(config, logger);
    expect(() => mgr.requireAuth()).toThrow(AuthError);
  });
});

describe('Rate Limiter', () => {
  it('should allow requests within limit', async () => {
    const { RateLimiter } = await import('../src/middleware/rate-limiter.js');
    const limiter = new RateLimiter({ maxRpm: 60, maxBurst: 5 });
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
  });

  it('should block after burst is exhausted', async () => {
    const { RateLimiter } = await import('../src/middleware/rate-limiter.js');
    const limiter = new RateLimiter({ maxRpm: 60, maxBurst: 2 });
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
  });

  it('should report status', async () => {
    const { RateLimiter } = await import('../src/middleware/rate-limiter.js');
    const limiter = new RateLimiter({ maxRpm: 60, maxBurst: 5 });
    const status = limiter.getStatus();
    expect(status.maxTokens).toBe(5);
    expect(status.availableTokens).toBe(5);
  });
});

describe('Cache', () => {
  it('should store and retrieve values', async () => {
    const { Cache } = await import('../src/middleware/cache.js');
    const cache = new Cache(60);
    cache.set('key1', { foo: 'bar' });
    expect(cache.get('key1')).toEqual({ foo: 'bar' });
  });

  it('should return undefined for missing keys', async () => {
    const { Cache } = await import('../src/middleware/cache.js');
    const cache = new Cache(60);
    expect(cache.get('missing')).toBeUndefined();
  });

  it('should evict oldest when at capacity', async () => {
    const { Cache } = await import('../src/middleware/cache.js');
    const cache = new Cache(60, 2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('should delete entries', async () => {
    const { Cache } = await import('../src/middleware/cache.js');
    const cache = new Cache(60);
    cache.set('key', 'value');
    cache.delete('key');
    expect(cache.get('key')).toBeUndefined();
  });

  it('should getOrSet with factory', async () => {
    const { Cache } = await import('../src/middleware/cache.js');
    const cache = new Cache(60);
    const value = await cache.getOrSet('key', async () => 'computed');
    expect(value).toBe('computed');
    // Second call should use cache
    const cached = await cache.getOrSet('key', async () => 'should_not_be_called');
    expect(cached).toBe('computed');
  });

  it('should report stats', async () => {
    const { Cache } = await import('../src/middleware/cache.js');
    const cache = new Cache(60, 100);
    cache.set('a', 1);
    cache.set('b', 2);
    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.maxSize).toBe(100);
  });
});
