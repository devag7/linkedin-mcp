/** Only disposable fixtures; no account, runtime or real profile access. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readFileSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  linkSync,
  renameSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const hooks = vi.hoisted(() => ({
  stat: null as null | ((file: string, count: number) => unknown),
  calls: new Map<string, number>(),
  realpath: null as null | ((file: string, count: number) => string | undefined),
  realCalls: new Map<string, number>(),
}));
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return {
    ...fs,
    lstatSync: (file: string, options: { bigint: true }) => {
      const count = (hooks.calls.get(file) ?? 0) + 1;
      hooks.calls.set(file, count);
      return hooks.stat?.(String(file), count) ?? fs.lstatSync(file, options);
    },
    realpathSync: (file: string) => {
      const count = (hooks.realCalls.get(String(file)) ?? 0) + 1;
      hooks.realCalls.set(String(file), count);
      return hooks.realpath?.(String(file), count) ?? fs.realpathSync(file);
    },
  };
});
import { dataInventory } from '../src/data-inventory.js';
let root: string;
let home: string;
let state: string;
let profile: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-inventory-')));
  home = join(root, 'private-home');
  state = join(home, '.linkedin-mcp');
  profile = join(state, 'profile');
  mkdirSync(home);
  hooks.calls.clear();
  hooks.realCalls.clear();
});
afterEach(() => {
  hooks.stat = null;
  hooks.realpath = null;
  rmSync(root, { force: true, recursive: true });
});
const report = (profileDir?: string) =>
  dataInventory({ homeDir: home, workingDir: join(root, 'work'), profileDir });
const entry = (category: string, profileDir?: string) =>
  report(profileDir).entries.find((e) => e.category === category)!;
const link = (target: string, name: string) =>
  symlinkSync(target, name, process.platform === 'win32' ? 'junction' : 'dir');

it('observes true absence without creating storage or claiming deletion readiness', () => {
  const result = report();
  expect(result.status).toBe('observed');
  expect(result.entries.every((e) => e.observation === 'absent')).toBe(true);
  expect(result.erasurePreview).toMatchObject({
    supported: false,
    deletionAuthorized: false,
    ownership: 'unverified',
  });
  expect(readdirSync(home)).toEqual([]);
});
it('reports fixed categories only and preserves sensitive bytes including malformed opaque JSON', () => {
  mkdirSync(profile, { recursive: true });
  const privateFiles = [
    join(profile, 'Cookies'),
    `${profile}.circuit.json`,
    join(state, 'budgets.json'),
    join(state, 'credentials.json'),
  ];
  for (const file of privateFiles) writeFileSync(file, 'SECRET-cookie-target-content {malformed');
  const before = privateFiles.map((f) => readFileSync(f));
  const result = report();
  expect(result.entries.map((e) => e.category)).toEqual([
    'browser_profile',
    'circuit_state',
    'profile_owner_lock',
    'budgets_and_write_journal',
    'budget_transaction_lock',
    'legacy_credentials',
  ]);
  expect(
    result.entries.every((e) => e.content === 'not_inspected' && e.ownership === 'unverified'),
  ).toBe(true);
  expect(result.entries.find((e) => e.category === 'budgets_and_write_journal')?.scope).toBe(
    'shared_across_profiles',
  );
  expect(JSON.stringify(result)).not.toMatch(/SECRET|private-home|Cookies|malformed/);
  expect(result.limitations.join(' ')).toContain('JSON validity');
  privateFiles.forEach((f, i) => expect(readFileSync(f)).toEqual(before[i]));
});
it.each(['leaf', 'parent', 'broken'])(
  'refuses %s aliases instead of treating them as absence',
  (where) => {
    const outside = join(root, 'outside');
    mkdirSync(outside);
    if (where === 'parent') link(outside, state);
    else {
      mkdirSync(state);
      link(where === 'broken' ? join(root, 'missing-target') : outside, profile);
    }
    expect(entry('browser_profile')).toMatchObject({
      observation: 'refused',
      reason: 'ALIAS_REFUSED',
    });
    expect(readdirSync(outside)).toEqual([]);
  },
);
it.skipIf(process.platform === 'win32')(
  'refuses a leaf file symlink without exposing its target',
  () => {
    mkdirSync(state);
    const secret = join(root, 'private-target');
    writeFileSync(secret, 'SECRET');
    // Windows junction fixtures above prove directory aliases; file links can need privilege.
    symlinkSync(secret, join(state, 'credentials.json'));
    expect(entry('legacy_credentials')).toMatchObject({
      observation: 'refused',
      reason: 'ALIAS_REFUSED',
    });
    expect(readFileSync(secret, 'utf8')).toBe('SECRET');
  },
);
it.each(['profile', 'circuit', 'budget', 'lock'])('refuses unexpected %s entry types', (kind) => {
  mkdirSync(state);
  const file =
    kind === 'profile'
      ? profile
      : kind === 'circuit'
        ? `${profile}.circuit.json`
        : kind === 'budget'
          ? join(state, 'budgets.json')
          : `${profile}.owner.lock`;
  if (kind === 'profile' || kind === 'lock') writeFileSync(file, 'fixture');
  else mkdirSync(file);
  const category =
    kind === 'profile'
      ? 'browser_profile'
      : kind === 'circuit'
        ? 'circuit_state'
        : kind === 'budget'
          ? 'budgets_and_write_journal'
          : 'profile_owner_lock';
  expect(entry(category)).toMatchObject({ observation: 'refused', reason: 'TYPE_REFUSED' });
});
it('refuses a malformed ancestor before ENOENT can become absence', () => {
  writeFileSync(state, 'not a directory');
  expect(entry('browser_profile')).toMatchObject({
    observation: 'refused',
    reason: 'TYPE_REFUSED',
  });
});
it.each(['profile_owner_lock', 'budget_transaction_lock'])(
  'never reads, steals or interprets %s ownership',
  (category) => {
    mkdirSync(state);
    const lock =
      category === 'profile_owner_lock'
        ? `${profile}.owner.lock`
        : join(state, 'budgets.json.lock');
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner.json'), '{"token":"SECRET","pid":1234567,"host":"SECRET"}');
    expect(entry(category)).toMatchObject({
      observation: 'uncertain',
      reason: 'LOCK_OWNERSHIP_UNVERIFIED',
    });
    expect(report().status).toBe('needs_attention');
    expect(readFileSync(join(lock, 'owner.json'), 'utf8')).toContain('SECRET');
    expect(JSON.stringify(report())).not.toContain('1234567');
  },
);
it('refuses hard-linked safety files', () => {
  mkdirSync(state);
  const source = join(root, 'other-owner');
  writeFileSync(source, 'preserve');
  linkSync(source, join(state, 'budgets.json'));
  expect(entry('budgets_and_write_journal')).toMatchObject({
    observation: 'refused',
    reason: 'MULTIPLE_LINKS_REFUSED',
  });
  expect(readFileSync(source, 'utf8')).toBe('preserve');
});
it.each(['EACCES', 'EIO', 'EPERM'])(
  'inaccessible ancestry stays uncertain on %s without leaking errors',
  (code) => {
    hooks.stat = (file) => {
      if (file === home) throw Object.assign(new Error('SECRET-private-path'), { code });
    };
    const result = report();
    expect(
      result.entries.every((e) => e.observation === 'uncertain' && e.reason === 'ACCESS_UNCERTAIN'),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  },
);
it('changed leaf identity fails closed rather than claiming presence', () => {
  mkdirSync(profile, { recursive: true });
  hooks.stat = (file, count) => {
    if (file === profile && count === 2) {
      renameSync(profile, `${profile}-old`);
      mkdirSync(profile);
    }
  };
  expect(entry('browser_profile')).toMatchObject({
    observation: 'uncertain',
    reason: 'CHANGED_DURING_OBSERVATION',
  });
});
it('a missing leaf created during the observation is uncertain', () => {
  mkdirSync(state);
  hooks.stat = (file, count) => {
    if (file === profile && count === 2) mkdirSync(profile);
  };
  expect(entry('browser_profile')).toMatchObject({
    observation: 'uncertain',
    reason: 'CHANGED_DURING_OBSERVATION',
  });
});
it('an ancestor changed between snapshots fails closed', () => {
  mkdirSync(state);
  hooks.stat = (file, count) => {
    if (file === state && count === 2) {
      renameSync(state, `${state}-old`);
      mkdirSync(state);
    }
  };
  expect(entry('browser_profile')).toMatchObject({
    observation: 'uncertain',
    reason: 'CHANGED_DURING_OBSERVATION',
  });
});
it('refuses ancestry replaced after stat but before canonical resolution', () => {
  mkdirSync(state);
  hooks.realpath = (file, count) => {
    if (file === state && count === 2) {
      renameSync(state, `${state}-old`);
      mkdirSync(state);
    }
    return undefined;
  };
  expect(entry('browser_profile')).toMatchObject({
    observation: 'uncertain',
    reason: 'CHANGED_DURING_OBSERVATION',
  });
});
it('refuses canonical aliases even when lstat reports a real directory', () => {
  hooks.realpath = (file) => (file === home ? `${home}-canonical-alias` : undefined);
  expect(entry('browser_profile')).toMatchObject({
    observation: 'refused',
    reason: 'ALIAS_REFUSED',
  });
});
it('does not mistake unrelated ancestor directory entries for identity replacement', () => {
  hooks.realpath = (file, count) => {
    if (file === root && count === 1) mkdirSync(join(root, 'unrelated-sibling'));
    return undefined;
  };
  expect(report().status).toBe('observed');
});
it.each(['zero_identity', 'canonical_alias', 'realpath_failure'])(
  'treats synthetic %s evidence conservatively',
  (kind) => {
    // The inventory must never assume unavailable platform identity means a clean entry.
    hooks.stat = (file) => {
      if (file === home && kind === 'zero_identity')
        return { ino: 0n, isSymbolicLink: () => false, isDirectory: () => true };
      if (file === home && kind === 'realpath_failure') {
        renameSync(home, `${home}-old`);
        return { ino: 1n, isSymbolicLink: () => false, isDirectory: () => true };
      }
    };
    if (kind === 'canonical_alias') {
      const aliasedHome = join(root, 'home-link');
      link(home, aliasedHome);
      expect(dataInventory({ homeDir: aliasedHome }).status).toBe('needs_attention');
    } else
      expect(entry('browser_profile')).toMatchObject({
        observation: 'uncertain',
        reason: kind === 'zero_identity' ? 'IDENTITY_UNAVAILABLE' : 'ACCESS_UNCERTAIN',
      });
  },
);
it.each(['home', 'state_root', 'working_directory'])('refuses profile overlap with %s', (which) => {
  const selected = which === 'home' ? home : which === 'state_root' ? state : join(root, 'work');
  expect(entry('browser_profile', selected)).toMatchObject({
    observation: 'refused',
    reason: 'SCOPE_OVERLAP_REFUSED',
  });
});
it('bounds deep paths before any filesystem scan', () => {
  const selected = join(root, ...Array.from({ length: 100 }, () => 'deep'));
  expect(entry('browser_profile', selected)).toMatchObject({
    observation: 'refused',
    reason: 'PATH_BOUND_REFUSED',
  });
});
it('supports a selected profile without moving shared state to its directory', () => {
  const selected = join(root, 'custom-profile');
  mkdirSync(selected);
  mkdirSync(state);
  writeFileSync(join(state, 'budgets.json'), 'fixture');
  const result = report(selected);
  expect(result.profileSelection).toBe('configured');
  expect(result.entries.find((e) => e.category === 'browser_profile')?.observation).toBe('present');
  expect(result.entries.find((e) => e.category === 'budgets_and_write_journal')?.observation).toBe(
    'present',
  );
  expect(JSON.stringify(result)).not.toContain(root);
});
