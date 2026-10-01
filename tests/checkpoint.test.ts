import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from 'patchright';
import type { BrowserEngine } from '../src/browser/engine.js';
import { BrowserSafety } from '../src/browser/safety.js';
import { VoyagerClient } from '../src/browser/voyager.js';
import { verifyLoginAndReset } from '../src/browser/recovery.js';
import { CircuitBreaker } from '../src/safety/circuit-breaker.js';
import { CircuitFileStorage } from '../src/safety/circuit-storage.js';
import { Logger } from '../src/types.js';
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'linkedin-checkpoint-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});
const logger = new Logger('error');
const raw = (values = {}) => ({
  status: 200,
  ok: true,
  type: 'basic',
  url: 'https://www.linkedin.com/voyager/api/me',
  body: '{}',
  ...values,
});
function fixture(result = raw()) {
  const storage = new CircuitFileStorage(join(dir, 'circuit.json'));
  const breaker = new CircuitBreaker({ storage });
  const evaluate = vi.fn(async () => result);
  const engine = { getFeedPage: async () => ({ evaluate }) as unknown as Page } as BrowserEngine;
  const voyager = new VoyagerClient(engine, logger, new BrowserSafety(breaker));
  return { storage, breaker, evaluate, voyager };
}
it.each([
  raw({ status: 999, ok: false }),
  raw({ body: '<html>captcha PRIVATE_MESSAGE</html>' }),
  raw({
    status: 403,
    ok: false,
    body: '{"message":"unusual activity on your account PRIVATE_MESSAGE"}',
  }),
  raw({ url: 'https://www.linkedin.com/checkpoint/challenge/PRIVATE_ID?token=SECRET' }),
])('persists a redacted hard stop before returning raw responses: %j', async (result) => {
  const f = fixture(result);
  await expect(f.voyager.voyagerGet('/me')).rejects.toMatchObject({ code: 'CHECKPOINT_REQUIRED' });
  expect(readFileSync(f.storage.filePath, 'utf8')).not.toMatch(/PRIVATE|SECRET/);
  expect(new CircuitBreaker({ storage: f.storage }).canProceed('read').ok).toBe(false);
  await expect(f.voyager.voyagerPostRaw('/fixture', {})).rejects.toMatchObject({
    code: 'CIRCUIT_OPEN',
  });
  expect(f.evaluate).toHaveBeenCalledTimes(1);
});
it.each(['voyagerPostRaw', 'voyagerDeleteRaw', 'voyagerPost', 'voyagerGraphql'] as const)(
  'hard-stops %s',
  async (method) => {
    const f = fixture(raw({ status: 999, ok: false }));
    const task =
      method === 'voyagerGraphql'
        ? f.voyager.voyagerGraphql('fixture', '')
        : method === 'voyagerDeleteRaw'
          ? f.voyager.voyagerDeleteRaw('/fixture')
          : f.voyager[method]('/fixture', {});
    await expect(task).rejects.toMatchObject({ code: 'CHECKPOINT_REQUIRED' });
    expect(f.breaker.isGlobalOpen()).toBe(true);
  },
);
it.each([
  raw({ status: 401, ok: false, body: '<html>Sign in</html>' }),
  raw({ status: 0, ok: false, type: 'opaqueredirect', url: '', body: '' }),
  raw({ url: 'https://www.linkedin.com/uas/login', body: '<html>Sign in</html>' }),
])('separates ordinary authentication failure from checkpoints: %j', async (result) => {
  const f = fixture(result);
  await expect(f.voyager.voyagerGet('/me')).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  expect(f.breaker.isGlobalOpen()).toBe(false);
});
it('does not scan successful user content for challenge words', async () => {
  const f = fixture(raw({ body: '{"text":"captcha and unusual activity"}' }));
  expect(await f.voyager.voyagerGet('/me')).toEqual({ text: 'captcha and unusual activity' });
  expect(f.breaker.isGlobalOpen()).toBe(false);
});
it('detects checkpoint URLs before a destroyed DOM context can hide them', async () => {
  const f = fixture();
  const evaluate = vi.fn(async () => {
    throw new Error('context destroyed');
  });
  const page = {
    url: () => 'https://www.linkedin.com/checkpoint/challenge',
    evaluate,
  } as unknown as Page;
  await expect(new BrowserSafety(f.breaker).inspectPage(page)).rejects.toMatchObject({
    code: 'CHECKPOINT_REQUIRED',
  });
  expect(evaluate).not.toHaveBeenCalled();
});
it.each(['{', '{}'])('fails closed on invalid persisted circuit state: %s', (text) => {
  const f = fixture();
  writeFileSync(f.storage.filePath, text);
  expect(() => new CircuitBreaker({ storage: f.storage })).toThrow('unreadable or invalid');
});
it.each([
  ['https://www.linkedin.com/feed/', true, true],
  ['https://www.linkedin.com/feed/', false, false],
  ['https://www.linkedin.com/feedback', true, false],
  ['https://www.linkedin.com/checkpoint/challenge', true, false],
])(
  'requires a clean feed and verified identity for manual recovery: %s %s',
  async (url, identity, expected) => {
    const f = fixture();
    f.breaker.trip('hard');
    const page = {
      url: () => url,
      evaluate: vi.fn(async (_fn, args) =>
        args
          ? raw({
              body: JSON.stringify({
                data: {},
                included: identity ? [{ publicIdentifier: 'fixture' }] : [],
              }),
            })
          : 'LinkedIn',
      ),
    } as unknown as Page;
    const engine = { isLoggedIn: async () => true, getFeedPage: async () => page } as BrowserEngine;
    expect(await verifyLoginAndReset(engine, f.breaker, logger)).toBe(expected);
    expect(f.breaker.isGlobalOpen()).toBe(!expected);
  },
);

it('reports a local read deadline separately from auth failure or checkpoint', async () => {
  const f = fixture(raw({ status: 0, ok: false, type: 'timeout', body: '', timedOut: true }));
  await expect(f.voyager.voyagerGet('/fixture')).rejects.toMatchObject({ code: 'TIMEOUT' });
  expect(f.breaker.isGlobalOpen()).toBe(false);
});
