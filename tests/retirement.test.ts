/** Disposable metadata and transaction fixtures only. No real profile or account access. */
import { afterEach, expect, it, vi } from 'vitest';
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { StateLock } from '../src/safety/state-lock.js';
import { prepareRetirement, retirementPreview } from '../src/retirement.js';
import {
  createRetirementFixture,
  retireFixture,
} from '../scripts/retirement-transaction-fixture.js';

const hooks = vi.hoisted(() => ({ oversized: '', appeared: '', probes: 0 }));
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
  };
});

const fixtures: ReturnType<typeof createRetirementFixture>[] = [];
const fixture = () => {
  const f = createRetirementFixture();
  fixtures.push(f);
  return f;
};
const options = (f: ReturnType<typeof fixture>) => ({ homeDir: f.home, workingDir: f.root });
const digest = (f: ReturnType<typeof fixture>) => prepareRetirement(options(f)).digest;
const safety = (f: ReturnType<typeof fixture>) => [
  `${f.profile}.circuit.json`,
  join(f.home, '.linkedin-mcp', 'budgets.json'),
  join(f.home, '.linkedin-mcp', 'credentials.json'),
];
afterEach(() => {
  hooks.oversized = '';
  hooks.appeared = '';
  hooks.probes = 0;
  for (const f of fixtures.splice(0)) rmSync(f.root, { recursive: true, force: true });
});
it('refuses synthetic oversized metadata without allocating or reading large file contents', () => {
  const f = fixture();
  const path = join(f.profile, 'small-fixture');
  writeFileSync(path, 'tiny');
  hooks.oversized = path;
  expect(retirementPreview(options(f))).toMatchObject({
    status: 'refused',
    reason: 'BYTE_BOUND_REFUSED',
  });
  expect(readFileSync(path, 'utf8')).toBe('tiny');
});
it('does not call an absent profile ready when it appears before the final inventory', () => {
  const f = fixture();
  rmSync(f.profile, { recursive: true });
  hooks.appeared = f.profile;
  expect(retirementPreview(options(f))).toMatchObject({
    status: 'refused',
    reason: 'CHANGED_DURING_OBSERVATION',
  });
  expect(existsSync(f.profile)).toBe(true);
});

