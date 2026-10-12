/** Disposable native Windows ACL probe. Never point this at real user state. */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BudgetTracker } from '../src/safety/budgets.js';
import { StateLock } from '../src/safety/state-lock.js';

const root = process.argv[2];
if (process.platform !== 'win32' || !root || !path.isAbsolute(root))
  throw new Error('WINDOWS_DISPOSABLE_ROOT_REQUIRED');
if (fs.existsSync(root)) throw new Error('DISPOSABLE_ROOT_MUST_BE_ABSENT');

const state = path.join(root, '.linkedin-mcp');
const profile = path.join(state, 'profile');
const nested = path.join(profile, 'Default');
fs.mkdirSync(nested, { recursive: true, mode: 0o700 });
fs.writeFileSync(path.join(nested, 'synthetic-cookie.txt'), 'synthetic only', {
  flag: 'wx',
  mode: 0o600,
});

// Exercise the production lock and budget persistence paths with synthetic data.
new StateLock(profile, true).acquire();
new BudgetTracker(null, { storagePath: path.join(state, 'budgets.json') }).bindAccount(
  `acct_${'0'.repeat(64)}`,
);
new StateLock(path.join(state, 'budgets.json')).acquire();

process.stdout.write('{"fixture":"created","scope":"disposable-only"}\n');
