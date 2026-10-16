import { afterEach, expect, it, vi } from 'vitest';
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { retirementPreview, retireSelectedProfile } from '../src/retirement.js';

const hooks = vi.hoisted(() => ({
  oversized: '',
  appeared: '',
  probes: 0,
  failQuarantineRemove: false,
  injectProfileMember: false,
  replaceKnownMemberWith: '',
}));
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return {
    ...fs,
    lstatSync: (path: import('node:fs').PathLike, options?: unknown) => {
      if (String(path) === hooks.appeared && ++hooks.probes === 5) fs.mkdirSync(hooks.appeared);
      const stat = fs.lstatSync(path, options as { bigint: true });
      return String(path) === hooks.oversized
        ? Object.assign(Object.create(stat), { size: 2n * 1024n ** 3n + 1n })
        : stat;
    },
    unlinkSync: (path: import('node:fs').PathLike) => {
      if (hooks.failQuarantineRemove && String(path).includes('.retirement-'))
        throw new Error('simulated removal interruption');
      return fs.unlinkSync(path);
    },
    renameSync: (oldPath: import('node:fs').PathLike, newPath: import('node:fs').PathLike) => {
      fs.renameSync(oldPath, newPath);
      if (hooks.injectProfileMember && String(newPath).includes('profile.retirement-'))
        fs.writeFileSync(join(String(newPath), 'unapproved'), 'KEEP');
      if (hooks.replaceKnownMemberWith && String(newPath).includes('profile.retirement-')) {
        fs.unlinkSync(join(String(newPath), 'Cookies'));
        fs.symlinkSync(hooks.replaceKnownMemberWith, join(String(newPath), 'Cookies'));
      }
    },
  };
});

const roots: string[] = [];
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-retirement-preview-')));
  roots.push(root);
  const home = join(root, 'home');
  const workingDir = join(root, 'work');
  const profileDir = join(home, '.linkedin-mcp', 'profile');
  mkdirSync(profileDir, { recursive: true });
  mkdirSync(workingDir);
  return { root, home, workingDir, profileDir, options: { homeDir: home, workingDir } };
}
afterEach(() => {
  hooks.oversized = '';
  hooks.appeared = '';
  hooks.probes = 0;
  hooks.failQuarantineRemove = false;
  hooks.injectProfileMember = false;
  hooks.replaceKnownMemberWith = '';
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it('reports only bounded counts and preserves profile and shared safety bytes', () => {
  const f = fixture();
  const privateFile = join(f.profileDir, 'private-cookie');
  const budget = join(f.home, '.linkedin-mcp', 'budgets.json');
  writeFileSync(privateFile, 'private-profile-content');
  writeFileSync(budget, 'private-budget-content');
  const report = retirementPreview(f.options);
  expect(report).toMatchObject({
    status: 'preview_only',
    applicationSupported: true,
    deletionAuthorized: false,
    proposed: { profilePresent: true, circuitPresent: false, files: 1, directories: 1 },
  });
  expect(JSON.stringify(report)).not.toMatch(
    /private-cookie|private-profile|private-budget|home|digest|ino/,
  );
  expect(readFileSync(privateFile, 'utf8')).toBe('private-profile-content');
  expect(readFileSync(budget, 'utf8')).toBe('private-budget-content');
  expect(existsSync(`${f.profileDir}.retirement.json`)).toBe(false);
});

it('requires confirmation and removes only the selected profile and circuit', () => {
  const f = fixture();
  const cookie = join(f.profileDir, 'Cookies');
  const circuit = `${f.profileDir}.circuit.json`;
  const budget = join(f.home, '.linkedin-mcp', 'budgets.json');
  const credentials = join(f.home, '.linkedin-mcp', 'credentials.json');
  writeFileSync(cookie, 'PRIVATE-COOKIE');
  writeFileSync(circuit, 'PRIVATE-CIRCUIT');
  writeFileSync(budget, 'PRIVATE-JOURNAL');
  writeFileSync(credentials, 'PRIVATE-LEGACY');
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'preview_only',
    proposed: { profilePresent: true, circuitPresent: true },
  });
  expect(() => retireSelectedProfile(f.options)).toThrow('CONFIRMATION_REQUIRED');
  expect(readFileSync(cookie, 'utf8')).toBe('PRIVATE-COOKIE');
  const result = retireSelectedProfile({ ...f.options, confirmed: true });
  expect(result).toMatchObject({
    status: 'retired',
    profileRemoved: true,
    circuitRemoved: true,
  });
  expect(result.preserved).toContain('shared_budgets_and_write_journal');
  expect(existsSync(f.profileDir)).toBe(false);
  expect(existsSync(circuit)).toBe(false);
  expect(existsSync(`${f.profileDir}.retirement.json`)).toBe(false);
  expect(existsSync(`${f.profileDir}.owner.lock`)).toBe(false);
  expect(readFileSync(budget, 'utf8')).toBe('PRIVATE-JOURNAL');
  expect(readFileSync(credentials, 'utf8')).toBe('PRIVATE-LEGACY');
});

