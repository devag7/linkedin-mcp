import { afterEach, expect, it } from 'vitest';
import {
  existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { retirementPreview } from '../src/retirement.js';

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
    status: 'preview_only', applicationSupported: false, deletionAuthorized: false,
    proposed: { profilePresent: true, files: 1, directories: 1 },
  });
  expect(JSON.stringify(report)).not.toMatch(/private-cookie|private-profile|private-budget|home|digest|ino/);
  expect(readFileSync(privateFile, 'utf8')).toBe('private-profile-content');
  expect(readFileSync(budget, 'utf8')).toBe('private-budget-content');
  expect(existsSync(`${f.profileDir}.retirement.json`)).toBe(false);
});

it('reports an absent selected profile without creating state', () => {
  const f = fixture();
  rmSync(f.profileDir, { recursive: true });
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'preview_only', proposed: { profilePresent: false, files: 0, directories: 0 },
  });
  expect(existsSync(f.profileDir)).toBe(false);
});

it('refuses an owner lock without inspecting or clearing it', () => {
  const f = fixture();
  const lock = `${f.profileDir}.owner.lock`;
  mkdirSync(lock);
  writeFileSync(join(lock, 'owner.json'), 'private-owner');
  expect(retirementPreview(f.options)).toMatchObject({
    status: 'refused', reason: 'LOCK_OWNERSHIP_UNVERIFIED',
  });
  expect(readFileSync(join(lock, 'owner.json'), 'utf8')).toBe('private-owner');
});

it('refuses nested aliases and preserves their targets', () => {
  const f = fixture();
  const target = join(f.root, 'outside');
  mkdirSync(target);
  writeFileSync(join(target, 'sentinel'), 'private-target');
  symlinkSync(target, join(f.profileDir, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  expect(retirementPreview(f.options)).toMatchObject({ status: 'refused', reason: 'ALIAS_REFUSED' });
  expect(readFileSync(join(target, 'sentinel'), 'utf8')).toBe('private-target');
});

it('refuses a multiply linked member and an incomplete receipt', () => {
  const f = fixture();
  const target = join(f.root, 'external');
  writeFileSync(target, 'private-target');
  linkSync(target, join(f.profileDir, 'hardlink'));
  expect(retirementPreview(f.options)).toMatchObject({ status: 'refused', reason: 'MULTIPLE_LINKS_REFUSED' });
  rmSync(join(f.profileDir, 'hardlink'));
  writeFileSync(`${f.profileDir}.retirement.json`, 'private-receipt');
  expect(retirementPreview(f.options)).toMatchObject({ status: 'refused', reason: 'RETIREMENT_INCOMPLETE' });
  expect(readFileSync(target, 'utf8')).toBe('private-target');
});

it('refuses a profile overlapping the home or work tree', () => {
  const f = fixture();
  expect(retirementPreview({ ...f.options, profileDir: f.home })).toMatchObject({
    status: 'refused', reason: 'SCOPE_OVERLAP_REFUSED',
  });
  expect(retirementPreview({ ...f.options, profileDir: f.workingDir })).toMatchObject({
    status: 'refused', reason: 'SCOPE_OVERLAP_REFUSED',
  });
});

it('refuses a tree deeper than its fixed bound', () => {
  const f = fixture();
  mkdirSync(join(f.profileDir, ...Array.from({ length: 33 }, (_, i) => `d${i}`)), { recursive: true });
  expect(retirementPreview(f.options)).toMatchObject({ status: 'refused', reason: 'TREE_BOUND_REFUSED' });
});
