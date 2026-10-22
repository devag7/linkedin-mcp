/** Build a disposable, pinned MCPB from the independently published npm archive. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const version = '4.1.1';
const expectedSha256 = '3aa33f9a38e2928625f9a7d24d300b644102c87121dc0168766048e1cf7368ec';
const toolchain = '@anthropic-ai/mcpb@2.1.2';
const output = resolve(process.argv[2] || join(tmpdir(), `linkedin-mcp-tools-${version}.mcpb`));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run through npm run build:claude-mcpb.');
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-mcpb-')));
if (process.platform === 'win32')
  assert.ok(process.env.USERPROFILE, 'Windows must expose its actual user profile.');
const run = (file, args, cwd = scratch) => execFileSync(file, args, {
  cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 3 * 1024 * 1024,
});
const npm = (args, cwd = scratch) => run(process.execPath, [npmCli, ...args], cwd);
async function verifyCold(folder) {
  const manifest = JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, version);
  const entry = join(folder, manifest.server.entry_point);
  assert.equal(existsSync(join(folder, 'node_modules/.package-lock.json')), false,
    'Disposable installer metadata must not be distributed.');
  assert.equal(run(process.execPath, [entry, '--version']).trim(), `linkedin-mcp v${version}`);
  const isolatedProfile = join(scratch, 'offline-profile');
  const client = new Client({ name: 'mcpb-offline-verifier', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    env: {
      PATH: process.env.PATH ?? '',
      HOME: scratch,
      USERPROFILE: process.platform === 'win32' ? process.env.USERPROFILE : scratch,
      LINKEDIN_PROFILE_DIR: isolatedProfile,
      LINKEDIN_ENABLE_WRITES: 'false',
      LOG_LEVEL: 'error',
    },
  });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 24, 'Pinned published package must expose 24 tools.');
    const who = await client.callTool({ name: 'whoami', arguments: {} });
    assert.equal(who.structuredContent?.data?.sessionState, 'not_checked');
    assert.equal(who.structuredContent?.data?.loggedIn, null);
    const oversized = await client.callTool({
      name: 'get_job_details',
      arguments: { job_id: '123', unused: Array(10_001).fill(null) },
    });
    assert.equal(oversized.isError, true, 'The packaged runtime must reject excessive inputs.');
    assert.ok(JSON.stringify(oversized.content).includes('maximum of 10000 elements'));
    assert.equal(existsSync(isolatedProfile), false, 'Cold discovery must not create a browser profile.');
  } finally {
    await client.close();
  }
}
try {
  const packed = JSON.parse(npm(['pack', `linkedin-mcp-tools@${version}`, '--json', '--pack-destination', scratch]))[0];
  assert.equal(packed.name, 'linkedin-mcp-tools');
  assert.equal(packed.version, version);
  const archive = join(scratch, packed.filename);
  const actualSha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');
  assert.equal(actualSha256, expectedSha256, 'Public npm archive differs from approved release.');

  const bundle = join(scratch, 'bundle');
  mkdirSync(bundle);
  copyFileSync('packaging/claude-desktop/manifest.json', join(bundle, 'manifest.json'));
  copyFileSync('packaging/claude-desktop/README.md', join(bundle, 'README.md'));
  copyFileSync('LICENSE', join(bundle, 'LICENSE'));
  const manifest = JSON.parse(readFileSync(join(bundle, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, version);
  writeFileSync(join(bundle, 'package.json'), JSON.stringify({
    name: 'linkedin-mcp-desktop-bundle', version, private: true,
    dependencies: { 'linkedin-mcp-tools': `file:${archive}` },
  }, null, 2) + '\n');
  npm(['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], bundle);
  const installed = JSON.parse(readFileSync(join(bundle, 'node_modules/linkedin-mcp-tools/package.json'), 'utf8'));
  assert.equal(installed.version, version);
  const audit = JSON.parse(npm(['audit', '--omit=dev', '--json'], bundle));
  assert.equal(audit.metadata.vulnerabilities.total, 0, 'Production dependencies must have zero audit findings.');
  // Installer metadata points to the disposable source tarball; runtime needs none of it.
  unlinkSync(join(bundle, 'package-lock.json'));
  unlinkSync(join(bundle, 'package.json'));
  rmSync(join(bundle, 'node_modules/.package-lock.json'), { force: true });
  await verifyCold(bundle);
  run(process.execPath, [npmCli, 'exec', '--yes', '--package', toolchain, '--', 'mcpb', 'validate', join(bundle, 'manifest.json')]);
  run(process.execPath, [npmCli, 'exec', '--yes', '--package', toolchain, '--', 'mcpb', 'pack', bundle, output]);
  const unpacked = join(scratch, 'unpacked');
  mkdirSync(unpacked);
  run(process.execPath, [npmCli, 'exec', '--yes', '--package', toolchain, '--', 'mcpb', 'unpack', output, unpacked]);
  await verifyCold(unpacked);
  process.stdout.write(JSON.stringify({
    bundle: output, sourceVersion: version, sourceSha256: actualSha256,
    bundleSha256: createHash('sha256').update(readFileSync(output)).digest('hex'),
    productionFindings: 0,
  }) + '\n');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
