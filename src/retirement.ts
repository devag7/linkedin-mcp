/** Bounded offline retirement preview. No deletion, locks, content reads or provider calls. */
import { createHash } from 'node:crypto';
import { lstatSync, opendirSync, realpathSync, type BigIntStats } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { dataInventory } from './data-inventory.js';

export const RETIREMENT_LIMITS = { entries: 5000, depth: 32, bytes: 2 * 1024 ** 3 } as const;
export interface RetirementEntry {
  name: string;
  directory: boolean;
  dev: string;
  ino: string;
  mode: string;
  size: string;
  links: string;
  modified: string;
  changed: string;
}
export interface RetirementPlan {
  profile: string;
  entries: RetirementEntry[];
  digest: string;
  inventory: ReturnType<typeof dataInventory>;
}
export class RetirementError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
function reject(code: string): never {
  throw new RetirementError(code);
}
function identical(a: BigIntStats, b: BigIntStats) {
  return (
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.mode === b.mode &&
    a.nlink === b.nlink &&
    a.size === b.size &&
    a.mtimeNs === b.mtimeNs &&
    a.ctimeNs === b.ctimeNs
  );
}
function contains(parent: string, child: string) {
  const tail = relative(parent, child);
  return (
    tail === '' ||
    (!isAbsolute(tail) &&
      tail !== '..' &&
      !tail.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`))
  );
}

/** Ancestry is rechecked after observation; no identity/permission authority is inferred. */
export function retirementAncestry(profile: string) {
  const chain: string[] = [];
  for (let current = dirname(profile); ; current = dirname(current)) {
    chain.push(current);
    if (chain.length > 96) reject('PATH_BOUND_REFUSED');
    if (current === parse(current).root) break;
  }
  const observed = chain.reverse().map((path) => {
    const stat = lstatSync(path, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()) reject('ALIAS_REFUSED');
    if (stat.ino === 0n) reject('IDENTITY_UNAVAILABLE');
    const actual = realpathSync(path);
    if (
      process.platform === 'win32' ? actual.toLowerCase() !== path.toLowerCase() : actual !== path
    )
      reject('ALIAS_REFUSED');
    return { path, stat };
  });
  return () => {
    for (const { path, stat } of observed) {
      const current = lstatSync(path, { bigint: true });
      if (current.dev !== stat.dev || current.ino !== stat.ino || current.mode !== stat.mode)
        reject('CHANGED_DURING_OBSERVATION');
    }
  };
}

/** Private manifest; never serialize this object into a support/public report. */
export function scanRetirementProfile(profile: string): RetirementEntry[] {
  const checkAncestors = retirementAncestry(profile);
  const root = lstatSync(profile, { bigint: true });
  const entries: RetirementEntry[] = [];
  let bytes = 0n;
  const visit = (name: string, depth: number) => {
    if (depth > RETIREMENT_LIMITS.depth || entries.length >= RETIREMENT_LIMITS.entries)
      reject('TREE_BOUND_REFUSED');
    checkAncestors();
    const path = name ? join(profile, name) : profile;
    const before = lstatSync(path, { bigint: true });
    if (before.isSymbolicLink()) reject('ALIAS_REFUSED');
    if (!before.isDirectory() && !before.isFile()) reject('TYPE_REFUSED');
    if (before.ino === 0n) reject('IDENTITY_UNAVAILABLE');
    if (before.dev !== root.dev) reject('MOUNT_BOUNDARY_REFUSED');
    if (before.isFile() && before.nlink !== 1n) reject('MULTIPLE_LINKS_REFUSED');
    const actual = realpathSync(path);
    if (
      process.platform === 'win32' ? actual.toLowerCase() !== path.toLowerCase() : actual !== path
    )
      reject('ALIAS_REFUSED');
    if (!identical(before, lstatSync(path, { bigint: true }))) reject('CHANGED_DURING_OBSERVATION');
    entries.push({
      name,
      directory: before.isDirectory(),
      dev: String(before.dev),
      ino: String(before.ino),
      mode: String(before.mode),
      size: String(before.size),
      links: String(before.nlink),
      modified: String(before.mtimeNs),
      changed: String(before.ctimeNs),
    });
    if (before.isFile()) {
      bytes += before.size;
      if (bytes > BigInt(RETIREMENT_LIMITS.bytes)) reject('BYTE_BOUND_REFUSED');
    } else {
      const directory = opendirSync(path);
      try {
        for (let entry = directory.readSync(); entry; entry = directory.readSync())
          visit(name ? join(name, entry.name) : entry.name, depth + 1);
      } finally {
        directory.closeSync();
      }
    }
    if (!identical(before, lstatSync(path, { bigint: true }))) reject('CHANGED_DURING_OBSERVATION');
  };
  visit('', 0);
  checkAncestors();
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
export function retirementDigest(entries: RetirementEntry[]) {
  return createHash('sha256').update(JSON.stringify(entries)).digest('hex');
}

/** Input anchors support disposable tests; the CLI passes only the profile override. */
export function prepareRetirement(
  options: { profileDir?: string; homeDir?: string; workingDir?: string } = {},
): RetirementPlan {
  const home = resolve(options.homeDir ?? homedir());
  const cwd = resolve(options.workingDir ?? process.cwd());
  const profile = resolve(cwd, options.profileDir || join(home, '.linkedin-mcp', 'profile'));
  if (
    contains(profile, home) ||
    contains(profile, cwd) ||
    contains(profile, join(home, '.linkedin-mcp'))
  )
    reject('SCOPE_OVERLAP_REFUSED');
  const inventory = dataInventory({ ...options, homeDir: home, workingDir: cwd });
  const problem = inventory.entries.find(
    (entry) => entry.observation === 'refused' || entry.observation === 'uncertain',
  );
  if (problem) reject(problem.reason ?? 'OWNERSHIP_UNCERTAIN');
  // A pending retirement receipt never grants authority to continue another operation.
  try {
    lstatSync(`${profile}.retirement.json`);
    reject('RETIREMENT_INCOMPLETE');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const entries =
    inventory.entries[0]?.observation === 'absent' ? [] : scanRetirementProfile(profile);
  if (
    entries.length &&
    retirementDigest(scanRetirementProfile(profile)) !== retirementDigest(entries)
  )
    reject('CHANGED_DURING_OBSERVATION');
  const final = dataInventory({ ...options, homeDir: home, workingDir: cwd });
  if (final.status !== 'observed') reject('OWNERSHIP_UNCERTAIN');
  if (
    final.entries.some(
      (entry, index) => entry.observation !== inventory.entries[index]?.observation,
    )
  )
    reject('CHANGED_DURING_OBSERVATION');
  return { profile, entries, digest: retirementDigest(entries), inventory };
}

export function retirementPreview(
  options: { profileDir?: string; homeDir?: string; workingDir?: string } = {},
) {
  const base = {
    schemaVersion: 1,
    mode: 'offline_retirement_preview',
    scope: 'selected_browser_profile_only',
    applicationSupported: false,
    deletionAuthorized: false,
    bounds: RETIREMENT_LIMITS,
    preserved: [
      'circuit_state',
      'shared_budgets_and_write_journal',
      'legacy_credentials',
      'other_profiles',
      'client_data',
      'backups_and_evidence',
    ],
    limitations: [
      'No deletion command is enabled. This preview is not approval or stopped-owner proof.',
      'Cooperating owner locks are observed, not acquired; another owner can start afterward.',
      'External Chrome processes, open handles, permissions and native Windows ACLs are unverified.',
      'Counts are filesystem metadata; content is not read. Paths, names and manifest hashes are omitted.',
      'Complete coordinated erasure and shared safety-history removal remain unsupported.',
    ],
  };
  try {
    const plan = prepareRetirement(options);
    return {
      ...base,
      status: 'preview_only',
      proposed: {
        profilePresent: plan.entries.length > 0,
        files: plan.entries.filter((entry) => !entry.directory).length,
        directories: plan.entries.filter((entry) => entry.directory).length,
      },
    };
  } catch (error) {
    return {
      ...base,
      status: 'refused',
      reason: error instanceof RetirementError ? error.code : 'ACCESS_UNCERTAIN',
    };
  }
}
