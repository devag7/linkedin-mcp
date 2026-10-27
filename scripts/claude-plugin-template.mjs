import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const pluginTemplateFiles = [
  '.claude-plugin/plugin.json',
  '.mcp.json',
  'README.md',
  'skills/linkedin-job-preparation/SKILL.md',
];

/** Reject dirty/unexpected input before copying any plugin template bytes. */
export function copyPluginTemplate(source, destination) {
  const found = [];
  function inspect(relative = '') {
    for (const entry of readdirSync(join(source, relative), { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false, 'Plugin template must not contain symlinks.');
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) inspect(path);
      else {
        assert.equal(entry.isFile(), true, 'Plugin template must contain only regular files.');
        found.push(path);
      }
    }
  }
  inspect();
  assert.deepEqual(found.sort(), [...pluginTemplateFiles].sort(),
    'Unexpected or missing plugin template input; inspect the source before building.');
  for (const file of pluginTemplateFiles) {
    const output = join(destination, file);
    mkdirSync(dirname(output), { recursive: true });
    copyFileSync(join(source, file), output);
  }
}
