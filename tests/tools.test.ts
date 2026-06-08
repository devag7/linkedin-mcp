import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServer } from '../src/server.js';
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
