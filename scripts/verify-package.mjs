/** Install and exercise the packed artifact in isolation. Never contacts LinkedIn. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = process.cwd();
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run through npm run verify:package to select the active npm CLI.');
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-packed-')));
const runNpm = (args, cwd = root) =>
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 2 * 1024 * 1024,
  });
try {
  const packed = JSON.parse(
    runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', dir]),
  )[0];
  assert.equal(packed.name, pkg.name);
  assert.equal(packed.version, pkg.version);
  assert.ok(packed.files.some((entry) => entry.path === 'dist/index.js'));
  assert.ok(
    packed.files.some((entry) => entry.path === 'LICENSE'),
    'The packed release must include LICENSE.',
  );
  assert.equal(readFileSync(join(root, 'LICENSE'), 'utf8').startsWith('MIT License'), true);
  const install = join(dir, 'install');
  mkdirSync(install);
  writeFileSync(
    join(install, 'package.json'),
    JSON.stringify({ name: 'offline-artifact-verification', version: '1.0.0', private: true }),
  );
  runNpm(
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', join(dir, packed.filename)],
    install,
  );
  const bundle = join(install, 'node_modules', pkg.name, 'dist', 'index.js');
  assert.equal(
    execFileSync(process.execPath, [bundle, '--version'], {
      encoding: 'utf8',
      timeout: 10000,
    }).trim(),
    `linkedin-mcp v${pkg.version}`,
  );
  const shipped = readFileSync(bundle, 'utf8');
  for (const inactive of [
    'AuthManager',
    'LINKEDIN_ACCESS_TOKEN',
    'LINKEDIN_COOKIE',
    'CACHE_TTL',
    'LINKEDIN_PACING_DISABLED',
  ])
    assert.ok(
      !shipped.includes(inactive),
      `Inactive legacy configuration leaked into the shipped runtime: ${inactive}`,
    );
  const profile = join(dir, 'doctor-profile');
  const secrets = [
    'synthetic-cookie-secret',
    'synthetic-oauth-secret',
    'synthetic-http-secret-32-characters',
  ];
  const doctor = spawnSync(process.execPath, [bundle, '--doctor'], {
    env: {
      ...process.env,
      LINKEDIN_PROFILE_DIR: profile,
      LINKEDIN_CHROME_PATH: join(dir, 'nonexistent-chrome'),
      LINKEDIN_COOKIE: secrets[0],
      LINKEDIN_ACCESS_TOKEN: secrets[1],
      LINKEDIN_HTTP_TOKEN: secrets[2],
    },
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(doctor.status, 1, doctor.stderr); // Missing Chrome is an actionable failure.
  const report = JSON.parse(doctor.stdout);
  assert.equal(report.version, pkg.version);
  assert.equal(report.session, 'not_checked');
  assert.equal(report.checks.chrome, 'missing');
  for (const secret of secrets) assert.ok(!(doctor.stdout + doctor.stderr).includes(secret));
  const invalid = spawnSync(process.execPath, [bundle, '--doctor'], {
    env: { ...process.env, LINKEDIN_HEADLESS: 'private-value-in-invalid-setting' },
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(invalid.status, 1);
  assert.ok((invalid.stdout + invalid.stderr).includes('LINKEDIN_HEADLESS'));
  assert.ok(!(invalid.stdout + invalid.stderr).includes('private-value-in-invalid-setting'));
  for (const args of [
    ['--doctor', '--port', 'synthetic-cli-secret'],
    ['--doctor', '--transport', 'synthetic-cli-secret'],
    ['--doctor', 'synthetic-cli-secret'],
  ]) {
    const invalidCli = spawnSync(process.execPath, [bundle, ...args], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(invalidCli.status, 1);
    assert.ok(!(invalidCli.stdout + invalidCli.stderr).includes('synthetic-cli-secret'));
  }
  const override = spawnSync(process.execPath, [bundle, '--doctor', '--transport', 'stdio'], {
    env: {
      ...process.env,
      TRANSPORT: 'http',
      LINKEDIN_PROFILE_DIR: profile,
      LINKEDIN_CHROME_PATH: join(dir, 'nonexistent-chrome'),
    },
    encoding: 'utf8',
    timeout: 10000,
  });
  const selected = JSON.parse(override.stdout);
  assert.equal(selected.transport, 'stdio');
  assert.equal(selected.checks.httpToken, 'not_required');
  const conflict = spawnSync(process.execPath, [bundle, '--doctor', '--logout'], {
    env: { ...process.env, LINKEDIN_PROFILE_DIR: profile },
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(conflict.status, 1);
  assert.ok(conflict.stderr.includes('Choose only one CLI command'));
  mkdirSync(profile);
  writeFileSync(join(profile, 'synthetic-profile-data'), 'fixture');
  const refusal = spawnSync(process.execPath, [bundle, '--logout'], {
    env: { ...process.env, LINKEDIN_PROFILE_DIR: profile },
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(refusal.status, 1);
  assert.ok(refusal.stderr.includes('custom profile'));
  assert.equal(readFileSync(join(profile, 'synthetic-profile-data'), 'utf8'), 'fixture');
  const erase = spawnSync(process.execPath, [bundle, '--logout', '--confirm-profile-deletion'], {
    env: { ...process.env, LINKEDIN_PROFILE_DIR: profile },
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(erase.status, 0, erase.stderr);
  assert.equal(existsSync(profile), false);
  // Default-path regression uses a disposable HOME/USERPROFILE, never real account state.
  const fixtureHome = join(dir, 'alias-home');
  mkdirSync(join(fixtureHome, '.linkedin-mcp'), { recursive: true });
  const outside = join(dir, 'outside-profile');
  mkdirSync(outside);
  writeFileSync(join(outside, 'sentinel'), 'preserved');
  symlinkSync(
    outside,
    join(fixtureHome, '.linkedin-mcp', 'profile'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const aliased = spawnSync(process.execPath, [bundle, '--logout'], {
    env: { ...process.env, HOME: fixtureHome, USERPROFILE: fixtureHome, LINKEDIN_PROFILE_DIR: '' },
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(aliased.status, 1, aliased.stderr);
  assert.equal(readFileSync(join(outside, 'sentinel'), 'utf8'), 'preserved');
  process.stdout.write(
    execFileSync(process.execPath, [resolve('scripts/verify-setup.mjs'), bundle], {
      encoding: 'utf8',
      timeout: 30000,
    }),
  );
  const smoke = execFileSync(
    process.execPath,
    [resolve('tests/built-artifact-smoke.mjs'), bundle],
    { encoding: 'utf8', timeout: 30000 },
  );
  process.stdout.write(smoke);
  process.stdout.write(
    JSON.stringify({
      packedArtifact: 'passed',
      name: pkg.name,
      version: pkg.version,
      platform: process.platform,
      node: process.version,
      licenseIncluded: packed.files.some((entry) => entry.path === 'LICENSE'),
    }) + '\n',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
