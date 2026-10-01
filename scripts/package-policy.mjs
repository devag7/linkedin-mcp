/** Exact release inventory, independent of mutable package.json globs. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
export const RELEASE_FILES = Object.freeze([
  'dist/index.js',
  'dist/index.js.map',
  'README.md',
  'LICENSE',
  'DISCLAIMER.md',
  'mcp-manifest.json',
  'SETUP_GUIDE.md',
  'SECURITY.md',
  'PRODUCT_TECHNICAL_ROADMAP_2026.md',
  'claude-desktop-config.json',
  'docs/CAPABILITIES.md',
  'docs/CONTRACTS.md',
  'docs/PRIVACY.md',
  'docs/WORKFLOWS.md',
]);
export function assertInventory(paths, pkg) {
  assert.deepEqual(
    [...pkg.files].sort(),
    [...RELEASE_FILES].sort(),
    'Package files must match the reviewed exact allowlist; no directory/glob entries.',
  );
  assert.deepEqual(
    [...paths].sort(),
    [...RELEASE_FILES, 'package.json'].sort(),
    'Missing or unexpected tarball entries.',
  );
}
export function verifyTarball(file, root, pkg) {
  // npm's reviewed short ASCII paths need no PAX/long-name/symlink entries.
  // Reject all other tar types rather than accepting hidden alternate paths.
  const raw = gunzipSync(readFileSync(file));
  const entries = [];
  let offset = 0;
  const str = (b) => b.toString('utf8').split('\0')[0];
  while (offset + 512 <= raw.length) {
    const header = raw.subarray(offset, offset + 512);
    if (header.every((x) => x === 0)) break;
    const name = str(header.subarray(0, 100));
    const prefix = str(header.subarray(345, 500));
    const type = header[156];
    assert.ok(type === 0 || type === 48, 'Unexpected non-file tar entry.');
    assert.equal(prefix, '', 'Unexpected tar path prefix.');
    assert.ok(name.startsWith('package/'), 'Unexpected archive root.');
    const path = name.slice(8);
    assert.ok(!entries.some((e) => e.path === path), 'Duplicate tar entry.');
    const size = parseInt(str(header.subarray(124, 136)).trim(), 8);
    assert.ok(
      Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= raw.length,
      'Invalid tar size.',
    );
    const bytes = raw.subarray(offset + 512, offset + 512 + size);
    // Compare exact bytes against the reviewed workspace, including package.json.
    assertInventoryPath(path);
    assert.deepEqual(bytes, readFileSync(join(root, path)), `Archive bytes differ: ${path}`);
    entries.push({ path, size, sha256: createHash('sha256').update(bytes).digest('hex') });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  assert.ok(
    raw.subarray(offset).every((x) => x === 0),
    'Unexpected archive trailer.',
  );
  assertInventory(
    entries.map((e) => e.path),
    pkg,
  );
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
function assertInventoryPath(path) {
  assert.ok([...RELEASE_FILES, 'package.json'].includes(path), `Unexpected archive path: ${path}`);
}
