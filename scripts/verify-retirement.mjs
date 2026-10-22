/** Installed offline retirement flow against a disposable HOME and profile. */
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
import { join, resolve, sep } from 'node:path';

const bundle = resolve(process.argv[2] ?? 'dist/index.js');
const root = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-retirement-cli-')));
const home = join(root, 'home');
const profile = join(home, '.linkedin-mcp', 'profile');
mkdirSync(profile, { recursive: true });
writeFileSync(join(profile, 'Cookies'), 'PRIVATE-CREDENTIAL-CONTENT');
writeFileSync(`${profile}.circuit.json`, 'PRIVATE-CIRCUIT-CONTENT');
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
const run = (args, overrides = {}) =>
  spawnSync(process.execPath, [bundle, ...args], {
    cwd: root,
    env: { ...env, ...overrides },
    encoding: 'utf8',
    timeout: process.platform === 'win32' ? 45000 : 10000,
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
  assert.equal(report.applicationSupported, true);
  assert.equal(report.deletionAuthorized, false);
  assert.equal(report.proposed.files, 1);
  assert.equal(report.proposed.circuitPresent, true);
  assert.deepEqual(readdirSync(join(home, '.linkedin-mcp')).sort(), original);
  const cleanRecovery = run(['--retirement-recovery-preview']);
  assert.equal(cleanRecovery.status, 0);
  assert.equal(JSON.parse(cleanRecovery.stdout).status, 'no_interruption_marker');
  assert.ok(!cleanRecovery.stdout.includes(root) && !cleanRecovery.stdout.includes('PRIVATE'));
  for (const args of [
    ['--retirement-preview', '--live'],
    ['--retirement-preview', '--logout'],
    ['--retirement-preview', '--confirm-profile-deletion'],
    ['--erase-profile'],
    ['--retire-profile'],
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
  rmSync(`${profile}.owner.lock`, { recursive: true });
  const customWithoutConfirmation = run(['--retire-profile', '--confirm-retirement'], {
    LINKEDIN_PROFILE_DIR: profile,
  });
  assert.equal(customWithoutConfirmation.status, 1);
  assert.equal(readFileSync(join(profile, 'Cookies'), 'utf8'), 'PRIVATE-CREDENTIAL-CONTENT');
  const blankCustomWithoutConfirmation = run(['--retire-profile', '--confirm-retirement'], {
    LINKEDIN_PROFILE_DIR: '   ',
  });
  assert.equal(blankCustomWithoutConfirmation.status, 1);
  const applied = run(['--retire-profile', '--confirm-retirement']);
  if (process.platform === 'win32') {
    // The fake USERPROFILE deliberately differs from the real Windows account.
    // Native privacy enforcement must refuse before any selected-state mutation.
    assert.equal(applied.status, 1);
    assert.deepEqual(JSON.parse(applied.stdout), {
      status: 'refused',
      reason: 'WINDOWS_STATE_PRIVACY_UNVERIFIED_OUTSIDE_USER_PROFILE',
    });
    assert.equal(readFileSync(join(profile, 'Cookies'), 'utf8'), 'PRIVATE-CREDENTIAL-CONTENT');
    assert.equal(readFileSync(`${profile}.circuit.json`, 'utf8'), 'PRIVATE-CIRCUIT-CONTENT');
  } else {
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(JSON.parse(applied.stdout).status, 'retired');
    assert.ok(!readdirSync(join(home, '.linkedin-mcp')).includes('profile'));
    assert.ok(!readdirSync(join(home, '.linkedin-mcp')).includes('profile.circuit.json'));
  }
  assert.ok(!applied.stdout.includes(root) && !applied.stdout.includes('PRIVATE'));
  assert.equal(readFileSync(budget, 'utf8'), 'PRIVATE-SAFETY-CONTENT');
  const recoveryProfile = join(home, '.linkedin-mcp', 'recovery-profile');
  const recoveryName = 'recovery-profile.retirement-00000000-0000-4000-8000-000000000000';
  mkdirSync(join(home, '.linkedin-mcp', recoveryName));
  writeFileSync(join(home, '.linkedin-mcp', recoveryName, 'Cookies'), 'PRIVATE-RECOVERY');
  mkdirSync(`${recoveryProfile}.owner.lock`);
  writeFileSync(`${recoveryProfile}.retirement.json`, JSON.stringify({
    schemaVersion: 1,
    phase: 'started',
    scope: 'selected_profile',
    quarantine: recoveryName,
    circuitQuarantine: null,
  }));
  const recovery = run(['--retirement-recovery-preview'], {
    LINKEDIN_PROFILE_DIR: recoveryProfile,
  });
  assert.equal(recovery.status, 1, recovery.stderr);
  assert.deepEqual(JSON.parse(recovery.stdout).observed, {
    originalProfile: false,
    plannedProfileQuarantine: true,
    originalCircuit: false,
    plannedCircuitQuarantine: false,
    ownerLock: true,
    quarantinedFiles: 1,
    quarantinedDirectories: 1,
  });
  assert.ok(!recovery.stdout.includes(root) && !recovery.stdout.includes('PRIVATE'));
  assert.equal(readFileSync(budget, 'utf8'), 'PRIVATE-SAFETY-CONTENT');
  let nativeWindowsApply = 'not_applicable';
  if (process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true') {
    assert.ok(process.env.USERPROFILE, 'Native fixture needs the real Windows user profile.');
    const actualHome = resolve(process.env.USERPROFILE);
    assert.ok(root.toLowerCase().startsWith(`${actualHome.toLowerCase()}${sep}`),
      'Native apply fixture must stay beneath the real Windows user profile.');
    const nativeProfile = join(root, 'native', 'profile');
    mkdirSync(nativeProfile, { recursive: true });
    writeFileSync(join(nativeProfile, 'Cookies'), 'PRIVATE-NATIVE-FIXTURE');
    writeFileSync(`${nativeProfile}.circuit.json`, 'PRIVATE-NATIVE-CIRCUIT');
    const native = run(
      ['--retire-profile', '--confirm-retirement', '--confirm-profile-deletion'],
      { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE,
        LINKEDIN_PROFILE_DIR: nativeProfile },
    );
    assert.equal(native.status, 0, native.stderr);
    assert.equal(JSON.parse(native.stdout).status, 'retired');
    assert.ok(!native.stdout.includes(root) && !native.stdout.includes('PRIVATE'));
    assert.ok(!readdirSync(join(root, 'native')).includes('profile'));
    assert.ok(!readdirSync(join(root, 'native')).includes('profile.circuit.json'));
    nativeWindowsApply = 'passed_disposable_ci_user';
  }
  console.log(
    JSON.stringify({
      installedRetirementFlow: process.platform === 'win32' ? 'native_guard_refused' : 'passed',
      applicationSupported: true,
      nativeWindowsApply,
      accountRequests: 0,
      scope: 'disposable offline CLI and refusal fixtures',
    }),
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}
