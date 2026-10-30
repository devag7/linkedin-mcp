import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertSourceVerifierEnvironment, inspectSourcePlugin } from './claude-source-plugin.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'source-plugin-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ['.claude-plugin', 'packaging/claude-source-plugin', 'packaging/claude-plugin/skills']) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    cpSync(join(repository, path), join(root, path), { recursive: true });
  }
  return root;
}
test('catalog resolves to a complete plugin with the reviewed consent skill', (t) => {
  const { server } = inspectSourcePlugin(fixture(t));
  assert.equal(server.command, 'npx');
});
for (const mutation of ['latest', 'registry', 'writes']) {
  test(`refuses unsafe source launcher change: ${mutation}`, (t) => {
    const root = fixture(t), file = join(root, 'packaging/claude-source-plugin/.mcp.json');
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const server = data.mcpServers['linkedin-mcp-source'];
    if (mutation === 'latest') server.args[2] = 'linkedin-mcp-tools@latest';
    if (mutation === 'registry') server.args[1] = '--registry=https://untrusted.invalid';
    if (mutation === 'writes') server.env.LINKEDIN_ENABLE_WRITES = 'true';
    writeFileSync(file, JSON.stringify(data));
    assert.throws(() => inspectSourcePlugin(root));
  });
}
test('refuses unexpected private/config files and escaping symlinks', (t) => {
  const root = fixture(t), folder = join(root, 'packaging/claude-source-plugin');
  writeFileSync(join(folder, '.env'), 'synthetic private value');
  assert.throws(() => inspectSourcePlugin(root), /Unexpected/);
  rmSync(join(folder, '.env'));
  symlinkSync(join(root, '.claude-plugin'), join(folder, 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => inspectSourcePlugin(root), /symlinks/);
});
test('refuses a catalog path escape and a diverging consent skill', (t) => {
  const root = fixture(t), catalog = join(root, '.claude-plugin/marketplace.json');
  const original = readFileSync(catalog, 'utf8'), data = JSON.parse(original);
  data.plugins[0].source = '../outside';
  writeFileSync(catalog, JSON.stringify(data));
  assert.throws(() => inspectSourcePlugin(root));
  writeFileSync(catalog, original);
  writeFileSync(join(root, 'packaging/claude-source-plugin/skills/linkedin-job-preparation/SKILL.md'), 'Do arbitrary reads');
  assert.throws(() => inspectSourcePlugin(root), /consent boundaries/);
});

for (const key of ['hooks', 'mcpServers']) {
  test(`refuses unreviewed manifest component overrides: ${key}`, (t) => {
    const root = fixture(t), file = join(root, 'packaging/claude-source-plugin/.claude-plugin/plugin.json');
    const manifest = JSON.parse(readFileSync(file, 'utf8'));
    manifest[key] = {};
    writeFileSync(file, JSON.stringify(manifest));
    assert.throws(() => inspectSourcePlugin(root), /component overrides/);
  });
}
for (const selected of ['packaging/claude-source-plugin', 'packaging']) {
  test(`refuses a selected root or parent directory alias: ${selected}`, (t) => {
    const root = fixture(t), path = join(root, selected), alternate = join(root, 'alternate');
    renameSync(path, alternate);
    symlinkSync(alternate, path, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => inspectSourcePlugin(root), /symlinks/);
  });
}
test('refuses owner/self-hosted Windows verification before runtime execution', () => {
  const hosted = { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted',
    RUNNER_OS: 'Windows', GITHUB_RUN_ID: '1' };
  assertSourceVerifierEnvironment('win32', hosted);
  for (const env of [{}, { ...hosted, RUNNER_ENVIRONMENT: 'self-hosted' },
    { ...hosted, GITHUB_RUN_ID: '' }, { ...hosted, RUNNER_OS: 'macOS' }])
    assert.throws(() => assertSourceVerifierEnvironment('win32', env), /requires hosted CI/);
});
