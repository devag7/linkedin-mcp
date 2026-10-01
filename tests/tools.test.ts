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

// Real HTTP + MCP protocol, with only LinkedIn-facing work replaced by fixtures.
// This ensures the production registrations use one runtime across requests.
it('shares the actual engine and guard across HTTP clients', async () => {
  const { vi } = await import('vitest');
  const { createRuntime } = await import('../src/server.js');
  const { startHttpServer } = await import('../src/transports/http.js');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } =
    await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const logger = new Logger('error');
  const runtime = createRuntime(logger, false);
  const guard = vi
    .spyOn(runtime.guard, 'run')
    .mockResolvedValue({
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      languages: [],
    });
  vi.spyOn(runtime.engine, 'hasActiveContext', 'get').mockReturnValue(true);
  const loggedIn = vi.spyOn(runtime.engine, 'isLoggedIn').mockResolvedValue(true);
  const shutdown = vi.spyOn(runtime.engine, 'dispose');
  const token = 'production-runtime-test-token-32-characters';
  const listener = await startHttpServer(() => createServer(logger, runtime).server, 0, logger, {
    token,
    shutdown: () => runtime.engine.dispose(),
  });
  const address = listener.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing address');
  const clients: InstanceType<typeof Client>[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const client = new Client({ name: 'fixture-client', version: '1' });
      clients.push(client);
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
        }),
      );
      expect((await client.listTools()).tools).toHaveLength(22);
      expect(
        (await client.callTool({ name: 'get_profile', arguments: { username: 'fixture' } }))
          .isError,
      ).not.toBe(true);
      expect((await client.callTool({ name: 'whoami', arguments: {} })).isError).not.toBe(true);
    }
    expect(guard).toHaveBeenCalledTimes(2);
    expect(loggedIn).toHaveBeenCalledTimes(2);
    expect(shutdown).not.toHaveBeenCalled();
  } finally {
    await Promise.all(clients.map((client) => client.close()));
    await listener.close();
    expect(shutdown).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  }
});
