import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromeCandidates, diagnose, inspectSetup } from '../src/doctor.js';
import { loadConfig } from '../src/config/env.js';
import { CircuitFileStorage } from '../src/safety/circuit-storage.js';
import { CircuitBreaker } from '../src/safety/circuit-breaker.js';
import { BrowserSafetyError } from '../src/browser/safety.js';
import { VoyagerError } from '../src/browser/voyager.js';
import { SafetyStateError } from '../src/safety/state-lock.js';
import { VERSION } from '../src/version.js';
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'linkedin-doctor-'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
const server = { transport: 'stdio' as const, port: 3000, logLevel: 'error' as const };
function config() {
  return {
    ...loadConfig(),
    LINKEDIN_PROFILE_DIR: join(dir, 'nested', 'profile'),
    LINKEDIN_CHROME_PATH: join(dir, 'synthetic-chrome'),
  };
}
function storagePath() {
  return join(dir, 'budget.json');
}
function chrome() {
  writeFileSync(join(dir, 'synthetic-chrome'), 'fixture executable');
  chmodSync(join(dir, 'synthetic-chrome'), 0o700);
}

describe('offline setup diagnosis', () => {
  it('reports truthful cold state and version without creating profile, locks or budget files', async () => {
    chrome();
    const before = readdirSync(dir);
    const probe = vi.fn(async () => {});
    const report = await diagnose(config(), server, { storagePath: storagePath(), probe });
    expect(report.version).toBe(VERSION);
    expect(report.checks.chrome).toBe('available');
    expect(report.session).toBe('not_checked');
    expect(report.api).toBe('not_checked');
    expect(report.checks.profile).toBe('not_created');
    expect(report.checks.profileWritable).toBe(true);
    expect(readdirSync(dir)).toEqual(before);
    expect(probe).not.toHaveBeenCalled();
  });
  it('shows actionable missing Chrome and HTTP credential checks without revealing configured values', () => {
    vi.stubEnv('LINKEDIN_COOKIE', 'cookie-private-value');
    vi.stubEnv('LINKEDIN_ACCESS_TOKEN', 'oauth-private-value');
    vi.stubEnv('LINKEDIN_HTTP_TOKEN', 'http-private-short');
    const report = inspectSetup(config(), { ...server, transport: 'http' }, storagePath());
    expect(report.checks.chrome).toBe('missing');
    expect(report.checks.httpToken).toBe('missing_or_invalid');
    const text = JSON.stringify(report);
    expect(text).not.toMatch(
      /cookie-private-value|oauth-private-value|http-private-short|synthetic-chrome/,
    );
    expect(report.nextSteps.some((step) => step.includes('Install Google Chrome'))).toBe(true);
  });
  it('reports configured bearer authentication without printing the secret', () => {
    const secret = 'highly-private-http-token-fixture-32';
    vi.stubEnv('LINKEDIN_HTTP_TOKEN', secret);
    const report = inspectSetup(config(), { ...server, transport: 'http' }, storagePath());
    expect(report.checks.httpToken).toBe('configured');
    expect(JSON.stringify(report)).not.toContain(secret);
  });
  it('refuses a profile path that is a file', () => {
    const file = join(dir, 'not-a-directory');
    writeFileSync(file, 'fixture');
    const report = inspectSetup({ ...config(), LINKEDIN_PROFILE_DIR: file }, server, storagePath());
    expect(report.checks.profile).toBe('invalid');
    expect(report.checks.profileWritable).toBe(false);
  });
  it.each(['budget', 'circuit'])(
    'reports invalid %s state without resetting or probing it',
    async (state) => {
      const cfg = config();
      mkdirSync(cfg.LINKEDIN_PROFILE_DIR, { recursive: true });
      const file = state === 'budget' ? storagePath() : `${cfg.LINKEDIN_PROFILE_DIR}.circuit.json`;
      writeFileSync(file, '{}');
      const probe = vi.fn(async () => {});
      const report = await diagnose(cfg, server, { storagePath: storagePath(), live: true, probe });
      expect(report.checks.profile).toBe('exists');
      expect(report.checks.safetyState).toBe('invalid');
      expect(report.session).toBe('blocked');
      expect(probe).not.toHaveBeenCalled();
      expect(existsSync(file)).toBe(true);
    },
  );
  it('refuses an owned profile before a live probe', async () => {
    const cfg = config();
    mkdirSync(`${cfg.LINKEDIN_PROFILE_DIR}.owner.lock`, { recursive: true });
    const probe = vi.fn(async () => {});
    const report = await diagnose(cfg, server, { storagePath: storagePath(), live: true, probe });
    expect(report.session).toBe('profile_in_use');
    expect(probe).not.toHaveBeenCalled();
  });
  it('does not probe a persisted checkpoint', async () => {
    const cfg = config();
    const breaker = new CircuitBreaker({
      storage: new CircuitFileStorage(`${cfg.LINKEDIN_PROFILE_DIR}.circuit.json`),
    });
    breaker.trip('hard', undefined, 'fixture secret reason');
    const probe = vi.fn(async () => {});
    const report = await diagnose(cfg, server, { storagePath: storagePath(), live: true, probe });
    expect(report.session).toBe('blocked');
    expect(probe).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).not.toContain('fixture secret reason');
  });
});