it('preserves a new unapproved member inserted after quarantine', () => {
  const f = fixture();
  writeFileSync(join(f.profileDir, 'Cookies'), 'PRIVATE-COOKIE');
  hooks.injectProfileMember = true;
  expect(() => retireSelectedProfile({ ...f.options, confirmed: true })).toThrow(
    'CHANGED_DURING_OBSERVATION',
  );
  hooks.injectProfileMember = false;
  const names = readdirSync(join(f.home, '.linkedin-mcp'));
  const quarantine = names.find((name) => name.startsWith('profile.retirement-'));
  expect(quarantine).toBeDefined();
  expect(readFileSync(join(f.home, '.linkedin-mcp', quarantine!, 'unapproved'), 'utf8')).toBe(
    'KEEP',
  );
  expect(existsSync(`${f.profileDir}.retirement.json`)).toBe(true);
  expect(existsSync(`${f.profileDir}.owner.lock`)).toBe(true);
});

it('refuses a known member replaced by an alias after quarantine', () => {
  const f = fixture();
  const outside = join(f.root, 'outside');
  writeFileSync(outside, 'KEEP');
  writeFileSync(join(f.profileDir, 'Cookies'), 'PRIVATE-COOKIE');
  hooks.replaceKnownMemberWith = outside;
  expect(() => retireSelectedProfile({ ...f.options, confirmed: true })).toThrow('ALIAS_REFUSED');
  hooks.replaceKnownMemberWith = '';
  expect(readFileSync(outside, 'utf8')).toBe('KEEP');
  expect(existsSync(`${f.profileDir}.retirement.json`)).toBe(true);
  expect(existsSync(`${f.profileDir}.owner.lock`)).toBe(true);
});

it('does not create a lock or receipt when selected state is absent', () => {
  const f = fixture();
  rmSync(f.profileDir, { recursive: true });
  expect(retireSelectedProfile({ ...f.options, confirmed: true })).toMatchObject({
    status: 'nothing_to_retire',
    profileRemoved: false,
    circuitRemoved: false,
  });
  expect(existsSync(`${f.profileDir}.owner.lock`)).toBe(false);
  expect(existsSync(`${f.profileDir}.retirement.json`)).toBe(false);
});

it('refuses an active owner and preserves all local state', () => {
  const f = fixture();
  const cookie = join(f.profileDir, 'Cookies');
  writeFileSync(cookie, 'PRIVATE-COOKIE');
  mkdirSync(`${f.profileDir}.owner.lock`);
  expect(() => retireSelectedProfile({ ...f.options, confirmed: true })).toThrow(
    'LOCK_OWNERSHIP_UNVERIFIED',
  );
  expect(readFileSync(cookie, 'utf8')).toBe('PRIVATE-COOKIE');
  expect(existsSync(`${f.profileDir}.retirement.json`)).toBe(false);
});

it('refuses aliased circuit state before any deletion', () => {
  const f = fixture();
  const external = join(f.root, 'external');
  writeFileSync(external, 'PRIVATE-CIRCUIT');
  symlinkSync(external, `${f.profileDir}.circuit.json`);
  expect(() => retireSelectedProfile({ ...f.options, confirmed: true })).toThrow('ALIAS_REFUSED');
  expect(existsSync(f.profileDir)).toBe(true);
  expect(readFileSync(external, 'utf8')).toBe('PRIVATE-CIRCUIT');
});

it('retains an interruption marker and quarantined credentials on deletion failure', () => {
  const f = fixture();
  writeFileSync(join(f.profileDir, 'Cookies'), 'PRIVATE-COOKIE');
  hooks.failQuarantineRemove = true;
  expect(() => retireSelectedProfile({ ...f.options, confirmed: true })).toThrow(
    'simulated removal interruption',
  );
  hooks.failQuarantineRemove = false;
  expect(existsSync(`${f.profileDir}.retirement.json`)).toBe(true);
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused',
    reason: 'RETIREMENT_INCOMPLETE',
  });
  expect(existsSync(`${f.profileDir}.owner.lock`)).toBe(true);
  const names = readdirSync(join(f.home, '.linkedin-mcp'));
  expect(names.some((name) => name.startsWith('profile.retirement-'))).toBe(true);
});

it('retains the lock and marker after interrupted circuit quarantine removal', () => {
  const f = fixture();
  rmSync(f.profileDir, { recursive: true });
  writeFileSync(`${f.profileDir}.circuit.json`, 'PRIVATE-CIRCUIT');
  hooks.failQuarantineRemove = true;
  expect(() => retireSelectedProfile({ ...f.options, confirmed: true })).toThrow(
    'simulated removal interruption',
  );
  hooks.failQuarantineRemove = false;
  expect(existsSync(`${f.profileDir}.circuit.json`)).toBe(false);
  expect(existsSync(`${f.profileDir}.retirement.json`)).toBe(true);
  expect(existsSync(`${f.profileDir}.owner.lock`)).toBe(true);
  const quarantine = readdirSync(join(f.home, '.linkedin-mcp')).find((name) =>
    name.startsWith('profile.circuit.json.retirement-'),
  );
  expect(quarantine).toBeDefined();
  expect(readFileSync(join(f.home, '.linkedin-mcp', quarantine!), 'utf8')).toBe('PRIVATE-CIRCUIT');
});

