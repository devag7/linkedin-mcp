import { afterEach, expect, it, vi } from 'vitest';
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { startHttpServer, type HttpListener } from '../src/transports/http.js';
import { Logger } from '../src/types.js';

const token = 'synthetic-http-test-token-32-characters';
const listeners: HttpListener[] = [];
afterEach(async () => {
  await Promise.all(listeners.splice(0).map((listener) => listener.close()));
});
async function fixture(options = {}) {
  const factory = vi.fn(() => new McpServer({ name: 'fixture', version: '1' }));
  const shutdown = vi.fn(async () => {});
  const listener = await startHttpServer(factory, 0, new Logger('error'), {
    token,
    shutdown,
    maxBodyBytes: 64,
    ...options,
  });
  listeners.push(listener);
  const address = listener.server.address();
  if (!address || typeof address === 'string') throw new Error('No listener address');
  expect(address.address).toBe('127.0.0.1');
  const request = (method: string, path: string, headers: Record<string, string> = {}, body = '') =>
    new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>(
      (resolve, reject) => {
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: address.port,
            method,
            path,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Connection: 'close',
              ...headers,
            },
          },
          (res) => {
            let text = '';
            res.on('data', (chunk) => {
              text += chunk;
            });
            res.on('end', () =>
              resolve({ status: res.statusCode!, headers: res.headers, body: text }),
            );
          },
        );
        req.on('error', reject);
        req.end(body);
      },
    );
  return { listener, factory, shutdown, request, port: address.port };
}
it.each(['/health', '/mcp'])(
  'rejects an unauthenticated caller on %s before dispatch',
  async (path) => {
    const f = await fixture();
    expect(
      (await f.request(path === '/mcp' ? 'POST' : 'GET', path, { Authorization: '' }, '{}')).status,
    ).toBe(401);
    expect(f.factory).not.toHaveBeenCalled();
  },
);
it.each([
  [{ Host: 'attacker.example' }, 403],
  [{ Origin: 'https://attacker.example' }, 403],
  [{ Origin: 'null' }, 403],
  [{ Authorization: 'Bearer invalid' }, 401],
  [{ 'Content-Type': 'text/plain' }, 415],
  [{ 'Content-Encoding': 'gzip' }, 415],
])('rejects hostile request headers %j before dispatch', async (headers, status) => {
  const f = await fixture();
  const result = await f.request('POST', '/mcp', headers as Record<string, string>, '{}');
  expect(result.status).toBe(status);
  expect(result.headers['access-control-allow-origin']).toBeUndefined();
  expect(f.factory).not.toHaveBeenCalled();
});
it.each([
  ['{', 400],
  ['x'.repeat(65), 413],
])('rejects invalid or oversized bodies before dispatch', async (body, status) => {
  const f = await fixture();
  expect((await f.request('POST', '/mcp', {}, body as string)).status).toBe(status);
  expect(f.factory).not.toHaveBeenCalled();
});
it('requires a valid secret before listening', async () => {
  await expect(
    startHttpServer(
      () => new McpServer({ name: 'fixture', version: '1' }),
      0,
      new Logger('error'),
      { token: 'short', shutdown: async () => {} },
    ),
  ).rejects.toThrow('HTTP requires');
});
it('serves authenticated local health and disposes shared resources only once', async () => {
  const f = await fixture();
  const result = await f.request('GET', '/health', { Origin: `http://127.0.0.1:${f.port}` });
  expect(result.status).toBe(200);
  expect(JSON.parse(result.body).status).toBe('ok');
  expect(result.headers['cache-control']).toBe('no-store');
  await Promise.all([f.listener.close(), f.listener.close()]);
  expect(f.shutdown).toHaveBeenCalledTimes(1);
});
