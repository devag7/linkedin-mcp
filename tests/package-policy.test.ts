import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
// Pure policy tests; actual tar bytes are checked by verify:package on every CI OS.
// @ts-expect-error JavaScript build tooling has no TypeScript declarations.
import { assertInventory, RELEASE_FILES } from '../scripts/package-policy.mjs';
const pkg = createRequire(import.meta.url)('../package.json');
it('accepts only the reviewed exact package inventory', () => {
  expect(() => assertInventory([...RELEASE_FILES, 'package.json'], pkg)).not.toThrow();
});
it.each(['dist/index 2.js', 'docs/PRIVACY 2.md', 'dist/extra.js', 'docs/secret.json'])(
  'rejects unexpected entry %s',
  (file) => {
    expect(() => assertInventory([...RELEASE_FILES, 'package.json', file], pkg)).toThrow();
  },
);
it('rejects missing output, duplicate entries and broadened package globs', () => {
  expect(() => assertInventory(['package.json'], pkg)).toThrow();
  expect(() => assertInventory([...RELEASE_FILES, 'package.json', 'LICENSE'], pkg)).toThrow();
  expect(() =>
    assertInventory([...RELEASE_FILES, 'package.json'], { ...pkg, files: ['dist', 'docs'] }),
  ).toThrow();
});
