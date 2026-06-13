/**
 * v2 server smoke test: createServer assembles the MCP server + browser engine
 * + safety stack without launching a browser (launch is lazy). The full tool
 * surface is exercised over stdio by the protocol harness; the safety layer has
 * its own dedicated suites (queue/pacer/budgets/circuit-breaker/guard).
 */

import { describe, it, expect } from 'vitest';
import { createServer } from '../src/server.js';
import { Logger } from '../src/types.js';

describe('createServer (v2)', () => {
  it('builds the server and engine without launching a browser', () => {
    const { server, engine } = createServer(new Logger('error'));
    expect(server).toBeDefined();
    expect(engine).toBeDefined();
    // Engine constructed but idle — no browser process until a tool needs it.
    expect(typeof engine.shutdown).toBe('function');
  });
});
