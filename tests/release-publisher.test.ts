import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  bundleAdditions,
  bundleDependencyChanges,
  bundlePatches,
  hardenPublisherCache,
  patchPublisherBundles,
  publisherNpmVersion,
  verifyBundleDependencies,
} from '../scripts/install-release-publisher.mjs';
const guard = createRequire(import.meta.url)('../tools/release-publisher/cache-policy-guard.cjs');
const changes = bundleDependencyChanges as Record<string, Record<string, string>>;

const fixtures: string[] = [];
afterEach(() => { for (const dir of fixtures.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
const read = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'));
function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'publisher-bundles-')));
  fixtures.push(root);
  const entries: Record<string, object> = {};
  const writePackage = (relative: string, name: string, version: string, dependencies?: Record<string, string>) => {
    const dir = path.join(root, relative);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version, ...(dependencies ? { dependencies } : {}) }));
    fs.writeFileSync(path.join(dir, 'index.js'), `module.exports = '${version}';`);
    entries[relative] = { version, integrity: 'sha512-fixture-only', resolved: 'https://registry.npmjs.org/fixture' };
  };
  writePackage('node_modules/npm', 'npm', publisherNpmVersion);
  for (const [name, [before, after]] of Object.entries(bundlePatches)) {
    writePackage(`node_modules/${name}`, name, after, changes[name]);
    writePackage(`node_modules/npm/node_modules/${name}`, name, before);
  }
  for (const [name, version] of Object.entries(bundleAdditions)) writePackage(`node_modules/${name}`, name, version);
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ packages: entries }));
  return { root, writePackage };
}
const bundled = (root: string, name: string) => read(path.join(root, 'node_modules/npm/node_modules', name, 'package.json'));

describe('isolated release publisher bundle repair', () => {
  it('pins the reviewed npm and only allows declared dependency changes', () => {
    expect(publisherNpmVersion).toBe('12.2.1');
    expect(Object.keys(changes).every((name) => name in bundlePatches)).toBe(true);
    const publisher = read(path.join(__dirname, '../tools/release-publisher/package.json'));
    expect(publisher.dependencies.npm).toBe(publisherNpmVersion);
    for (const [name, [, after]] of Object.entries(bundlePatches)) expect(publisher.dependencies[name]).toBe(after);
    for (const [name, version] of Object.entries(bundleAdditions)) expect(publisher.dependencies[name]).toBe(version);
  });
  it('installs locked patches and additions and records the actual versions in the audit lock', () => {
    const { root } = fixture();
    patchPublisherBundles(root);
    const lock = read(path.join(root, 'package-lock.json'));
    const expected = { ...Object.fromEntries(Object.entries(bundlePatches).map(([n, [, v]]) => [n, v])), ...bundleAdditions };
    for (const [name, version] of Object.entries(expected)) {
      const relative = `node_modules/npm/node_modules/${name}`;
      expect(bundled(root, name).version).toBe(version);
      expect(fs.readFileSync(path.join(root, relative, 'index.js'), 'utf8')).toContain(version);
      expect(lock.packages[relative].version).toBe(version);
      expect(lock.packages[relative].inBundle).toBe(true);
      expect(lock.packages[relative].integrity).toBe(lock.packages[`node_modules/${name}`].integrity);
    }
  });
  it('rejects an unexpected version before replacing any module', () => {
    const { root } = fixture();
    fs.writeFileSync(path.join(root, 'node_modules/undici/package.json'), JSON.stringify({ name: 'undici', version: '99.0.0' }));
    expect(() => patchPublisherBundles(root)).toThrow();
    expect(bundled(root, 'ip-address').version).toBe(bundlePatches['ip-address'][0]);
    expect(bundled(root, 'minimatch').version).toBe(bundlePatches.minimatch[0]);
  });
  it('rejects an undeclared dependency change before replacing any module', () => {
    const { root, writePackage } = fixture();
    writePackage('node_modules/undici', 'undici', bundlePatches.undici[1], { surprise: '^1.0.0' });
    expect(() => patchPublisherBundles(root)).toThrow('Unreviewed dependency change for undici');
    expect(bundled(root, 'glob').version).toBe(bundlePatches.glob[0]);
  });
  it('rejects a declared major whose dependencies drift from the reviewed table', () => {
    const { root, writePackage } = fixture();
    writePackage('node_modules/glob', 'glob', bundlePatches.glob[1], { ...changes.glob, minimatch: '^12.0.0' });
    expect(() => patchPublisherBundles(root)).toThrow('Unreviewed dependency change for glob');
  });
  it('refuses to overwrite an addition that npm already bundles', () => {
    const { root, writePackage } = fixture();
    const [name, version] = Object.entries(bundleAdditions)[0];
    writePackage(`node_modules/npm/node_modules/${name}`, name, version);
    expect(() => patchPublisherBundles(root)).toThrow('already exists');
    expect(bundled(root, 'minimatch').version).toBe(bundlePatches.minimatch[0]);
  });
  it('rejects a bundled symlink or Windows junction without touching its target', () => {
    const { root } = fixture();
    const target = path.join(root, 'node_modules/npm/node_modules/undici');
    fs.rmSync(target, { recursive: true });
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'publisher-outside-'));
    fixtures.push(outside);
    fs.writeFileSync(path.join(outside, 'sentinel'), 'preserve');
    fs.symlinkSync(outside, target, process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => patchPublisherBundles(root)).toThrow();
    expect(fs.readFileSync(path.join(outside, 'sentinel'), 'utf8')).toBe('preserve');
  });
  it('requires every replaced module to resolve satisfying dependencies inside the bundle', () => {
    const { root, writePackage } = fixture();
    fs.cpSync(path.join(__dirname, '../node_modules/semver'), path.join(root, 'node_modules/npm/node_modules/semver'), { recursive: true });
    patchPublisherBundles(root);
    expect(() => verifyBundleDependencies(root)).toThrow('needs bundled');
    const satisfy: Record<string, string> = {
      'brace-expansion': '5.0.12', 'lru-cache': '11.5.2', minipass: '7.1.3',
    };
    for (const [name, version] of Object.entries(satisfy)) writePackage(`node_modules/npm/node_modules/${name}`, name, version);
    for (const name of Object.keys(bundlePatches)) {
      const file = path.join(root, 'node_modules/npm/node_modules', name, 'package.json');
      const pkg = read(file);
      if (name === 'path-scurry') fs.writeFileSync(file, JSON.stringify({ ...pkg, dependencies: { 'lru-cache': '^11.0.0', minipass: '^7.1.2' } }));
    }
    expect(() => verifyBundleDependencies(root)).not.toThrow();
    writePackage('node_modules/npm/node_modules/lru-cache', 'lru-cache', '10.4.3');
    expect(() => verifyBundleDependencies(root)).toThrow('path-scurry needs lru-cache@^11.0.0, bundle has 10.4.3');
  });
  it('refuses unreviewed upstream cache bytes before creating wrapper files', () => {
    const { root, writePackage } = fixture();
    writePackage('node_modules/npm/node_modules/http-cache-semantics', 'http-cache-semantics', '4.3.0');
    const target = path.join(root, 'node_modules/npm/node_modules/http-cache-semantics');
    const before = fs.readFileSync(path.join(target, 'index.js'));
    expect(() => hardenPublisherCache(root)).toThrow('Unexpected upstream cache-policy bytes');
    expect(fs.readFileSync(path.join(target, 'index.js'))).toEqual(before);
    expect(fs.existsSync(path.join(target, 'upstream.cjs'))).toBe(false);
    expect(fs.existsSync(path.join(target, 'publisher-guard.cjs'))).toBe(false);
  });
});

