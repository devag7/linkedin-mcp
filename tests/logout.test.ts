/** Disposable fixtures only. No access to a real browser profile. */
import { afterEach, beforeEach, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeSavedProfile } from '../src/browser/logout.js';
import { StateLock } from '../src/safety/state-lock.js';
let dir: string;
beforeEach(() => {
  dir = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-logout-')));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const link = (target: string, alias: string) =>
  symlinkSync(target, alias, process.platform === 'win32' ? 'junction' : 'dir');
const options = () => ({ homeDir: join(dir, 'home'), workingDir: join(dir, 'work') });
it.each(['leaf', 'parent'])(
  'refuses the default profile %s alias without deleting target contents',
  (where) => {
    const home = join(dir, 'home');
    mkdirSync(home);
    const external = join(dir, 'outside');
    mkdirSync(external);
    writeFileSync(join(external, 'sentinel'), 'keep');
    if (where === 'leaf') {
      mkdirSync(join(home, '.linkedin-mcp'));
      link(external, join(home, '.linkedin-mcp', 'profile'));
    } else {
      mkdirSync(join(external, 'profile'));
      link(external, join(home, '.linkedin-mcp'));
    }
    expect(() => removeSavedProfile(options())).toThrow('PROFILE_ALIAS_REFUSED');
    expect(readFileSync(join(external, 'sentinel'), 'utf8')).toBe('keep');
  },
);
it('refuses even an explicitly confirmed custom alias', () => {
  const external = join(dir, 'outside');
  mkdirSync(external);
  writeFileSync(join(external, 'sentinel'), 'keep');
  const alias = join(dir, 'alias');
  link(external, alias);
  expect(() =>
    removeSavedProfile({ ...options(), profileDir: alias, confirmCustom: true }),
  ).toThrow('PROFILE_ALIAS_REFUSED');
  expect(readFileSync(join(external, 'sentinel'), 'utf8')).toBe('keep');
});
it('unlinks nested directory aliases without deleting their targets and retains safety history', () => {
  const profile = join(dir, 'home', '.linkedin-mcp', 'profile');
  mkdirSync(profile, { recursive: true });
  const external = join(dir, 'outside');
  mkdirSync(external);
  writeFileSync(join(external, 'sentinel'), 'keep');
  link(external, join(profile, 'nested'));
  writeFileSync(`${profile}.circuit.json`, 'retained');
  expect(removeSavedProfile(options())).toBe(true);
  expect(existsSync(profile)).toBe(false);
  expect(readFileSync(join(external, 'sentinel'), 'utf8')).toBe('keep');
  expect(readFileSync(`${profile}.circuit.json`, 'utf8')).toBe('retained');
});
it('refuses filesystem roots, home and workspace ancestors, even with confirmation', () => {
  for (const target of [dir, join(dir, 'home'), join(dir, 'work')])
    expect(() =>
      removeSavedProfile({ ...options(), profileDir: target, confirmCustom: true }),
    ).toThrow('PROFILE_DELETION_ROOT_REFUSED');
});
it('refuses an owned profile and leaves it intact', () => {
  const profile = join(dir, 'home', '.linkedin-mcp', 'profile');
  mkdirSync(profile, { recursive: true });
  const lock = new StateLock(`${profile}.owner`, true);
  lock.acquire();
  try {
    expect(() => removeSavedProfile(options())).toThrow('owned by another process');
    expect(existsSync(profile)).toBe(true);
  } finally {
    lock.release();
  }
});
it('does nothing when the default profile is absent and still requires custom confirmation', () => {
  expect(removeSavedProfile(options())).toBe(false);
  expect(() => removeSavedProfile({ ...options(), profileDir: join(dir, 'custom') })).toThrow(
    'confirm-profile-deletion',
  );
});
