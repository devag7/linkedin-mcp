/** Package a local Claude plugin around the exact independently published runtime. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { copyPluginTemplate } from './claude-plugin-template.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = '4.1.1';
const expectedSha256 = '3aa33f9a38e2928625f9a7d24d300b644102c87121dc0168766048e1cf7368ec';
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run through npm run build:claude-plugin.');
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-plugin-build-')));
const output = process.argv[2] ? resolve(process.argv[2]) : join(
  mkdtempSync(join(tmpdir(), 'linkedin-plugin-output-')), `linkedin-mcp-local-${version}.zip`);
assert.equal(existsSync(output), false, 'Refusing to replace an existing archive.');
mkdirSync(dirname(output), { recursive: true });
const run = (file, args, cwd = scratch) => execFileSync(file, args, {
  cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 3 * 1024 * 1024,
});
const npm = (args, cwd = scratch) => run(process.execPath, [npmCli, ...args], cwd);
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const python = process.platform === 'win32' ? 'python' : 'python3';
const zipHelper = join(root, 'scripts/claude-plugin-zip.py');

async function verifyCold(folder) {
  const manifest = JSON.parse(readFileSync(join(folder, '.claude-plugin/plugin.json'), 'utf8'));
  const config = JSON.parse(readFileSync(join(folder, '.mcp.json'), 'utf8'));
  assert.equal(manifest.name, 'linkedin-mcp-local');
  assert.equal(manifest.version, version);
  assert.equal(existsSync(join(folder, 'bin')), false, 'Top-level bin prevents plugin installation.');
  assert.equal(existsSync(join(folder, 'package-lock.json')), false);
  assert.equal(existsSync(join(folder, 'package.json')), false);
  assert.equal(existsSync(join(folder, 'node_modules/.package-lock.json')), false);
  assert.deepEqual(Object.keys(config.mcpServers), ['linkedin-mcp-local']);
  const server = config.mcpServers['linkedin-mcp-local'];
  assert.deepEqual(server, {
    command: 'node',
    args: ['${CLAUDE_PLUGIN_ROOT}/node_modules/linkedin-mcp-tools/dist/index.js'],
    env: { LINKEDIN_ENABLE_WRITES: 'false' },
  });
  const entry = server.args[0].replace('${CLAUDE_PLUGIN_ROOT}', folder);
  assert.equal(run(process.execPath, [entry, '--version']).trim(), `linkedin-mcp v${version}`);
  const profile = join(scratch, 'never-created-offline-profile');
  const client = new Client({ name: 'plugin-offline-verifier', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath, args: [entry],
    env: {
      PATH: process.env.PATH ?? '', HOME: scratch,
      USERPROFILE: process.platform === 'win32' ? process.env.USERPROFILE : scratch,
      LINKEDIN_PROFILE_DIR: profile, ...server.env, LOG_LEVEL: 'error',
    },
  });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 24);
    assert.equal(tools.some((tool) => tool.name === 'research_jobs'), false);
    for (const name of ['prepare_job_application', 'export_application_tracker'])
      assert.ok(tools.some((tool) => tool.name === name));
    const who = await client.callTool({ name: 'whoami', arguments: {} });
    assert.equal(who.structuredContent?.data?.sessionState, 'not_checked');
    assert.equal(who.structuredContent?.data?.loggedIn, null);
    const large = await client.callTool({
      name: 'get_job_details', arguments: { job_id: '123', unused: Array(10_001).fill(null) },
    });
    assert.equal(large.isError, true);
    assert.ok(JSON.stringify(large.content).includes('maximum of 10000 elements'));
  } finally { await client.close(); }
  assert.equal(existsSync(profile), false, 'Offline verification must not create a browser profile.');
}

try {
  run(python, ['--version']);
  if (process.platform === 'win32') assert.ok(process.env.USERPROFILE);
  const packed = JSON.parse(npm(['pack', `linkedin-mcp-tools@${version}`, '--json', '--pack-destination', scratch]))[0];
  assert.equal(packed.name, 'linkedin-mcp-tools');
  assert.equal(packed.version, version);
  const archive = join(scratch, packed.filename);
  assert.equal(sha(archive), expectedSha256, 'Public runtime differs from approved release.');
  const folder = join(scratch, 'plugin');
  copyPluginTemplate(join(root, 'packaging/claude-plugin'), folder);
  copyFileSync(join(root, 'LICENSE'), join(folder, 'LICENSE'));
  writeFileSync(join(folder, 'package.json'), JSON.stringify({
    name: 'linkedin-mcp-local-plugin-builder', version, private: true,
    dependencies: { 'linkedin-mcp-tools': `file:${archive}` },
  }));
  npm(['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], folder);
  const installed = JSON.parse(readFileSync(join(folder, 'node_modules/linkedin-mcp-tools/package.json'), 'utf8'));
  assert.equal(installed.version, version);
  const audit = JSON.parse(npm(['audit', '--omit=dev', '--json'], folder));
  assert.equal(audit.metadata.vulnerabilities.total, 0);
  const lock = JSON.parse(readFileSync(join(folder, 'package-lock.json'), 'utf8'));
  const dependencies = Object.fromEntries(Object.entries(lock.packages)
    .filter(([path]) => path.startsWith('node_modules/')).map(([path, value]) => [path, value.version]));
  for (const path of ['package.json', 'package-lock.json', 'node_modules/.package-lock.json', 'node_modules/.bin'])
    rmSync(join(folder, path), { force: true, recursive: true });
  await verifyCold(folder);
  run(python, [zipHelper, 'pack', folder, output]);
  const unpacked = join(scratch, 'unpacked');
  mkdirSync(unpacked);
  run(python, [zipHelper, 'unpack', output, unpacked]);
  await verifyCold(unpacked);
  const hash = sha(output);
  writeFileSync(`${output}.sha256`, `${hash}  ${basename(output)}\n`, { flag: 'wx' });
  const receipt = {
    plugin: output, pluginSha256: hash, runtimeVersion: version, runtimeSha256: expectedSha256,
    tools: 24, productionFindings: 0, stagedAndUnpackedColdChecks: 'passed',
    nativeClient: 'not_tested', directory: 'not_submitted', dependencies,
  };
  writeFileSync(`${output}.receipt.json`, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify(receipt) + '\n');
} finally { rmSync(scratch, { recursive: true, force: true }); }
