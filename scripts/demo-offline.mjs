/** Actual MCP walkthrough with a synthetic persistent stop. No Chrome or LinkedIn request. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const dir = mkdtempSync(join(tmpdir(), 'linkedin-offline-demo-'));
const profile = join(dir, 'profile');
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
  args: [resolve('dist/index.js')],
  stderr: 'pipe',
  env: {
    ...process.env,
    LINKEDIN_PROVIDER: 'browser',
    LINKEDIN_PROFILE_DIR: profile,
    LINKEDIN_CHROME_PATH: join(dir, 'no-chrome'),
    LINKEDIN_ENABLE_WRITES: 'false',
    LOG_LEVEL: 'error',
  },
});
try {
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
  console.log(
    JSON.stringify(
      {
        scope:
          'Actual local MCP calls with synthetic inputs and a persistent stop; no live LinkedIn compatibility claim.',
        packageVersion: session.version,
        toolCount: tools.length,
        sessionState: session.sessionState,
        loggedIn: session.loggedIn,
        currentLiveChecks: session.capabilities.filter((c) => c.liveCheckedAt !== null).length,
        writesEnabled: session.capabilities.some((c) => c.write && c.availability !== 'disabled'),
        preview: draft.data.preview,
        metadata: draft.meta,
        readStatus: blocked.code,
        closed: closed.data.closed,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
  rmSync(dir, { recursive: true, force: true });
}
