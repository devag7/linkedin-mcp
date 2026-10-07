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
import { assertInventory, verifyTarball } from './package-policy.mjs';
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
  assertInventory(
    packed.files.map((entry) => entry.path),
    pkg,
  );
  const inventory = verifyTarball(join(dir, packed.filename), root, pkg);
  if (process.env.PACK_INVENTORY_OUTPUT)
    writeFileSync(process.env.PACK_INVENTORY_OUTPUT, JSON.stringify({ inventory }, null, 2) + '\n');
  // Also exercise the normal release path: prepack must not contaminate JSON.
  const normal = JSON.parse(runNpm(['pack', '--json', '--pack-destination', dir]))[0];
  assertInventory(
    normal.files.map((entry) => entry.path),
    pkg,
  );
  assert.deepEqual(verifyTarball(join(dir, normal.filename), root, pkg), inventory);
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
  // A consumer does not inherit this repository's lockfile or npm overrides.
  // Verify the actual fresh resolution, including any nested Express copies.
  const consumerLock = JSON.parse(readFileSync(join(install, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.dependencies['@modelcontextprotocol/sdk'], '^1.31.0',
    'The shipped SDK dependency must exclude the affected versions.');
  const assertInstalledFloor = (name, entry, minimum) => {
    const actual = JSON.parse(readFileSync(join(install, name, 'package.json'), 'utf8'));
    assert.equal(actual.version, entry.version, `Installed version differs from lock at ${name}`);
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(actual.version);
    assert.ok(match, `Unexpected installed version at ${name}`);
    const version = match.slice(1).map(Number);
    const firstDifference = version.findIndex((part, index) => part !== minimum[index]);
    assert.ok(firstDifference === -1 || version[firstDifference] > minimum[firstDifference],
      `Consumer resolved affected version ${actual.version} at ${name}`);
  };
  const sdks = Object.entries(consumerLock.packages).filter(
    ([name]) => name === 'node_modules/@modelcontextprotocol/sdk' ||
      name.endsWith('/node_modules/@modelcontextprotocol/sdk'),
  );
  assert.ok(sdks.length > 0, 'Expected the consumer SDK dependency.');
  for (const [name, entry] of sdks) assertInstalledFloor(name, entry, [1, 31, 0]);
  const proxies = Object.entries(consumerLock.packages).filter(
    ([name]) => name === 'node_modules/proxy-addr' || name.endsWith('/node_modules/proxy-addr'),
  );
  assert.ok(proxies.length > 0, 'Expected the SDK/Express proxy-addr dependency.');
  for (const [name, entry] of proxies) {
    assertInstalledFloor(name, entry, [2, 0, 8]);
  }
  const consumerAudit = JSON.parse(runNpm(['audit', '--omit=dev', '--json'], install));
  assert.equal(consumerAudit.metadata.vulnerabilities.total, 0, 'Consumer production audit must be clean.');
  const dependencyEvidence = {
    sdk: consumerLock.packages['node_modules/@modelcontextprotocol/sdk'].version,
    sdks: sdks.map(([path, entry]) => ({ path, version: entry.version })),
    proxies: proxies.map(([path, entry]) => ({ path, version: entry.version })),
    productionFindings: consumerAudit.metadata.vulnerabilities.total,
  };
  if (process.env.PACK_DEPENDENCY_OUTPUT)
    writeFileSync(process.env.PACK_DEPENDENCY_OUTPUT, JSON.stringify(dependencyEvidence, null, 2) + '\n');
  console.log(`Fresh consumer dependency verification: ${JSON.stringify(dependencyEvidence)}`);
  const bundle = join(install, 'node_modules', pkg.name, 'dist', 'index.js');
  assert.equal(
    execFileSync(process.execPath, [bundle, '--version'], {
      encoding: 'utf8',
      timeout: 10000,
    }).trim(),
    `linkedin-mcp v${pkg.version}`,
  );
  const shipped = readFileSync(bundle, 'utf8');
  if (pkg.version === '3.0.0') {
    const metadata = JSON.parse(readFileSync(join(install, 'node_modules', pkg.name, 'mcp-manifest.json'), 'utf8'));
    assert.equal(metadata.tools.length, 22, '3.0.0 is the approved 22-tool core release.');
    assert.ok(!metadata.tools.some((tool) => tool.name === 'research_jobs'));
    assert.ok(!shipped.includes('research_jobs'), 'The deferred research tool must not enter the core bundle.');
  }

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