class PolicyFixture {
  _isShared = true;
  _rescc: Record<string, string | boolean> = {};
  _resHeaders: Record<string, string> = {};
  canStore = true;
  storable() { return this.canStore; }
  _assertRequestHasHeaders(request: { headers?: object }) { if (!request.headers) throw new Error('missing headers'); }
  _evaluateRequestMissResult() { return { response: undefined, revalidation: { synchronous: true } }; }
  evaluateRequest() { return { response: { headers: {} }, revalidation: undefined }; }
  useStaleWhileRevalidate() { return true; }
  _useStaleIfError() { return true; }
}

describe('publisher-only cache prohibition guard', () => {
  it.each(['shared cookie', 'immutable shared cookie', 'proxy-revalidate', 'no-cache', 'no-store'])('requires revalidation for %s despite stale requests', (condition) => {
    const policy = new (guard(PolicyFixture))();
    if (condition.includes('cookie')) policy._resHeaders['set-cookie'] = 'synthetic';
    if (condition.startsWith('immutable')) policy._rescc.immutable = true;
    if (condition === 'proxy-revalidate') policy._rescc['proxy-revalidate'] = true;
    if (condition === 'no-cache') policy._rescc['no-cache'] = true;
    if (condition === 'no-store') policy.canStore = false;
    expect(policy.evaluateRequest({ headers: { 'cache-control': 'max-stale=100000' } })).toEqual({ response: undefined, revalidation: { synchronous: true } });
    expect(policy.useStaleWhileRevalidate()).toBe(false);
    expect(policy._useStaleIfError()).toBe(false);
  });
  it('keeps ordinary cache decisions and explicit public/private-cache cookie cases with upstream', () => {
    for (const context of ['ordinary', 'public cookie', 'private-cache cookie']) {
      const policy = new (guard(PolicyFixture))();
      if (context.includes('cookie')) policy._resHeaders['set-cookie'] = 'synthetic';
      if (context === 'public cookie') policy._rescc.public = true;
      if (context === 'private-cache cookie') policy._isShared = false;
      expect(policy.evaluateRequest({ headers: {} })).toEqual({ response: { headers: {} }, revalidation: undefined });
      expect(policy.useStaleWhileRevalidate()).toBe(true);
      expect(policy._useStaleIfError()).toBe(true);
    }
  });
});
