import assert from 'node:assert/strict';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

export const sourcePluginFiles = [
  '.claude-plugin/plugin.json', '.mcp.json', 'README.md',
  'skills/linkedin-job-preparation/SKILL.md',
];

export function assertSourceVerifierEnvironment(platform, env) {
  if (platform !== 'win32') return;
  // Windows' native guard needs the real OS home. Never inspect an owner's
  // shared budget through a verifier pretending that USERPROFILE is isolated.
  assert.equal(env.GITHUB_ACTIONS, 'true', 'Windows source verification requires hosted CI.');
  assert.equal(env.RUNNER_ENVIRONMENT, 'github-hosted', 'Windows source verification requires hosted CI.');
  assert.equal(env.RUNNER_OS, 'Windows', 'Windows source verification requires hosted CI.');
  assert.match(env.GITHUB_RUN_ID ?? '', /^[0-9]+$/, 'Windows source verification requires hosted CI.');
}

/** Inspect source distribution without loading Claude, fetching packages or executing commands. */
export function inspectSourcePlugin(repository) {
  repository = resolve(repository);
  assert.equal(lstatSync(repository).isSymbolicLink(), false, 'Repository root must not be a symlink.');
  const canonicalRepository = realpathSync(repository);
  function checkedPath(path) {
    let current = repository;
    for (const component of path.split('/')) {
      current = join(current, component);
      assert.equal(lstatSync(current).isSymbolicLink(), false, 'Plugin path must not contain symlinks.');
    }
    const suffix = relative(canonicalRepository, realpathSync(current));
    assert.ok(suffix !== '..' && !suffix.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
      && !isAbsolute(suffix), 'Plugin paths must remain within the repository.');
    return current;
  }
  const folder = checkedPath('packaging/claude-source-plugin');
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
  const manifest = json(checkedPath('packaging/claude-source-plugin/.claude-plugin/plugin.json'));
  assert.deepEqual(Object.keys(manifest).sort(), ['name', 'displayName', 'version',
    'description', 'author', 'homepage', 'repository', 'license'].sort(),
    'Source manifest must not add hooks or component overrides.');
  assert.equal(manifest.name, 'linkedin-mcp-source');
  assert.equal(manifest.version, '1.0.0');
  const catalog = json(checkedPath('.claude-plugin/marketplace.json'));
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
    readFileSync(checkedPath('packaging/claude-plugin/skills/linkedin-job-preparation/SKILL.md'), 'utf8'),
    'Source skill must retain the reviewed offline workflow and consent boundaries.');
  return { folder, manifest, server: config.mcpServers['linkedin-mcp-source'] };
}
