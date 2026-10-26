/** Disposable build contract, including unrelated output preservation. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const fixture = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-build-contract-')));
try {
  for (const file of ['src', 'tsconfig.json', 'package.json'])
    cpSync(join(root, file), join(fixture, file), { recursive: true });
  const dist = join(fixture, 'dist');
  mkdirSync(dist);
  const sentinel = 'owned disposable fixture, preserve';
  for (const file of ['index 2.js', 'unrelated.txt']) writeFileSync(join(dist, file), sentinel);
  execFileSync(process.execPath, [resolve('scripts/build.mjs')], {
    cwd: fixture,
    stdio: 'pipe',
    timeout: 30000,
  });
  for (const file of ['index 2.js', 'unrelated.txt'])
    assert.equal(readFileSync(join(dist, file), 'utf8'), sentinel);
  assert.deepEqual(readdirSync(dist).sort(), [
    'index 2.js',
    'index.js',
    'index.js.map',
    'unrelated.txt',
  ]);
  const output = readFileSync(join(dist, 'index.js'), 'utf8');
  assert.equal(output.split('\n')[0], '#!/usr/bin/env node');
  assert.ok(output.includes('//# sourceMappingURL=index.js.map'));
  if (process.platform !== 'win32')
    assert.equal(statSync(join(dist, 'index.js')).mode & 0o777, 0o755);
  const map = JSON.parse(readFileSync(join(dist, 'index.js.map'), 'utf8'));
  assert.equal(map.version, 3);
  assert.ok(map.sources.length > 0);
  assert.equal(map.sources.length, map.sourcesContent.length);
  assert.ok(
    map.sources.every((file) => file.startsWith('../src/') && !file.includes('node_modules')),
  );
  console.log(
    JSON.stringify({
      disposableBuildContract: 'passed',
      shebang: 'preserved',
      sourceMap: 'linked',
      unrelatedOutputs: 'preserved',
      executableMode:
        process.platform === 'win32'
          ? 'not applicable; installed npm shim checked separately'
          : '0755',
    }),
  );
} finally {
  rmSync(fixture, { force: true, recursive: true });
}
