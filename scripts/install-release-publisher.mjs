/** Isolated, locked publishing CLI. Never installed into the shipped package. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

export const bundlePatches = {
  'brace-expansion': ['5.0.9', '5.0.12'],
  'http-cache-semantics': ['4.2.0', '4.3.0'],
  'ip-address': ['10.5.0', '10.7.3'],
  undici: ['6.28.0', '6.28.1'],
};
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export function hardenPublisherCache(root) {
  const target = path.join(fs.realpathSync(root), 'node_modules/npm/node_modules/http-cache-semantics');
  assert.ok(fs.lstatSync(target).isDirectory());
  assert.equal(fs.realpathSync(target), target, 'Publisher aliases are forbidden');
  const index = path.join(target, 'index.js');
  assert.ok(fs.lstatSync(index).isFile());
  const source = fs.readFileSync(index);
  assert.equal(createHash('sha256').update(source).digest('hex'),
    'ede1cc404a492fa348eb9d97a3007a0d72aa717bd22cd86a56bd0824c19729ca',
    'Unexpected upstream cache-policy bytes; review before installing a guard');
  const guard = fileURLToPath(new URL('../tools/release-publisher/cache-policy-guard.cjs', import.meta.url));
  // The exact upstream file stays intact beside a small, separately reviewed wrapper.
  fs.writeFileSync(path.join(target, 'upstream.cjs'), source, { flag: 'wx' });
  fs.copyFileSync(guard, path.join(target, 'publisher-guard.cjs'), fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(index, "module.exports = require('./publisher-guard.cjs')(require('./upstream.cjs'));\n");
  verifyPublisherCache(target);
}

export function verifyPublisherCache(target) {
  const CachePolicy = createRequire(import.meta.url)(path.join(target, 'index.js'));
  const request = { url: 'https://synthetic.invalid/item', method: 'GET', headers: { host: 'synthetic.invalid' } };
  const prohibited = [
    { 'set-cookie': 'synthetic' },
    { 'set-cookie': 'synthetic', 'cache-control': 'immutable' },
    { 'cache-control': 'max-age=0, proxy-revalidate' },
    { 'cache-control': 'no-cache, stale-while-revalidate=1000' },
    { 'cache-control': 'no-store' },
    { 'cache-control': 'private' },
  ];
  for (const extra of prohibited) {
    const policy = new CachePolicy(request, { status: 200, headers: { 'cache-control': 'max-age=60', ...extra } }, { shared: true });
    for (const candidate of [policy, CachePolicy.fromObject(policy.toObject())]) {
      candidate.now = () => candidate._responseTime + 5000;
      const next = { ...request, headers: { ...request.headers, 'cache-control': 'max-stale=100000' } };
      assert.equal(candidate.satisfiesWithoutRevalidation(next), false, 'Publisher cache prohibition was bypassed');
      assert.equal(candidate.evaluateRequest(next).response, undefined);
    }
  }
  for (const control of ['max-age=60', 'max-age=0', 'max-age=0, public']) {
    const policy = new CachePolicy(request, { status: 200, headers: { 'cache-control': control } }, { shared: true });
    policy.now = () => policy._responseTime + 5000;
    assert.equal(policy.satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, 'cache-control': 'max-stale=100000' } }), true);
  }
}

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
  hardenPublisherCache(destination);
  const cli = path.join(destination, 'node_modules/npm/bin/npm-cli.js');
  execFileSync(process.execPath, [cli, 'audit', '--prefix', destination, '--omit=dev'], { stdio: 'inherit' });
  execFileSync(process.execPath, [cli, '--version'], { stdio: 'inherit' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installPublisher(process.argv[2]);
}
