/** Exercise the installed CLI using only disposable home/profile state. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const bundle = resolve(process.argv[2] ?? 'dist/index.js');
const root = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-data-inventory-')));
const home = join(root, 'private-home');
const state = join(home, '.linkedin-mcp');
const profile = join(state, 'profile');
mkdirSync(home);
const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  LINKEDIN_PROFILE_DIR: '',
  LINKEDIN_PROVIDER: 'invalid-provider',
  LINKEDIN_HTTP_TOKEN: 'SECRET-token',
  LINKEDIN_CHROME_PATH: 'SECRET-path',
};
const run = (args = ['--data-inventory'], overrides = {}) =>
  spawnSync(process.execPath, [bundle, ...args], {
    cwd: root,
    env: { ...env, ...overrides },
    encoding: 'utf8',
    timeout: 10000,
  });
const checked = (result, status) => {
  assert.equal(result.status, status, 'Unexpected inventory exit status');
  assert.equal(result.stderr, '');
  assert.ok(
    !result.stdout.includes(root) && !result.stdout.includes('SECRET'),
    'Private fixture data leaked',
  );
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'offline_metadata_inventory');
  assert.equal(report.erasurePreview.supported, false);
  assert.equal(report.erasurePreview.deletionAuthorized, false);
  assert.equal(report.entries.length, 6);
  assert.ok(
    report.entries.every((e) => e.content === 'not_inspected' && e.ownership === 'unverified'),
  );
  return report;
};
try {
  assert.ok(checked(run(), 0).entries.every((e) => e.observation === 'absent'));
  assert.deepEqual(readdirSync(home), []);
  mkdirSync(profile, { recursive: true });
  const files = [
    join(profile, 'Cookies'),
    `${profile}.circuit.json`,
    join(state, 'budgets.json'),
    join(state, 'credentials.json'),
  ];
  files.forEach((file) => writeFileSync(file, 'SECRET-content-not-valid-json'));
  const before = files.map((file) => readFileSync(file));
  assert.equal(checked(run(), 0).status, 'observed');
  for (const lock of [`${profile}.owner.lock`, join(state, 'budgets.json.lock')]) {
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner.json'), 'SECRET-owner-malformed');
  }
  const locked = checked(run(), 1);
  assert.equal(locked.status, 'needs_attention');
  assert.equal(locked.entries.filter((e) => e.reason === 'LOCK_OWNERSHIP_UNVERIFIED').length, 2);
  files.forEach((file, i) => assert.deepEqual(readFileSync(file), before[i]));
  assert.equal(
    readFileSync(join(`${profile}.owner.lock`, 'owner.json'), 'utf8'),
    'SECRET-owner-malformed',
  );
  const outside = join(root, 'outside');
  mkdirSync(outside);
  writeFileSync(join(outside, 'sentinel'), 'preserved');
  const alias = join(root, 'alias');
  symlinkSync(outside, alias, process.platform === 'win32' ? 'junction' : 'dir');
  const aliased = checked(run(undefined, { LINKEDIN_PROFILE_DIR: alias }), 1);
  assert.equal(aliased.entries[0].reason, 'ALIAS_REFUSED');
  const broken = join(root, 'broken');
  symlinkSync(
    join(root, 'missing-target'),
    broken,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  assert.equal(
    checked(run(undefined, { LINKEDIN_PROFILE_DIR: broken }), 1).entries[0].reason,
    'ALIAS_REFUSED',
  );
  assert.equal(readFileSync(join(outside, 'sentinel'), 'utf8'), 'preserved');
  for (const args of [
    ['--data-inventory', '--live'],
    ['--data-inventory', '--logout'],
    ['--data-inventory', '--confirm-profile-deletion'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.ok(!result.stderr.includes(root) && !result.stderr.includes('SECRET'));
  }
  files.forEach((file, i) => assert.deepEqual(readFileSync(file), before[i]));
  console.log(
    JSON.stringify({
      installedDataInventory: 'passed',
      scope: 'offline disposable metadata only',
      deletionSupported: false,
      accountRequests: 0,
    }),
  );
} finally {
  rmSync(root, { force: true, recursive: true });
}