it('reports an absent selected profile without creating state', () => {
  const f = fixture();
  rmSync(f.profileDir, { recursive: true });
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'preview_only',
    proposed: { profilePresent: false, files: 0, directories: 0 },
  });
  expect(existsSync(f.profileDir)).toBe(false);
});

it('refuses an owner lock without inspecting or clearing it', () => {
  const f = fixture();
  const lock = `${f.profileDir}.owner.lock`;
  mkdirSync(lock);
  writeFileSync(join(lock, 'owner.json'), 'private-owner');
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused',
    reason: 'LOCK_OWNERSHIP_UNVERIFIED',
  });
  expect(readFileSync(join(lock, 'owner.json'), 'utf8')).toBe('private-owner');
});

it('refuses the shared budget lock without inspecting or clearing it', () => {
  const f = fixture();
  const lock = join(f.home, '.linkedin-mcp', 'budgets.json.lock');
  mkdirSync(lock);
  writeFileSync(join(lock, 'owner.json'), 'private-budget-owner');
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused',
    reason: 'LOCK_OWNERSHIP_UNVERIFIED',
  });
  expect(readFileSync(join(lock, 'owner.json'), 'utf8')).toBe('private-budget-owner');
});

it('refuses nested aliases and preserves their targets', () => {
  const f = fixture();
  const target = join(f.root, 'outside');
  mkdirSync(target);
  writeFileSync(join(target, 'sentinel'), 'private-target');
  symlinkSync(
    target,
    join(f.profileDir, 'alias'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused',
    reason: 'ALIAS_REFUSED',
  });
  expect(readFileSync(join(target, 'sentinel'), 'utf8')).toBe('private-target');
});

it.each(['root', 'broken'] as const)('refuses a %s profile alias', (kind) => {
  const f = fixture();
  const target = join(f.root, 'outside');
  mkdirSync(target);
  writeFileSync(join(target, 'sentinel'), 'private-target');
  rmSync(f.profileDir, { recursive: true });
  symlinkSync(
    kind === 'root' ? target : join(f.root, 'missing'),
    f.profileDir,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused',
    reason: 'ALIAS_REFUSED',
  });
  expect(readFileSync(join(target, 'sentinel'), 'utf8')).toBe('private-target');
});

it('refuses a multiply linked member and an incomplete receipt', () => {
  const f = fixture();
  const target = join(f.root, 'external');
  writeFileSync(target, 'private-target');
  linkSync(target, join(f.profileDir, 'hardlink'));
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused',
    reason: 'MULTIPLE_LINKS_REFUSED',
  });
  rmSync(join(f.profileDir, 'hardlink'));
  writeFileSync(`${f.profileDir}.retirement.json`, 'private-receipt');
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused',
    reason: 'RETIREMENT_INCOMPLETE',
  });
  expect(readFileSync(target, 'utf8')).toBe('private-target');
});

it('refuses a profile overlapping the home or work tree', () => {
  const f = fixture();
  expect(retirementPreview({ ...f.options, profileDir: f.home })).toMatchObject({
    status: 'refused',
    reason: 'SCOPE_OVERLAP_REFUSED',
  });
  expect(retirementPreview({ ...f.options, profileDir: f.workingDir })).toMatchObject({
    status: 'refused',
    reason: 'SCOPE_OVERLAP_REFUSED',
  });
});

it('refuses a tree deeper than its fixed bound', () => {
  const f = fixture();
  mkdirSync(join(f.profileDir, ...Array.from({ length: 33 }, (_, i) => `d${i}`)), {
    recursive: true,
  });
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused',
    reason: 'TREE_BOUND_REFUSED',
  });
});

it('refuses a 5,001-entry tree without returning a partial proposal', () => {
  const f = fixture();
  for (let i = 0; i < 5000; i++) writeFileSync(join(f.profileDir, `entry-${i}`), '');
  const report = retirementPreview(f.options);
  expect(report).toMatchObject({ status: 'refused', reason: 'TREE_BOUND_REFUSED' });
  expect(report).not.toHaveProperty('proposed');
}, 60000);

it('refuses synthetic oversized metadata without reading or allocating file contents', () => {
  const f = fixture();
  const file = join(f.profileDir, 'tiny');
  writeFileSync(file, 'private-small-content');
  hooks.oversized = file;
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused',
    reason: 'BYTE_BOUND_REFUSED',
  });
  expect(readFileSync(file, 'utf8')).toBe('private-small-content');
});

it('refuses a profile that appears between inventory observations', () => {
  const f = fixture();
  rmSync(f.profileDir, { recursive: true });
  hooks.appeared = f.profileDir;
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused',
    reason: 'CHANGED_DURING_OBSERVATION',
  });
  expect(existsSync(f.profileDir)).toBe(true);
});
