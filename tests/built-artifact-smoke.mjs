/** Offline compiled-CLI protocol smoke. No browser or LinkedIn requests. */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const bundle = process.argv[2] ?? resolve('dist/index.js');
const dir = mkdtempSync(join(tmpdir(), 'linkedin-built-smoke-'));
const profile = join(dir, 'profile');
mkdirSync(profile);
writeFileSync(
  `${profile}.circuit.json`,
  JSON.stringify({
    globalOpen: true,
    globalTrippedAt: Date.now(),
    globalReason: 'Synthetic test stop',
    actions: {},
    rate429Count: 0,
  }),
);
const payload = (result) => JSON.parse(result.content[0].text);
try {
  for (let i = 0; i < 2; i++) {
    const client = new Client({ name: 'offline-artifact-smoke', version: '1' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [bundle],
      stderr: 'pipe',
      env: {
        ...process.env,
        LINKEDIN_PROFILE_DIR: profile,
        LINKEDIN_CHROME_PATH: join(dir, 'no-chrome'),
        LOG_LEVEL: 'error',
      },
    });
    try {
      await client.connect(transport);
      const tools = (await client.listTools()).tools;
      assert.equal(tools.length, 23);
      assert.equal(
        payload(await client.callTool({ name: 'whoami', arguments: {} })).data.sessionState,
        'not_checked',
      );
      const names = [
        'connect_with_person',
        'send_message',
        'create_post',
        'react_to_post',
        'comment_on_post',
      ];
      for (const name of names)
        assert.ok(tools.find((tool) => tool.name === name).inputSchema.properties.operation_id);
      assert.equal(
        payload(
          await client.callTool({
            name: 'create_post',
            arguments: { text: 'synthetic', confirm: false },
          }),
        ).data.refused,
        true,
      );
      assert.equal(
        payload(await client.callTool({ name: 'get_my_profile', arguments: {} })).code,
        'CIRCUIT_OPEN',
      );
      const brief = payload(
        await client.callTool({
          name: 'research_jobs',
          arguments: { keywords: 'synthetic offline check' },
        }),
      );
      assert.equal(brief.data.status, 'partial');
      assert.equal(brief.data.reads[0].code, 'CIRCUIT_OPEN');
      assert.equal(brief.data.bounds.readAttempts, 0);
      assert.deepEqual(brief.data.entities, []);
      assert.equal(
        payload(await client.callTool({ name: 'health_check', arguments: {} })).data.status,
        'blocked',
      );
      assert.equal(
        payload(await client.callTool({ name: 'close_session', arguments: {} })).data.closed,
        true,
      );
    } finally {
      await client.close();
    }
  }
  console.log(
    'PASS: two fresh built stdio processes, 23 tools, write IDs, confirmation refusal, persisted stop, blocked health, clean close.',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
