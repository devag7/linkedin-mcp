import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext } from 'patchright';
import { BrowserEngine } from '../src/browser/engine.js';
import { BrowserSafety } from '../src/browser/safety.js';
import { CircuitBreaker } from '../src/safety/circuit-breaker.js';
import { loadConfig } from '../src/config/env.js';
import { Logger } from '../src/types.js';
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'linkedin-engine-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});
function engine() {
  return new BrowserEngine(
    { ...loadConfig(), LINKEDIN_PROFILE_DIR: dir, LINKEDIN_IDLE_TIMEOUT_MS: 0 },
    new Logger('error'),
    false,
    new BrowserSafety(new CircuitBreaker()),
  );
}
it('disposal prevents a queued caller from relaunching a browser', async () => {
  const launch = vi.spyOn(chromium, 'launchPersistentContext');
  const e = engine();
  await e.dispose();
  await expect(e.ensureContext()).rejects.toThrow('shutting down');
  expect(launch).not.toHaveBeenCalled();
});
it('disposal reaps a context whose launch was already in progress', async () => {
  let finish!: (context: BrowserContext) => void;
  vi.spyOn(chromium, 'launchPersistentContext').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const close = vi.fn(async () => {});
  const context = { close, browser: () => null } as unknown as BrowserContext;
  const e = engine();
  const launching = e.ensureContext();
  const disposing = e.dispose();
  finish(context);
  await launching;
  await disposing;
  expect(close).toHaveBeenCalledTimes(1);
  await expect(e.ensureContext()).rejects.toThrow('shutting down');
});

it('keeps exclusive ownership through an idle close and releases only on final disposal', async () => {
  vi.spyOn(chromium, 'launchPersistentContext').mockResolvedValue({
    close: async () => {},
    browser: () => null,
  } as unknown as BrowserContext);
  const first = engine();
  const second = engine();
  await first.ensureContext();
  await first.shutdown();
  await expect(second.ensureContext()).rejects.toMatchObject({ code: 'PROFILE_IN_USE' });
  await first.dispose();
  await second.ensureContext();
  await second.dispose();
});
it('releases initial ownership when launch fails', async () => {
  const launch = vi
    .spyOn(chromium, 'launchPersistentContext')
    .mockRejectedValue(new Error('fixture launch failure'));
  const first = engine();
  await expect(first.ensureContext()).rejects.toThrow('fixture launch failure');
  launch.mockResolvedValue({
    close: async () => {},
    browser: () => null,
  } as unknown as BrowserContext);
  const next = engine();
  await next.ensureContext();
  await next.dispose();
  await first.dispose();
});
it('cannot release ownership while a concurrent shutdown is still closing Chrome', async () => {
  let finish!: () => void;
  vi.spyOn(chromium, 'launchPersistentContext').mockResolvedValue({
    close: () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    browser: () => null,
  } as unknown as BrowserContext);
  const first = engine();
  await first.ensureContext();
  const closing = first.shutdown();
  const disposing = first.dispose();
  const second = engine();
  await expect(second.ensureContext()).rejects.toMatchObject({ code: 'PROFILE_IN_USE' });
  finish();
  await closing;
  await disposing;
  vi.spyOn(chromium, 'launchPersistentContext').mockResolvedValue({
    close: async () => {},
    browser: () => null,
  } as unknown as BrowserContext);
  await second.ensureContext();
  await second.dispose();
});
it('retains ownership when browser shutdown cannot be verified', async () => {
  vi.spyOn(chromium, 'launchPersistentContext').mockResolvedValue({
    close: async () => {
      throw new Error('fixture close failure');
    },
    browser: () => null,
  } as unknown as BrowserContext);
  const first = engine();
  await first.ensureContext();
  await expect(first.dispose()).rejects.toMatchObject({ code: 'STATE_INVALID' });
  await expect(first.dispose()).rejects.toMatchObject({ code: 'STATE_INVALID' });
  await expect(engine().ensureContext()).rejects.toMatchObject({ code: 'PROFILE_IN_USE' });
});
it('refreshes a stop persisted after runtime construction before launching', async () => {
  const { CircuitFileStorage, circuitStatePath } = await import('../src/safety/circuit-storage.js');
  const path = circuitStatePath(dir);
  const breaker = new CircuitBreaker({ storage: new CircuitFileStorage(path) });
  const e = new BrowserEngine(
    { ...loadConfig(), LINKEDIN_PROFILE_DIR: dir },
    new Logger('error'),
    false,
    new BrowserSafety(breaker),
  );
  const other = new CircuitBreaker({ storage: new CircuitFileStorage(path) });
  other.trip('hard', undefined, 'Synthetic checkpoint');
  const launch = vi.spyOn(chromium, 'launchPersistentContext');
  await expect(e.ensureContext()).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
  expect(launch).not.toHaveBeenCalled();
  await e.dispose();
});
