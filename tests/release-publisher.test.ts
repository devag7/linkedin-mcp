import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { bundlePatches, patchPublisherBundles, hardenPublisherCache } from '../scripts/install-release-publisher.mjs';
const guard = createRequire(import.meta.url)('../tools/release-publisher/cache-policy-guard.cjs');

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
  it('refuses unreviewed upstream cache bytes before creating wrapper files', () => {
    const root = fixture();
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
  });
  it('keeps ordinary cache decisions and explicit public/private-cache cookie cases with upstream', () => {
    for (const context of ['ordinary', 'public cookie', 'private-cache cookie']) {
      const policy = new (guard(PolicyFixture))();
      if (context.includes('cookie')) policy._resHeaders['set-cookie'] = 'synthetic';
      if (context === 'public cookie') policy._rescc.public = true;
      if (context === 'private-cache cookie') policy._isShared = false;
      expect(policy.evaluateRequest({ headers: {} })).toEqual({ response: { headers: {} }, revalidation: undefined });
    }
  });
});
