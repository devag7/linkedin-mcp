/** Disposable fail-closed Windows ACL cases. No real profile or account data. */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ensurePrivateStateDirectory } from '../src/safety/windows-private-state.js';

const [scenario, target] = process.argv.slice(2);
if (process.platform !== 'win32' || !scenario || !target) throw new Error('NEGATIVE_INPUT_INVALID');

const expected: Record<string, string> = {
  'untrusted-child': 'WINDOWS_STATE_PRIVACY_UNVERIFIED_UNTRUSTED_ALLOW_ACE',
  'inherited-child': 'WINDOWS_STATE_PRIVACY_UNVERIFIED_UNTRUSTED_ALLOW_ACE',
  junction: 'WINDOWS_STATE_PRIVACY_UNVERIFIED_REPARSE_POINT',
  'spoofed-home': 'WINDOWS_STATE_PRIVACY_UNVERIFIED_OUTSIDE_USER_PROFILE',
  'helper-failure': 'WINDOWS_STATE_PRIVACY_UNVERIFIED_ACL_CHECK_FAILED_SPAWN',
};
if (!expected[scenario]) throw new Error('NEGATIVE_SCENARIO_INVALID');

if (scenario === 'spoofed-home') process.env.USERPROFILE = dirname(target);
if (scenario === 'helper-failure') process.env.SystemRoot = 'Z:\\lmcp-missing-windows-root';

try {
  ensurePrivateStateDirectory(target, scenario === 'untrusted-child');
  if (scenario === 'inherited-child')
    writeFileSync(join(target, 'would-be-secret.txt'), 'synthetic only');
  throw new Error('NEGATIVE_WAS_ACCEPTED');
} catch (error) {
  if ((error as Error).message !== expected[scenario]) throw new Error('NEGATIVE_REFUSAL_MISMATCH');
  if (scenario === 'spoofed-home' && existsSync(target)) throw new Error('NEGATIVE_CREATED_STATE');
  if (scenario === 'inherited-child' && existsSync(join(target, 'would-be-secret.txt')))
    throw new Error('NEGATIVE_CREATED_STATE');
}
process.stdout.write(`{"negativeAcl":"passed","scenario":"${scenario}"}\n`);
