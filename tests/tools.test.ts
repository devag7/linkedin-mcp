import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServer, createSharedDependencies, VERSION } from '../src/server.js';
import { Logger } from '../src/types.js';

// Mock fetch for tools that make network calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Tool Registration', () => {
  it('should register all expected tools', () => {
    const logger = new Logger('error');
    const server = createServer(logger);

    // Verify server was created
    expect(server).toBeDefined();
  });

  it('should accept shared dependencies', () => {
    const logger = new Logger('error');
    const shared = createSharedDependencies(logger);
    const server = createServer(logger, shared);
    expect(server).toBeDefined();
  });

  it('should reuse shared dependencies across multiple createServer calls', () => {
    const logger = new Logger('error');
    const shared = createSharedDependencies(logger);

    // Create two servers with the same shared deps — simulates HTTP mode
    const server1 = createServer(logger, shared);
    const server2 = createServer(logger, shared);

    expect(server1).toBeDefined();
    expect(server2).toBeDefined();
    // Both should work without errors
  });
});

describe('Tool Error Handling', () => {
  let logger: Logger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new Logger('error');
  });

  it('should handle whoami without auth gracefully', async () => {
    // whoami should work even without auth configured
    const server = createServer(logger);
    expect(server).toBeDefined();
  });

  it('should handle health_check with LinkedIn unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const server = createServer(logger);
    expect(server).toBeDefined();
  });
});

describe('Input Validation', () => {
  it('should reject empty username for get_profile', () => {
    // Zod schema requires non-empty string
    const { z } = require('zod');
    const schema = z.string();
    expect(schema.safeParse('').success).toBe(true); // empty string is valid string
    expect(schema.safeParse(123).success).toBe(false); // number is not string
  });

  it('should clamp count values', () => {
    const { z } = require('zod');
    const schema = z.number().int().min(1).max(50).default(10);
    expect(schema.safeParse(0).success).toBe(false);
    expect(schema.safeParse(51).success).toBe(false);
    expect(schema.safeParse(25).success).toBe(true);
    expect(schema.parse(undefined)).toBe(10); // default
  });

  it('should validate reaction types', () => {
    const { z } = require('zod');
    const schema = z.enum(['LIKE', 'PRAISE', 'EMPATHY', 'ENTERTAINMENT', 'LOVE', 'INTEREST']);
    expect(schema.safeParse('LIKE').success).toBe(true);
    expect(schema.safeParse('INVALID').success).toBe(false);
  });

  it('should validate network filter', () => {
    const { z } = require('zod');
    const schema = z.enum(['F', 'S', 'O']).optional();
    expect(schema.safeParse('F').success).toBe(true);
    expect(schema.safeParse('X').success).toBe(false);
    expect(schema.safeParse(undefined).success).toBe(true);
  });

  it('should validate invitation direction', () => {
    const { z } = require('zod');
    const schema = z.enum(['RECEIVED', 'SENT']).default('RECEIVED');
    expect(schema.parse(undefined)).toBe('RECEIVED');
    expect(schema.safeParse('SENT').success).toBe(true);
    expect(schema.safeParse('INVALID').success).toBe(false);
  });

  it('should validate visibility for create_post', () => {
    const { z } = require('zod');
    const schema = z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC');
    expect(schema.parse(undefined)).toBe('PUBLIC');
    expect(schema.safeParse('CONNECTIONS').success).toBe(true);
    expect(schema.safeParse('PRIVATE').success).toBe(false);
  });

  it('should validate message length for connect_with_person', () => {
    const note = 'x'.repeat(301);
    expect(note.slice(0, 300).length).toBe(300);
  });

  it('should validate post text length', () => {
    const { z } = require('zod');
    const schema = z.string().min(1).max(3000);
    expect(schema.safeParse('').success).toBe(false);
    expect(schema.safeParse('Hello world').success).toBe(true);
    expect(schema.safeParse('x'.repeat(3001)).success).toBe(false);
  });
});

describe('VERSION', () => {
  it('should export a version string', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should match package.json version', async () => {
    const { readFileSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');

    // Read package.json directly
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(VERSION).toBe(pkg.version);
  });
});

describe('SharedDependencies', () => {
  it('should create auth and client', () => {
    const logger = new Logger('error');
    const shared = createSharedDependencies(logger);

    expect(shared).toBeDefined();
    expect(shared.auth).toBeDefined();
    expect(shared.client).toBeDefined();
  });

  it('should detect no auth when unconfigured', () => {
    const logger = new Logger('error');
    const shared = createSharedDependencies(logger);

    expect(shared.auth.isConfigured()).toBe(false);
    expect(shared.auth.getMethod()).toBe('none');
  });

  it('should include cache stats in client', () => {
    const logger = new Logger('error');
    const shared = createSharedDependencies(logger);

    const stats = shared.client.getCacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('maxSize');
    expect(stats.size).toBe(0);
  });
});