it('previews bounded metadata without reading or deleting private file contents', () => {
  const f = fixture();
  mkdirSync(join(f.profile, 'Cache'));
  writeFileSync(join(f.profile, 'Cache', 'private-name'), 'private-cookie-content');
  for (const path of safety(f)) writeFileSync(path, 'opaque-private-safety-content');
  const before = safety(f).map((path) => readFileSync(path));
  const report = retirementPreview(options(f));
  expect(report.status).toBe('preview_only');
  expect(report).toMatchObject({
    applicationSupported: false,
    deletionAuthorized: false,
    proposed: { files: 1, directories: 2, profilePresent: true },
  });
  expect(JSON.stringify(report)).not.toMatch(
    /private-name|private-cookie|opaque-private|retirement-proof|digest|ino|dev/,
  );
  expect(existsSync(`${f.profile}.retirement.json`)).toBe(false);
  expect(readFileSync(join(f.profile, 'Cache', 'private-name'), 'utf8')).toBe(
    'private-cookie-content',
  );
  safety(f).forEach((path, i) => expect(readFileSync(path)).toEqual(before[i]));
});
it('reports absence without creating a profile, lock or receipt', () => {
  const f = fixture();
  rmSync(f.profile, { recursive: true });
  expect(retirementPreview(options(f))).toMatchObject({
    status: 'preview_only',
    proposed: { profilePresent: false, files: 0, directories: 0 },
  });
  expect(readdirSync(join(f.home, '.linkedin-mcp'))).toEqual([]);
});
it.each(['profile', 'budget'])(
  'refuses a present %s owner without stealing or altering it',
  (kind) => {
    const f = fixture();
    const lock = new StateLock(
      kind === 'profile' ? `${f.profile}.owner` : join(f.home, '.linkedin-mcp', 'budgets.json'),
      kind === 'profile',
    );
    lock.acquire();
    const original = readFileSync(join(lock.directory, 'owner.json'));
    expect(retirementPreview(options(f))).toMatchObject({
      status: 'refused',
      reason: 'LOCK_OWNERSHIP_UNVERIFIED',
    });
    expect(() => retireFixture(f, { previewDigest: 'not-a-proof' })).toThrow();
    expect(readFileSync(join(lock.directory, 'owner.json'))).toEqual(original);
    lock.release();
  },
);
it.each(['root', 'nested', 'broken'])(
  'refuses %s directory aliases and preserves their targets',
  (kind) => {
    const f = fixture();
    const outside = join(f.root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'sentinel'), 'preserved');
    if (kind === 'root') rmSync(f.profile, { recursive: true });
    symlinkSync(
      kind === 'broken' ? join(f.root, 'absent') : outside,
      kind === 'root' ? f.profile : join(f.profile, 'alias'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    expect(retirementPreview(options(f))).toMatchObject({
      status: 'refused',
      reason: 'ALIAS_REFUSED',
    });
    expect(readFileSync(join(outside, 'sentinel'), 'utf8')).toBe('preserved');
  },
);
it('refuses a multiply-linked profile file without removing either entry', () => {
  const f = fixture();
  const outside = join(f.root, 'preserved');
  writeFileSync(outside, 'private');
  linkSync(outside, join(f.profile, 'hardlink'));
  expect(retirementPreview(options(f))).toMatchObject({
    status: 'refused',
    reason: 'MULTIPLE_LINKS_REFUSED',
  });
  expect(readFileSync(outside, 'utf8')).toBe('private');
});
it('refuses overlapping scope and does not enumerate the home', () => {
  const f = fixture();
  expect(retirementPreview({ ...options(f), profileDir: f.home })).toMatchObject({
    status: 'refused',
    reason: 'SCOPE_OVERLAP_REFUSED',
  });
});
it('bounds directory depth with disposable directories', () => {
  const f = fixture();
  mkdirSync(join(f.profile, ...Array.from({ length: 33 }, (_, i) => `d${i}`)), { recursive: true });
  expect(retirementPreview(options(f))).toMatchObject({
    status: 'refused',
    reason: 'TREE_BOUND_REFUSED',
  });
});
it('bounds the entry count before producing a partial proposal', () => {
  const f = fixture();
  for (let i = 0; i < 5000; i++) writeFileSync(join(f.profile, `entry-${i}`), '');
  const report = retirementPreview(options(f));
  expect(report).toMatchObject({ status: 'refused', reason: 'TREE_BOUND_REFUSED' });
  expect(report).not.toHaveProperty('proposed');
  expect(readdirSync(f.profile)).toHaveLength(5000);
}, 60000);
it('refuses an incomplete transaction even when the selected profile is absent', () => {
  const f = fixture();
  rmSync(f.profile, { recursive: true });
  writeFileSync(`${f.profile}.retirement.json`, 'private-malformed');
  expect(retirementPreview(options(f))).toMatchObject({
    status: 'refused',
    reason: 'RETIREMENT_INCOMPLETE',
  });
  expect(readFileSync(`${f.profile}.retirement.json`, 'utf8')).toBe('private-malformed');
});
it('rejects a forged real-state capability before any filesystem operation', () => {
  expect(() =>
    retireFixture(
      Object.freeze({
        root: '/never-open-this',
        home: '/never-open-this',
        profile: '/never-open-this',
      }),
    ),
  ).toThrow('DISPOSABLE_CAPABILITY_REQUIRED');
});
it('requires an exact reviewed private preview digest and refuses changes after preview', () => {
  const f = fixture();
  writeFileSync(join(f.profile, 'Cookies'), 'private');
  const proof = digest(f);
  writeFileSync(join(f.profile, 'Cookies'), 'private-changed');
  expect(() => retireFixture(f, { previewDigest: proof })).toThrow('REVIEWED_PREVIEW_REQUIRED');
  expect(readFileSync(join(f.profile, 'Cookies'), 'utf8')).toBe('private-changed');
  expect(existsSync(`${f.profile}.owner.lock`)).toBe(false);
});
it('retires only the fixture profile, preserving every external safety file and other profile', () => {
  const f = fixture();
  writeFileSync(join(f.profile, 'Cookies'), 'private');
  for (const path of safety(f)) writeFileSync(path, 'preserved-opaque');
  const other = join(f.root, 'other-profile');
  mkdirSync(other);
  writeFileSync(join(other, 'Cookies'), 'other');
  expect(retireFixture(f, { previewDigest: digest(f) })).toEqual({
    status: 'fixture_profile_retired',
    completeErasure: false,
    sharedSafetyStatePreserved: true,
  });
  expect(existsSync(f.profile)).toBe(false);
  for (const path of safety(f)) expect(readFileSync(path, 'utf8')).toBe('preserved-opaque');
  expect(readFileSync(join(other, 'Cookies'), 'utf8')).toBe('other');
  expect(existsSync(`${f.profile}.owner.lock`)).toBe(false);
  expect(existsSync(join(f.home, '.linkedin-mcp', 'budgets.json.lock'))).toBe(false);
});
it.each(['prepared', 'renamed', 'first_entry'] as const)(
  'persists fail-closed %s interruption and resumes from disk only after fixture-owner repair',
  (interruptAt) => {
    const f = fixture();
    mkdirSync(join(f.profile, 'Cache'));
    writeFileSync(join(f.profile, 'Cache', 'entry'), 'private');
    for (const path of safety(f)) writeFileSync(path, 'preserved');
    expect(() => retireFixture(f, { previewDigest: digest(f), interruptAt })).toThrow(
      'FIXTURE_INTERRUPTED',
    );
    expect(existsSync(`${f.profile}.retirement.json`)).toBe(true);
    expect(existsSync(`${f.profile}.owner.lock`)).toBe(true);
    expect(() => retireFixture(f, { resume: true })).toThrow();
    // Only the test fixture owner clears its own disposable abandoned locks.
    rmSync(`${f.profile}.owner.lock`, { recursive: true });
    rmSync(join(f.home, '.linkedin-mcp', 'budgets.json.lock'), { recursive: true });
    expect(retireFixture(f, { resume: true }).status).toBe('fixture_profile_retired');
    expect(existsSync(`${f.profile}.retirement.json`)).toBe(false);
    for (const path of safety(f)) expect(readFileSync(path, 'utf8')).toBe('preserved');
  },
);
it('refuses a recreated profile during disk recovery rather than deleting its replacement', () => {
  const f = fixture();
  writeFileSync(join(f.profile, 'Cookies'), 'old');
  expect(() => retireFixture(f, { previewDigest: digest(f), interruptAt: 'renamed' })).toThrow();
  rmSync(`${f.profile}.owner.lock`, { recursive: true });
  rmSync(join(f.home, '.linkedin-mcp', 'budgets.json.lock'), { recursive: true });
  mkdirSync(f.profile);
  writeFileSync(join(f.profile, 'Cookies'), 'replacement');
  expect(() => retireFixture(f, { resume: true })).toThrow('PROFILE_RECREATED');
  expect(readFileSync(join(f.profile, 'Cookies'), 'utf8')).toBe('replacement');
});
it('refuses new unapproved quarantine entries during recovery', () => {
  const f = fixture();
  writeFileSync(join(f.profile, 'Cookies'), 'old');
  expect(() => retireFixture(f, { previewDigest: digest(f), interruptAt: 'renamed' })).toThrow();
  const quarantine = join(
    f.home,
    '.linkedin-mcp',
    readdirSync(join(f.home, '.linkedin-mcp')).find((name) =>
      name.startsWith('profile.retirement-'),
    )!,
  );
  writeFileSync(join(quarantine, 'unapproved'), 'preserved');
  rmSync(`${f.profile}.owner.lock`, { recursive: true });
  rmSync(join(f.home, '.linkedin-mcp', 'budgets.json.lock'), { recursive: true });
  expect(() => retireFixture(f, { resume: true })).toThrow('QUARANTINE_CHANGED');
  expect(readFileSync(join(quarantine, 'unapproved'), 'utf8')).toBe('preserved');
});
it('refuses a changed saved manifest without trusting a tampered receipt', () => {
  const f = fixture();
  writeFileSync(join(f.profile, 'Cookies'), 'private');
  expect(() => retireFixture(f, { previewDigest: digest(f), interruptAt: 'prepared' })).toThrow();
  const path = `${f.profile}.retirement.json`;
  const receipt = JSON.parse(readFileSync(path, 'utf8'));
  receipt.entries[1].size = '999';
  writeFileSync(path, JSON.stringify(receipt));
  expect(() => retireFixture(f, { resume: true })).toThrow('RECEIPT_DIGEST_MISMATCH');
  expect(readFileSync(join(f.profile, 'Cookies'), 'utf8')).toBe('private');
});
it('refuses an aliased recovery parent before creating locks through it', () => {
  const f = fixture();
  expect(() => retireFixture(f, { previewDigest: digest(f), interruptAt: 'prepared' })).toThrow(
    'FIXTURE_INTERRUPTED',
  );
  rmSync(`${f.profile}.owner.lock`, { recursive: true });
  rmSync(join(f.home, '.linkedin-mcp', 'budgets.json.lock'), { recursive: true });
  const moved = join(f.root, 'moved-home');
  renameSync(f.home, moved);
  symlinkSync(moved, f.home, process.platform === 'win32' ? 'junction' : 'dir');
  expect(() => retireFixture(f, { resume: true })).toThrow('FIXTURE_IDENTITY_CHANGED');
  expect(existsSync(join(moved, '.linkedin-mcp', 'profile.owner.lock'))).toBe(false);
  expect(existsSync(join(moved, '.linkedin-mcp', 'budgets.json.lock'))).toBe(false);
  expect(existsSync(join(moved, '.linkedin-mcp', 'profile'))).toBe(true);
});
