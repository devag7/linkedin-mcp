/** Called by prepack; --ignore-scripts still uses the exact package.files list. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { assertInventory } from './package-policy.mjs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run verify:pack.');
const [packed] = JSON.parse(
  execFileSync(process.execPath, [npmCli, 'pack', '--dry-run', '--ignore-scripts', '--json'], {
    encoding: 'utf8',
    timeout: 30000,
  }),
);
assertInventory(
  packed.files.map((entry) => entry.path),
  pkg,
);
// Keep npm pack --json stdout machine-readable for the release helper.
process.stderr.write(
  JSON.stringify({ packageInventory: 'passed', files: packed.files.length }) + '\n',
);
