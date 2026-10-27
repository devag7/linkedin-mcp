/** Build an audited MCPB from a pinned public archive or explicit checkout candidate. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const fromSource = process.argv[2] === '--from-source';
const version = fromSource ? JSON.parse(readFileSync('package.json', 'utf8')).version : '4.1.2';
assert.match(version, /^\d+\.\d+\.\d+$/);
const expectedSha256 = '6a03ee1a415d064fb573455689e142c5cbec1f140040b66f5674dcab23370947';
const toolchain = '@anthropic-ai/mcpb@2.1.2';
const output = resolve(process.argv[fromSource ? 3 : 2] || join(tmpdir(), `linkedin-mcp-tools-${version}${fromSource ? '-candidate' : ''}.mcpb`));
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
  const packed = JSON.parse(npm(['pack', fromSource ? process.cwd() : `linkedin-mcp-tools@${version}`, '--json', '--pack-destination', scratch]))[0];
  assert.equal(packed.name, 'linkedin-mcp-tools');
  assert.equal(packed.version, version);
  const archive = join(scratch, packed.filename);
  const actualSha256 = createHash('sha256').update(readFileSync(archive)).digest('hex');
  if (!fromSource) assert.equal(actualSha256, expectedSha256, 'Public npm archive differs from approved release.');

  const bundle = join(scratch, 'bundle');
  mkdirSync(bundle);
  copyFileSync('packaging/claude-desktop/manifest.json', join(bundle, 'manifest.json'));
  copyFileSync('packaging/claude-desktop/README.md', join(bundle, 'README.md'));
  copyFileSync('LICENSE', join(bundle, 'LICENSE'));
  const manifest = JSON.parse(readFileSync(join(bundle, 'manifest.json'), 'utf8'));
  if (fromSource) {
    manifest.version = version;
    manifest.display_name += ' (unreleased candidate)';
    manifest.description = 'Unreleased source candidate; not the published npm artifact. ' + manifest.description;
    writeFileSync(join(bundle, 'README.md'), `# Unreleased LinkedIn MCP source candidate\n\nBuilt from the current checkout, version ${version}. These are not the public npm or MCPB bytes. Identify this build by the receipt archive and bundle SHA-256 values. It exposes 24 tools; cold protocol checks do not establish native-client or live-provider compatibility.\n\nLocal Node code runs with the user account permissions. Account access requires a separate manual login and scoped consent. Writes remain disabled by default. No application submission or full data erasure is provided. See https://github.com/devag7/linkedin-mcp/blob/main/docs/PRIVACY.md for retention and support details.\n`);
    writeFileSync(join(bundle, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
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
    bundle: output, sourceKind: fromSource ? 'checkout_candidate' : 'verified_public_npm',
    sourceVersion: version, sourceSha256: actualSha256,
    bundleSha256: createHash('sha256').update(readFileSync(output)).digest('hex'),
    productionFindings: 0,
  }) + '\n');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
