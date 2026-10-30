/** Exercise the declared npm launcher in disposable storage; never installs a Claude plugin. */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { assertSourceVerifierEnvironment, inspectSourcePlugin } from './claude-source-plugin.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
assertSourceVerifierEnvironment(process.platform, process.env);
const { server } = inspectSourcePlugin(repository);
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run through npm exec -- node scripts/verify-claude-source-plugin.mjs.');
const scratch = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-source-plugin-')));
const profile = join(scratch, 'never-created-profile');
const npmConfig = join(scratch, 'empty-npmrc');
writeFileSync(npmConfig, '');
const env = {
  PATH: process.env.PATH ?? '', HOME: scratch,
  USERPROFILE: process.platform === 'win32' ? process.env.USERPROFILE ?? scratch : scratch,
  TMP: process.env.TMP ?? scratch, TEMP: process.env.TEMP ?? scratch,
  npm_config_cache: join(scratch, 'npm-cache'), npm_config_userconfig: npmConfig,
  npm_config_globalconfig: join(scratch, 'absent-global-npmrc'),
  npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false',
  LINKEDIN_PROFILE_DIR: profile, LINKEDIN_CHROME_PATH: join(scratch, 'absent-chrome'),
  LINKEDIN_ENABLE_WRITES: 'true', LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: 'true',
  ...server.env, LOG_LEVEL: 'error',
};
for (const key of ['SystemRoot', 'SYSTEMROOT', 'COMSPEC', 'PATHEXT'])
  if (process.env[key]) env[key] = process.env[key];
const client = new Client({ name: 'source-plugin-launcher-verifier', version: '1' });
const transport = new StdioClientTransport({
  command: server.command, args: server.args, cwd: scratch, env, stderr: 'pipe',
});
// Drain installation warnings without retaining or publishing raw child output.
transport.stderr?.resume();
try {
  // Network here is npm dependency installation. Tool calls below are cold/local only.
  await client.connect(transport, { timeout: 180000 });
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 24);
  assert.equal(tools.some((tool) => tool.name === 'research_jobs'), false);
  const status = await client.callTool({ name: 'whoami', arguments: {} });
  const data = status.structuredContent?.data;
  assert.equal(data?.version, '4.4.0');
  assert.equal(data.sessionState, 'not_checked');
  assert.equal(data.loggedIn, null);
  const writes = data.capabilities.filter((capability) => capability.write);
  assert.equal(writes.length, 5);
  assert.ok(writes.every((capability) => capability.availability === 'disabled'));
  assert.equal(data.capabilities.find((capability) => capability.name === 'send_message').newThreadEnabled, false);
  const worksheet = await client.callTool({ name: 'prepare_job_application', arguments: {
    job_id: '123', job_title: 'Synthetic role', company: 'Synthetic company',
    requirements: [{ requirement: 'Synthetic requirement' }],
  } });
  assert.notEqual(worksheet.isError, true);
  assert.equal(worksheet.structuredContent?.data?.submitted, false);
  const tracker = await client.callTool({ name: 'export_application_tracker', arguments: {
    records: [{ job_id: '123', title: 'Synthetic role', status: 'interested',
      updated_at: '2026-10-29T00:00:00Z', follow_up_at: '2026-10-29T12:00:00Z' }],
    include_follow_up_plan: true, as_of: '2026-10-30T00:00:00Z',
  } });
  assert.notEqual(tracker.isError, true);
  assert.deepEqual(tracker.structuredContent?.data?.followUpPlan?.overdueRecordIndices, [0]);
  assert.equal(tracker.structuredContent.data.followUpPlan.notificationsScheduled, false);
  assert.equal(existsSync(profile), false);
  const cache = join(scratch, 'npm-cache', '_npx');
  const installs = readdirSync(cache).filter((name) => existsSync(join(cache, name, 'node_modules/linkedin-mcp-tools/package.json')));
  assert.equal(installs.length, 1);
  const install = join(cache, installs[0]);
  const runtime = readFileSync(join(install, 'node_modules/linkedin-mcp-tools/dist/index.js'));
  assert.equal(createHash('sha256').update(runtime).digest('hex'),
    '191b5426b83d60b18c592d83c403686f49dcbf95c8c320f3f4b1d04b5f749fbb');
  const audit = JSON.parse(execFileSync(process.execPath, [npmCli, 'audit', '--omit=dev', '--json',
    '--prefix', install, '--registry=https://registry.npmjs.org'], {
    env, cwd: scratch, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024,
  }));
  assert.equal(audit.metadata.vulnerabilities.total, 0);
} finally {
  await client.close();
  assert.equal(existsSync(profile), false);
  rmSync(scratch, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify({ sourceLauncher: 'passed', packageVersion: '4.4.0',
  tools: 24, disabledWrites: 5, coldIdentity: true, localWorksheetAndTracker: true,
  profileCreated: false, nativePluginInstalled: false, npmNetworkInstallation: true,
  runtimeBytesMatchPublic440: true, freshConsumerAuditFindings: 0, linkedInRequests: 0 }) + '\n');
