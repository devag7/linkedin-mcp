/** Isolated, locked publishing CLI. Never installed into the shipped package. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const bundlePatches = {
  'brace-expansion': ['5.0.9', '5.0.12'],
  'ip-address': ['10.5.0', '10.7.3'],
  undici: ['6.28.0', '6.28.1'],
};
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export function patchPublisherBundles(root) {
  root = fs.realpathSync(root);
  const modules = path.join(root, 'node_modules');
  assert.equal(read(path.join(modules, 'npm/package.json')).version, '12.2.0');
  const lockPath = path.join(root, 'package-lock.json');
  const lock = read(lockPath);
  // Validate every replacement before mutating anything. npm ignores overrides
  // for bundled modules; apply the separately locked upstream patches explicitly.
  const replacements = Object.entries(bundlePatches).map(([name, [before, after]]) => {
    const source = path.join(modules, name);
    const target = path.join(modules, 'npm/node_modules', name);
    for (const dir of [source, target]) {
      assert.ok(fs.lstatSync(dir).isDirectory(), 'Publisher module must be a directory');
      assert.equal(fs.realpathSync(dir), dir, 'Publisher aliases are forbidden');
    }
    const oldPackage = read(path.join(target, 'package.json'));
    const newPackage = read(path.join(source, 'package.json'));
    assert.equal(oldPackage.name, name);
    assert.equal(newPackage.name, name);
    assert.equal(oldPackage.version, before);
    assert.equal(newPackage.version, after);
    assert.deepEqual(newPackage.dependencies ?? {}, oldPackage.dependencies ?? {});
    assert.equal(lock.packages[`node_modules/npm/node_modules/${name}`].version, before);
    const entry = lock.packages[`node_modules/${name}`];
    assert.equal(entry.version, after);
    assert.ok(entry.integrity.startsWith('sha512-'));
    return { name, source, target, entry };
  });
  for (const { name, source, target, entry } of replacements) {
    fs.rmSync(target, { recursive: true });
    fs.cpSync(source, target, { recursive: true });
    // Audit the installed tree, not the superseded bundled versions. This lock is
    // a disposable installation receipt; the repository lock stays unchanged.
    lock.packages[`node_modules/npm/node_modules/${name}`] = { ...entry, inBundle: true };
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}

export function installPublisher(destination) {
  assert.ok(path.isAbsolute(destination), 'Publisher destination must be absolute');
  fs.mkdirSync(destination); // Refuse an existing directory, including aliases.
  const source = fileURLToPath(new URL('../tools/release-publisher/', import.meta.url));
  for (const name of ['package.json', 'package-lock.json']) {
    fs.copyFileSync(path.join(source, name), path.join(destination, name));
  }
  const bootstrap = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(bootstrap, ['ci', '--prefix', destination, '--engine-strict', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund'], { stdio: 'inherit' });
  patchPublisherBundles(destination);
  const cli = path.join(destination, 'node_modules/npm/bin/npm-cli.js');
  execFileSync(process.execPath, [cli, 'audit', '--prefix', destination, '--omit=dev'], { stdio: 'inherit' });
  execFileSync(process.execPath, [cli, '--version'], { stdio: 'inherit' });
  if (process.env.GITHUB_PATH) fs.appendFileSync(process.env.GITHUB_PATH, path.join(destination, 'node_modules/.bin') + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installPublisher(process.argv[2]);
}
