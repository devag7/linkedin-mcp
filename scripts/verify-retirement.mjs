/** Installed preview only, with disposable HOME and profile. No transaction application. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  realpathSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const bundle = resolve(process.argv[2] ?? 'dist/index.js');
const root = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-retirement-cli-')));
const home = join(root, 'home');
const profile = join(home, '.linkedin-mcp', 'profile');
mkdirSync(profile, { recursive: true });
writeFileSync(join(profile, 'Cookies'), 'PRIVATE-CREDENTIAL-CONTENT');
const budget = join(home, '.linkedin-mcp', 'budgets.json');
writeFileSync(budget, 'PRIVATE-SAFETY-CONTENT');
const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  LINKEDIN_PROFILE_DIR: '',
  LINKEDIN_PROVIDER: 'invalid-provider',
  LINKEDIN_CHROME_PATH: 'DO-NOT-OPEN',
  LINKEDIN_HTTP_TOKEN: 'PRIVATE',
};
const run = (args) =>
  spawnSync(process.execPath, [bundle, ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 10000,
  });
try {
  const original = readdirSync(join(home, '.linkedin-mcp')).sort();
  const result = run(['--retirement-preview']);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.ok(!result.stdout.includes(root) && !result.stdout.includes('PRIVATE'));
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'offline_retirement_preview');
  assert.equal(report.status, 'preview_only');
  assert.equal(report.applicationSupported, false);
  assert.equal(report.deletionAuthorized, false);
  assert.equal(report.proposed.files, 1);
  assert.deepEqual(readdirSync(join(home, '.linkedin-mcp')).sort(), original);
  for (const args of [
    ['--retirement-preview', '--live'],
    ['--retirement-preview', '--logout'],
    ['--retirement-preview', '--confirm-profile-deletion'],
    ['--erase-profile'],
  ]) {
    const rejected = run(args);
    assert.equal(rejected.status, 1);
    assert.equal(rejected.stdout, '');
    assert.ok(!rejected.stderr.includes(root) && !rejected.stderr.includes('PRIVATE'));
  }
  mkdirSync(`${profile}.owner.lock`);
  const locked = run(['--retirement-preview']);
  assert.equal(locked.status, 1);
  assert.equal(JSON.parse(locked.stdout).reason, 'LOCK_OWNERSHIP_UNVERIFIED');
  assert.equal(readFileSync(join(profile, 'Cookies'), 'utf8'), 'PRIVATE-CREDENTIAL-CONTENT');
  assert.equal(readFileSync(budget, 'utf8'), 'PRIVATE-SAFETY-CONTENT');
  console.log(
    JSON.stringify({
      installedRetirementPreview: 'passed',
      applicationSupported: false,
      accountRequests: 0,
      scope: 'disposable offline CLI and refusal fixtures',
    }),
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
