/** Build a disposable, pinned MCPB from the independently published npm archive. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const version = '4.0.0';
const expectedSha256 = '4f08eb94eb97cdb2c2baf1a3643651397c83251f017d9bb4331cd511fd885e28';
const toolchain = '@anthropic-ai/mcpb@2.1.2';
const output = resolve(process.argv[2] || join(tmpdir(), `linkedin-mcp-tools-${version}.mcpb`));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run through npm run build:claude-mcpb.');
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-mcpb-')));
const run = (file, args, cwd = scratch) => execFileSync(file, args, {
  cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 3 * 1024 * 1024,
});
const npm = (args, cwd = scratch) => run(process.execPath, [npmCli, ...args], cwd);
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
  // Installer metadata points to the disposable source tarball; runtime needs neither file.
  unlinkSync(join(bundle, 'package-lock.json'));
  unlinkSync(join(bundle, 'package.json'));
  assert.equal(run(process.execPath, [join(bundle, manifest.server.entry_point), '--version']).trim(),
    `linkedin-mcp v${version}`);
  const isolatedProfile = join(scratch, 'offline-profile');
  const client = new Client({ name: 'mcpb-offline-verifier', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(bundle, manifest.server.entry_point)],
    env: {
      PATH: process.env.PATH ?? '',
      HOME: scratch,
      USERPROFILE: scratch,
      LINKEDIN_PROFILE_DIR: isolatedProfile,
      LINKEDIN_ENABLE_WRITES: 'false',
      LOG_LEVEL: 'error',
    },
  });
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 22, 'Pinned published package must expose 22 tools.');
    const who = await client.callTool({ name: 'whoami', arguments: {} });
    assert.equal(who.structuredContent?.data?.sessionState, 'not_checked');
    assert.equal(who.structuredContent?.data?.loggedIn, null);
    assert.equal(existsSync(isolatedProfile), false, 'Cold discovery must not create a browser profile.');
  } finally {
    await client.close();
  }
  run(process.execPath, [npmCli, 'exec', '--yes', '--package', toolchain, '--', 'mcpb', 'validate', join(bundle, 'manifest.json')]);
  run(process.execPath, [npmCli, 'exec', '--yes', '--package', toolchain, '--', 'mcpb', 'pack', bundle, output]);
  process.stdout.write(JSON.stringify({
    bundle: output, sourceVersion: version, sourceSha256: actualSha256,
    bundleSha256: createHash('sha256').update(readFileSync(output)).digest('hex'),
    productionFindings: 0,
  }) + '\n');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
