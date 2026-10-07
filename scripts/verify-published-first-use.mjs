/** Published 3.0.0 installation/configuration proof; no browser or account reads. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertInventory, verifyTarball } from './package-policy.mjs';

const output = resolve(process.argv[2] ?? '');
assert.ok(process.argv[2], 'Supply a new private disposable output directory.');
assert.equal(existsSync(output), false, 'Refuse to overwrite previous evidence.');
mkdirSync(output, { recursive: true, mode: 0o700 });
const root = realpathSync(output);
const env = Object.fromEntries(
  [
    'PATH',
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'TMPDIR',
    'HOME',
    'USERPROFILE',
    'HOMEDRIVE',
    'HOMEPATH',
  ]
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
);
for (const name of ['user.npmrc', 'global.npmrc'])
  writeFileSync(join(root, name), '', { mode: 0o600 });
Object.assign(env, {
  NPM_CONFIG_CACHE: join(root, 'cache'),
  NPM_CONFIG_USERCONFIG: join(root, 'user.npmrc'),
  NPM_CONFIG_GLOBALCONFIG: join(root, 'global.npmrc'),
  NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/',
  LINKEDIN_PROFILE_DIR: join(root, 'empty profile with spaces'),
  LINKEDIN_ENABLE_WRITES: 'false',
  LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: 'false',
  LOG_LEVEL: 'error',
});
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const safetyPath = join(homedir(), '.linkedin-mcp', 'budgets.json');
const safetyHash = () => (existsSync(safetyPath) ? hash(readFileSync(safetyPath)) : null);
const before = safetyHash(); // No HOME substitution: shared safety storage is read-only here.
const run = (command, args, name, codes = [0]) => {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
  });
  writeFileSync(join(root, `${name}.stdout`), result.stdout ?? '', { mode: 0o600 });
  writeFileSync(join(root, `${name}.stderr`), result.stderr ?? '', { mode: 0o600 });
  assert.ok(
    codes.includes(result.status),
    `${name} failed: exit ${result.status}; inspect private logs.`,
  );
  return { value: result.stdout, elapsedMs: Date.now() - started };
};
// Run npm's JS entry through Node; never shell-interpolate a fixture path.
const npmCli =
  process.env.npm_execpath ??
  [
    join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    ...String(process.env.PATH ?? '')
      .split(delimiter)
      .map((dir) => join(dir, 'npm')),
  ]
    .filter(existsSync)
    .map((path) => realpathSync(path))
    .find((path) => path.endsWith('npm-cli.js'));
assert.ok(npmCli, 'Cannot locate npm CLI; invoke this script from npm exec -- node.');
const runNpm = (args, name) => run(process.execPath, [npmCli, ...args], name);
const prefix = join(root, 'installation');
const install = runNpm(
  ['install', '--prefix', prefix, 'linkedin-mcp-tools@3.0.0', '--no-fund'],
  'install',
);
const packageRoot = join(prefix, 'node_modules', 'linkedin-mcp-tools');
const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
assert.equal(pkg.version, '3.0.0');
const packed = JSON.parse(
  runNpm(['pack', 'linkedin-mcp-tools@3.0.0', '--json', '--pack-destination', root], 'download')
    .value,
)[0];
assertInventory(
  packed.files.map((file) => file.path),
  pkg,
);
const archive = join(root, packed.filename);
const archiveHash = hash(readFileSync(archive));
assert.equal(archiveHash, 'c79f78e5e77814febb3f68ab9a391ef860515bcfd2d6f97001eadd6e00f58fe5');
assert.equal(
  packed.integrity,
  `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}`,
);
const inventory = verifyTarball(archive, packageRoot, pkg);
const audit = JSON.parse(
  runNpm(['audit', '--omit=dev', '--json', '--prefix', prefix], 'consumer-audit').value,
);
assert.equal(audit.metadata.vulnerabilities.total, 0);
const sdkRoot = join(prefix, 'node_modules', '@modelcontextprotocol', 'sdk');
const { Client } = await import(pathToFileURL(join(sdkRoot, 'dist/esm/client/index.js')).href);
const { StdioClientTransport } = await import(
  pathToFileURL(join(sdkRoot, 'dist/esm/client/stdio.js')).href
);
const bundle = join(packageRoot, 'dist', 'index.js');
const doctor = JSON.parse(run(process.execPath, [bundle, '--doctor'], 'doctor', [0, 1]).value);
assert.equal(doctor.session, 'not_checked');
const flows = [];
for (const name of ['claude-desktop', 'cursor', 'vscode']) {
  const setup = run(process.execPath, [bundle, '--setup', name], `setup-${name}`, [0, 1]);
  const report = JSON.parse(setup.value);
  assert.equal(report.diagnosis.session, 'not_checked');
  assert.ok(report.configuration, 'Clean profile must produce configuration.');
  const exported = JSON.parse(
    run(process.execPath, [bundle, '--client-config', name], `config-${name}`).value,
  );
  assert.deepEqual(exported, report.configuration);
  const server = (exported.servers ?? exported.mcpServers).linkedin;
  assert.equal(server.env.LINKEDIN_ENABLE_WRITES, 'false');
  assert.equal(server.command, process.execPath);
  assert.deepEqual(server.args, [bundle]);
  const client = new Client({ name: 'published-offline-first-use', version: '1' });
  const transport = new StdioClientTransport({
    ...server,
    env: { ...env, ...server.env },
    stderr: 'pipe',
  });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 22);
    assert.ok(!tools.some((tool) => tool.name === 'research_jobs'));
    const identity = (await client.callTool({ name: 'whoami', arguments: {} })).structuredContent;
    assert.equal(identity.data.sessionState, 'not_checked');
    assert.equal(identity.data.loggedIn, null);
    assert.equal(
      (await client.callTool({ name: 'close_session', arguments: {} })).structuredContent.data
        .closed,
      true,
    );
    flows.push({
      clientConfiguration: name,
      setupStatus: report.status,
      setupMs: setup.elapsedMs,
      sdkDiscovery: 'passed',
      tools: tools.length,
      coldIdentity: 'not_checked',
      cleanup: 'passed',
    });
  } finally {
    await client.close();
  }
}
assert.equal(
  existsSync(env.LINKEDIN_PROFILE_DIR),
  false,
  'Cold checks must not create a Chrome profile.',
);
assert.equal(existsSync(`${env.LINKEDIN_PROFILE_DIR}.owner.lock`), false);
assert.equal(safetyHash(), before, 'Shared safety state changed during offline verification.');
const lock = JSON.parse(readFileSync(join(prefix, 'package-lock.json'), 'utf8'));
for (const [path, entry] of Object.entries(lock.packages)) {
  const minimum = path.endsWith('/@modelcontextprotocol/sdk')
    ? [1, 31, 0]
    : path.endsWith('/proxy-addr')
      ? [2, 0, 8]
      : null;
  if (!minimum) continue;
  const actual = JSON.parse(readFileSync(join(prefix, path, 'package.json'), 'utf8')).version;
  assert.equal(actual, entry.version);
  assert.match(actual, /^\d+\.\d+\.\d+$/);
  const parts = actual.split('.').map(Number);
  const diff = parts.findIndex((part, index) => part !== minimum[index]);
  assert.ok(diff === -1 || parts[diff] > minimum[diff], `Affected consumer dependency: ${path}`);
}
const evidence = {
  packageVersion: pkg.version,
  archiveHash,
  archiveIntegrity: packed.integrity,
  files: inventory.length,
  installedBundleHash: hash(readFileSync(bundle)),
  node: process.version,
  platform: process.platform,
  installMs: install.elapsedMs,
  consumerProductionFindings: audit.metadata.vulnerabilities.total,
  sdk: lock.packages['node_modules/@modelcontextprotocol/sdk'].version,
  proxyAddr: lock.packages['node_modules/proxy-addr'].version,
  flows,
  sharedSafetyStateUnchanged: true,
  linkedInRequests: 0,
  browserLaunches: 0,
  volunteerAttempts: 0,
  scope:
    'Fresh npm cache/config/prefix and empty profile; existing host Node/Chrome and read-only shared budget. SDK flows, not native client UI or live compatibility.',
};
writeFileSync(join(root, 'receipt.json'), JSON.stringify(evidence, null, 2) + '\n', {
  mode: 0o600,
});
console.log(JSON.stringify(evidence, null, 2));
