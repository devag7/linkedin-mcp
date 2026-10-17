/** Execute generated configuration through a real SDK stdio client, offline. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import {
  readFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
  existsSync,
  symlinkSync,
  lstatSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const bundle = resolve(process.argv[2] ?? 'dist/index.js');
const root = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-setup-')));
const profile = join(root, 'profile with spaces');
mkdirSync(profile);
writeFileSync(
  `${profile}.circuit.json`,
  JSON.stringify({
    globalOpen: true,
    globalTrippedAt: Date.now(),
    globalReason: 'Synthetic setup stop',
    actions: {},
    rate429Count: 0,
  }),
);
const env = {
  ...process.env,
  LINKEDIN_PROFILE_DIR: profile,
  LINKEDIN_CHROME_PATH: join(root, 'missing chrome'),
  LINKEDIN_HTTP_TOKEN: 'synthetic-secret-must-not-be-emitted',
  LINKEDIN_ENABLE_WRITES: 'true',
  LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: 'true',
};
try {
  for (const name of ['claude-desktop', 'cursor', 'vscode']) {
    const clientCaseStart = performance.now();
    const setup = spawnSync(process.execPath, [bundle, '--setup', name], {
      env,
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(setup.status, 1, setup.stderr);
    const report = JSON.parse(setup.stdout);
    assert.equal(report.client, name);
    assert.equal(report.status, 'needs_attention');
    assert.equal(report.diagnosis.session, 'not_checked');
    assert.equal(report.diagnosis.checks.safetyState, 'blocked');
    assert.ok(!setup.stdout.includes(env.LINKEDIN_HTTP_TOKEN));
    const config = spawnSync(process.execPath, [bundle, '--client-config', name], {
      env,
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(config.status, 0, config.stderr);
    assert.deepEqual(JSON.parse(config.stdout), report.configuration);
    const server = (report.configuration.mcpServers ?? report.configuration.servers).linkedin;
    assert.deepEqual(report.commands.login.args, [...server.args, '--login']);
    const key = name === 'vscode' ? 'servers' : 'mcpServers';
    const selected = join(root, `${name}-config with spaces.json`);
    const existing = `// synthetic local comment\n{"${key}":{"other":{"env":{"TOKEN":"synthetic-unrelated-secret"}}},"inputs":[],}`;
    writeFileSync(selected, existing);
    const runPreview = () =>
      spawnSync(process.execPath, [bundle, '--setup', name, '--config-file', selected], {
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
    const merged = runPreview();
    const mergeReport = JSON.parse(merged.stdout);
    assert.equal(merged.status, 1); // Missing Chrome/latched stop; merge status is separate.
    assert.equal(mergeReport.configMerge.status, 'ready_to_add');
    assert.equal(mergeReport.configMerge.existingServerCount, 1);
    assert.deepEqual(mergeReport.configMerge.patch, [
      { op: 'add', path: `/${key}/linkedin`, value: server },
    ]);
    assert.equal(readFileSync(selected, 'utf8'), existing);
    assert.ok(!(merged.stdout + merged.stderr).includes('synthetic-unrelated-secret'));
    writeFileSync(selected, JSON.stringify({ [key]: { linkedin: server } }));
    assert.equal(JSON.parse(runPreview().stdout).configMerge.status, 'already_matches');
    writeFileSync(
      selected,
      JSON.stringify({ [key]: { linkedin: { env: { TOKEN: 'synthetic-conflicting-secret' } } } }),
    );
    const conflictBytes = readFileSync(selected);
    const conflicting = runPreview();
    assert.equal(conflicting.status, 1);
    assert.equal(JSON.parse(conflicting.stdout).configMerge.status, 'conflict');
    assert.deepEqual(JSON.parse(conflicting.stdout).configMerge.patch, []);
    assert.ok(!(conflicting.stdout + conflicting.stderr).includes('synthetic-conflicting-secret'));
    assert.deepEqual(readFileSync(selected), conflictBytes);

    const client = new Client({ name: 'generated-config-check', version: '1' });
    const transport = new StdioClientTransport({ ...server, stderr: 'pipe' });
    let phase = 'connect';
    let serverFailure = 'none';
    let connectMs = -1;
    transport.stderr?.on('data', (chunk) => {
      const diagnostic = String(chunk);
      const tagged = /"code":"(WINDOWS_STATE_[A-Z_]+|BUDGET_STATE_UNREADABLE|CIRCUIT_STATE_UNREADABLE|STARTUP_FAILED)"/.exec(diagnostic);
      if (tagged) serverFailure = tagged[1];
      else if (serverFailure === 'none' && diagnostic.includes('Failed to start server'))
        serverFailure = 'startup';
    });
    try {
      const connectStart = performance.now();
      await client.connect(transport);
      connectMs = Math.round(performance.now() - connectStart);
      phase = 'list_tools';
      assert.equal((await client.listTools()).tools.length, 23);
      const call = async (name, args = {}) =>
        (await client.callTool({ name, arguments: args })).structuredContent;
      phase = 'whoami';
      assert.equal((await call('whoami')).data.sessionState, 'not_checked');
      phase = 'health_check';
      assert.equal((await call('health_check')).data.status, 'blocked');
      phase = 'get_my_profile';
      assert.equal((await call('get_my_profile')).code, 'CIRCUIT_OPEN');
      phase = 'create_post';
      const draft = await call('create_post', { text: 'Synthetic setup preview', confirm: false });
      assert.equal(draft.data.preview.writesEnabled, false);
      assert.equal(draft.data.preview.token.length, 43);
      phase = 'close_session';
      assert.equal((await call('close_session')).data.closed, true);
      assert.equal(existsSync(`${profile}.owner.lock`), false);
    } catch {
      throw new Error(`PACKED_CLIENT_FLOW_FAILED:${name}:${phase}:${serverFailure}`);
    } finally {
      await client.close();
    }
    console.log(
      JSON.stringify({
        clientConfiguration: name,
        connectMs,
        caseMs: Math.round(performance.now() - clientCaseStart),
        sdkStdio: 'passed',
        scope: 'offline',
        toolCount: 23,
        linkedInRequests: 0,
        browserLaunches: 0,
        configMergePreview: 'passed',
      }),
    );
  }
  const brokenProfile = join(root, 'broken-profile');
  symlinkSync(
    join(root, 'missing-target'),
    brokenProfile,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  const broken = spawnSync(
    process.execPath,
    [bundle, '--setup', 'cursor', '--config-file', join(root, 'not-read.json')],
    {
      env: { ...env, LINKEDIN_PROFILE_DIR: brokenProfile },
      encoding: 'utf8',
      timeout: 10000,
    },
  );
  assert.equal(broken.status, 1, broken.stderr);
  const brokenReport = JSON.parse(broken.stdout);
  assert.equal(brokenReport.diagnosis.checks.profile, 'invalid');
  assert.equal(brokenReport.configuration, null);
  assert.equal(brokenReport.commands, null);
  assert.equal(brokenReport.configMerge.status, 'unavailable');
  assert.ok(
    brokenReport.diagnosis.nextSteps.some((step) => step.includes('broken symlink/junction')),
  );
  assert.equal(lstatSync(brokenProfile).isSymbolicLink(), true);
  assert.equal(existsSync(join(root, 'missing-target')), false);
  console.log(
    JSON.stringify({ brokenProfileSetup: 'passed', scope: 'offline', linkedInRequests: 0 }),
  );
  for (const args of [
    ['--setup'],
    ['--setup', 'secret-unsupported-client'],
    ['--setup', 'cursor', '--live'],
    ['--setup', 'cursor', '--logout'],
    ['--setup', 'cursor', '--config-file'],
    ['--client-config', 'cursor', '--config-file', 'secret-unsupported-client'],
    [
      '--setup',
      'cursor',
      '--config-file',
      'secret-unsupported-client',
      '--config-file',
      'duplicate',
    ],
  ]) {
    const invalid = spawnSync(process.execPath, [bundle, ...args], {
      env,
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(invalid.status, 1);
    assert.ok(!(invalid.stdout + invalid.stderr).includes('secret-unsupported-client'));
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
