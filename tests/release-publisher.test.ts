import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundlePatches, patchPublisherBundles } from '../scripts/install-release-publisher.mjs';

const fixtures: string[] = [];
afterEach(() => { for (const dir of fixtures.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'publisher-bundles-')));
  fixtures.push(root);
  const entries: Record<string, object> = {};
  const writePackage = (relative: string, name: string, version: string) => {
    const dir = path.join(root, relative);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version }));
    fs.writeFileSync(path.join(dir, 'index.js'), `module.exports = '${version}';`);
    entries[relative] = { version, integrity: 'sha512-fixture-only', resolved: 'https://registry.npmjs.org/fixture' };
  };
  writePackage('node_modules/npm', 'npm', '12.2.0');
  for (const [name, [before, after]] of Object.entries(bundlePatches)) {
    writePackage(`node_modules/${name}`, name, after);
    writePackage(`node_modules/npm/node_modules/${name}`, name, before);
  }
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ packages: entries }));
  return root;
}
describe('isolated release publisher bundle repair', () => {
  it('installs locked patches and records the actual versions in the audit lock', () => {
    const root = fixture();
    patchPublisherBundles(root);
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    for (const [name, [, version]] of Object.entries(bundlePatches)) {
      const relative = `node_modules/npm/node_modules/${name}`;
      expect(JSON.parse(fs.readFileSync(path.join(root, relative, 'package.json'), 'utf8')).version).toBe(version);
      expect(fs.readFileSync(path.join(root, relative, 'index.js'), 'utf8')).toContain(version);
      expect(lock.packages[relative].version).toBe(version);
      expect(lock.packages[relative].integrity).toBe(lock.packages[`node_modules/${name}`].integrity);
    }
  });
  it('rejects an unexpected version before replacing any module', () => {
    const root = fixture();
    const file = path.join(root, 'node_modules/undici/package.json');
    fs.writeFileSync(file, JSON.stringify({ name: 'undici', version: '99.0.0' }));
    expect(() => patchPublisherBundles(root)).toThrow();
    expect(JSON.parse(fs.readFileSync(path.join(root, 'node_modules/npm/node_modules/brace-expansion/package.json'), 'utf8')).version).toBe('5.0.9');
  });
  it('rejects a bundled symlink or Windows junction without touching its target', () => {
    const root = fixture();
    const target = path.join(root, 'node_modules/npm/node_modules/undici');
    fs.rmSync(target, { recursive: true });
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'publisher-outside-'));
    fixtures.push(outside);
    fs.writeFileSync(path.join(outside, 'sentinel'), 'preserve');
    fs.symlinkSync(outside, target, process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => patchPublisherBundles(root)).toThrow();
    expect(fs.readFileSync(path.join(outside, 'sentinel'), 'utf8')).toBe('preserve');
  });
});
