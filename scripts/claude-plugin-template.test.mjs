import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { copyPluginTemplate, pluginTemplateFiles } from './claude-plugin-template.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'plugin-template-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = join(directory, 'source');
  for (const file of pluginTemplateFiles) {
    mkdirSync(dirname(join(source, file)), { recursive: true });
    writeFileSync(join(source, file), `synthetic ${file}`);
  }
  return { directory, source, destination: join(directory, 'destination') };
}

test('only the exact approved template files are copied', (t) => {
  const { source, destination } = fixture(t);
  copyPluginTemplate(source, destination);
  for (const file of pluginTemplateFiles)
    assert.equal(readFileSync(join(destination, file), 'utf8'), `synthetic ${file}`);
});

for (const extra of ['.env', 'skills/linkedin-job-preparation/private-notes.txt']) {
  test(`dirty template input is refused before copying: ${extra}`, (t) => {
    const { source, destination } = fixture(t);
    writeFileSync(join(source, extra), 'synthetic private fixture');
    assert.throws(() => copyPluginTemplate(source, destination), /Unexpected or missing/);
    assert.equal(existsSync(destination), false);
  });
}

test('symlinked template directories are refused before copying', (t) => {
  const { directory, source, destination } = fixture(t);
  const target = join(directory, 'outside');
  mkdirSync(target);
  symlinkSync(target, join(source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => copyPluginTemplate(source, destination), /must not contain symlinks/);
  assert.equal(existsSync(destination), false);
});
