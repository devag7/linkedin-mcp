/** Actual MCP walkthrough with a synthetic persistent stop. No Chrome or LinkedIn request. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const dir = mkdtempSync(join(tmpdir(), 'linkedin-offline-demo-'));
const profile = join(dir, 'profile');
mkdirSync(profile);
const bundle = resolve(process.argv[2] ?? 'dist/index.js');
const env = {
  ...process.env,
  TRANSPORT: 'stdio',
  LINKEDIN_PROVIDER: 'browser',
  LINKEDIN_PROFILE_DIR: profile,
  LINKEDIN_CHROME_PATH: join(dir, 'no-chrome'),
  LINKEDIN_ENABLE_WRITES: 'false',
  LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: 'false',
  LOG_LEVEL: 'error',
};
writeFileSync(
  `${profile}.circuit.json`,
  JSON.stringify({
    globalOpen: true,
    globalTrippedAt: Date.now(),
    globalReason: 'Synthetic offline demo stop',
    actions: {},
    rate429Count: 0,
  }),
);
const client = new Client({ name: 'synthetic-offline-demo', version: '1' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [bundle],
  stderr: 'pipe',
  env,
});
try {
  const setup = ['claude-desktop', 'cursor', 'vscode'].map((name) => {
    const result = spawnSync(process.execPath, [bundle, '--setup', name], {
      env,
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.status, 1, 'Synthetic missing Chrome/stop must require attention');
    const report = JSON.parse(result.stdout);
    const server = (report.configuration.mcpServers ?? report.configuration.servers).linkedin;
    assert.equal(report.diagnosis.session, 'not_checked');
    assert.equal(report.diagnosis.checks.safetyState, 'blocked');
    assert.equal(server.env.TRANSPORT, 'stdio');
    assert.equal(server.env.LINKEDIN_ENABLE_WRITES, 'false');
    assert.deepEqual(server.args, [bundle]);
    // Public demonstration records status only, never private installation paths.
    return {
      client: name,
      status: report.status,
      session: report.diagnosis.session,
      chrome: report.diagnosis.checks.chrome,
      safetyState: report.diagnosis.checks.safetyState,
      transport: server.env.TRANSPORT,
      writesEnabled: false,
      manualLogin: 'not run',
    };
  });
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  const call = async (name, args = {}) =>
    (await client.callTool({ name, arguments: args })).structuredContent;
  const session = (await call('whoami')).data;
  const draft = await call('create_post', {
    text: 'Synthetic draft for a local preview only.',
    visibility: 'CONNECTIONS',
    operation_id: 'synthetic-demo-draft-01',
  });
  const blocked = await call('get_my_profile');
  const closed = await call('close_session');
  assert.equal(tools.length, 22);
  assert.equal(
    tools.some((tool) => tool.name === 'research_jobs'),
    false,
  );
  assert.equal(blocked.code, 'CIRCUIT_OPEN');
  assert.equal(closed.data.closed, true);
  console.log(
    JSON.stringify(
      {
        scope:
          'Actual local MCP calls with synthetic inputs and a persistent stop; no live LinkedIn compatibility claim.',
        packageVersion: session.version,
        setup,
        linkedInRequests: 0,
        browserLaunches: 0,
        toolCount: tools.length,
        sessionState: session.sessionState,
        loggedIn: session.loggedIn,
        currentLiveChecks: session.capabilities.filter((c) => c.liveCheckedAt !== null).length,
        writesEnabled: session.capabilities.some((c) => c.write && c.availability !== 'disabled'),
        preview: {
          writesEnabled: draft.data.preview.writesEnabled,
          issuedProof: typeof draft.data.preview.token === 'string',
          submitted: false,
        },
        readStatus: blocked.code,
        closed: closed.data.closed,
      },
      null,
      2,
    ),
  );
} finally {
  try {
    await client.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
