import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const sourcePluginFiles = [
  '.claude-plugin/plugin.json', '.mcp.json', 'README.md',
  'skills/linkedin-job-preparation/SKILL.md',
];

/** Inspect source distribution without loading Claude, fetching packages or executing commands. */
export function inspectSourcePlugin(repository) {
  const folder = join(repository, 'packaging/claude-source-plugin');
  const found = [];
  function inspect(relative = '') {
    for (const entry of readdirSync(join(folder, relative), { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false, 'Source plugin must not contain symlinks.');
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) inspect(name);
      else {
        assert.equal(entry.isFile(), true, 'Only regular plugin files are allowed.');
        found.push(name);
      }
    }
  }
  inspect();
  assert.deepEqual(found.sort(), [...sourcePluginFiles].sort(), 'Unexpected source plugin files.');
  const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const manifest = json(join(folder, '.claude-plugin/plugin.json'));
  assert.equal(manifest.name, 'linkedin-mcp-source');
  assert.equal(manifest.version, '1.0.0');
  const catalog = json(join(repository, '.claude-plugin/marketplace.json'));
  assert.equal(catalog.name, 'devag7-linkedin-tools');
  assert.equal(catalog.owner.name, 'Dev Agarwalla');
  assert.deepEqual(catalog.plugins, [{
    name: manifest.name, source: './packaging/claude-source-plugin',
    description: 'Unofficial local LinkedIn tools and offline application preparation, using the pinned public npm release.',
  }]);
  const config = json(join(folder, '.mcp.json'));
  assert.deepEqual(config, { mcpServers: { 'linkedin-mcp-source': {
    command: 'npx',
    args: ['--yes', '--registry=https://registry.npmjs.org', 'linkedin-mcp-tools@4.4.0'],
    env: { LINKEDIN_ENABLE_WRITES: 'false', LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: 'false' },
  } } });
  assert.equal(readFileSync(join(folder, 'skills/linkedin-job-preparation/SKILL.md'), 'utf8'),
    readFileSync(join(repository, 'packaging/claude-plugin/skills/linkedin-job-preparation/SKILL.md'), 'utf8'),
    'Source skill must retain the reviewed offline workflow and consent boundaries.');
  return { folder, manifest, server: config.mcpServers['linkedin-mcp-source'] };
}
