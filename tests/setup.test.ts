import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync, symlinkSync, lstatSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clientConfiguration, CLIENTS, setupReport } from '../src/setup.js';
import { loadConfig } from '../src/config/env.js';
const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })),
);

describe('installed-build client configuration', () => {
  it.each(CLIENTS)(
    'provides documented %s stdio format with explicit safe environment',
    (client) => {
      const dir = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-config-')));
      directories.push(dir);
      const config = {
        ...loadConfig(),
        LINKEDIN_PROFILE_DIR: join(dir, 'profile with spaces'),
        LINKEDIN_CHROME_PATH: join(dir, 'chrome with spaces'),
        LINKEDIN_ENABLE_WRITES: true,
        LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: true,
        TRANSPORT: 'http' as const,
      };
      const result = clientConfiguration(
        client,
        config,
        process.execPath,
        join(dir, 'installed build.js'),
      );
      const server = client === 'vscode' ? result.servers!.linkedin : result.mcpServers!.linkedin;
      expect(server.command).toBe(process.execPath);
      expect(server.args).toEqual([join(dir, 'installed build.js')]);
      expect(server.env).toMatchObject({
        TRANSPORT: 'stdio',
        LINKEDIN_PROVIDER: 'browser',
        LINKEDIN_ENABLE_WRITES: 'false',
        LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: 'false',
        LINKEDIN_PROFILE_DIR: config.LINKEDIN_PROFILE_DIR,
        LINKEDIN_CHROME_PATH: config.LINKEDIN_CHROME_PATH,
      });
      expect(Object.keys(server.env)).not.toContain('LINKEDIN_HTTP_TOKEN');
      expect(Object.keys(result)).toEqual([client === 'vscode' ? 'servers' : 'mcpServers']);
    },
  );
  it('does not generate a broken command without an installed entry', () => {
    expect(() => clientConfiguration('cursor', loadConfig(), process.execPath, '')).toThrow(
      'SETUP_ENTRY_MISSING',
    );
  });
});

it('returns actionable offline JSON for a broken profile alias without changing it', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-broken-')));
  directories.push(dir);
  const profile = join(dir, 'broken-profile');
  symlinkSync(
    join(dir, 'missing-target'),
    profile,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const report = setupReport('cursor', { ...loadConfig(), LINKEDIN_PROFILE_DIR: profile });
  expect(JSON.parse(JSON.stringify(report))).toMatchObject({
    status: 'needs_attention',
    configuration: null,
    commands: null,
    diagnosis: { checks: { profile: 'invalid' }, session: 'not_checked', api: 'not_checked' },
  });
  expect(report.diagnosis.nextSteps.join(' ')).toContain('broken symlink/junction');
  expect(lstatSync(profile).isSymbolicLink()).toBe(true);
  expect(existsSync(join(dir, 'missing-target'))).toBe(false);
});