describe('cross-platform Chrome path fixtures', () => {
  it.each([
    ['darwin', {}, ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']],
    ['linux', {}, ['/opt/google/chrome/chrome']],
    [
      'win32',
      { LOCALAPPDATA: 'C:\\Users\\Fixture\\AppData\\Local', PROGRAMFILES: 'C:\\Program Files' },
      [
        'C:\\Users\\Fixture\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      ],
    ],
    ['aix', {}, []],
  ] as const)('matches the installed driver channel lookup on %s', (platform, env, expected) => {
    expect(chromeCandidates(platform, env)).toEqual(expected);
  });
  it('explicit executable overrides the default channel candidates', () => {
    expect(chromeCandidates('darwin', {}, '/custom/chrome')).toEqual(['/custom/chrome']);
  });
});

it.each([
  [new VoyagerError('AUTH_REQUIRED', 'private provider error', 401), 'auth_required'],
  [new BrowserSafetyError('CHECKPOINT_REQUIRED', 'private checkpoint error'), 'blocked'],
  [new SafetyStateError('PROFILE_IN_USE', 'private ownership error'), 'profile_in_use'],
  [new Error('private diagnostic failure'), 'error'],
])('redacts failure details and classifies a selected live probe', async (error, session) => {
  const report = await diagnose(config(), server, {
    storagePath: storagePath(),
    live: true,
    probe: async () => {
      throw error;
    },
  });
  expect(report.session).toBe(session);
  expect(JSON.stringify(report)).not.toContain('private');
});
it('does not label a cookie/profile as a healthy API until the chosen probe succeeds', async () => {
  const probe = vi.fn(async () => {});
  const report = await diagnose(config(), server, {
    storagePath: storagePath(),
    live: true,
    probe,
  });
  expect(probe).toHaveBeenCalledTimes(1);
  expect(report.session).toBe('healthy');
  expect(report.api).toBe('ok');
});
it('reports a bounded probe deadline without claiming successful cancellation or API health', async () => {
  const report = await diagnose(config(), server, {
    storagePath: storagePath(),
    live: true,
    timeoutMs: 5,
    probe: () => new Promise(() => {}),
  });
  expect(report.session).toBe('timeout');
  expect(report.api).toBe('failed');
});

it('configuration validation names invalid fields without disclosing their values', () => {
  vi.stubEnv('LINKEDIN_HEADLESS', 'private-invalid-configuration');
  try {
    loadConfig();
    throw new Error('expected invalid configuration');
  } catch (error) {
    expect((error as Error).message).toContain('LINKEDIN_HEADLESS');
    expect((error as Error).message).not.toContain('private-invalid-configuration');
  }
});

it('reports an orphaned shared-budget lock and refuses a live probe without removing it', async () => {
  mkdirSync(`${storagePath()}.lock`);
  const probe = vi.fn(async () => {});
  const report = await diagnose(config(), server, {
    storagePath: storagePath(),
    live: true,
    probe,
  });
  expect(report.checks.budgetLocked).toBe(true);
  expect(report.session).toBe('blocked');
  expect(probe).not.toHaveBeenCalled();
  expect(existsSync(`${storagePath()}.lock`)).toBe(true);
});
