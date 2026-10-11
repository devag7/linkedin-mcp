/** Offline metadata only. This is not an ownership proof or a deletion plan. */
import { lstatSync, realpathSync, type BigIntStats } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';

type Observation = 'present' | 'absent' | 'refused' | 'uncertain';
type Reason =
  | 'ALIAS_REFUSED'
  | 'TYPE_REFUSED'
  | 'MULTIPLE_LINKS_REFUSED'
  | 'SCOPE_OVERLAP_REFUSED'
  | 'PATH_BOUND_REFUSED'
  | 'IDENTITY_UNAVAILABLE'
  | 'ACCESS_UNCERTAIN'
  | 'CHANGED_DURING_OBSERVATION'
  | 'LOCK_OWNERSHIP_UNVERIFIED';

class InventoryError extends Error {
  constructor(
    readonly state: 'refused' | 'uncertain',
    readonly reason: Reason,
  ) {
    super(reason);
  }
}
const MAX_ANCESTORS = 96;
type Snapshot = Map<string, BigIntStats | undefined>;

function snapshot(target: string, directory: boolean): Snapshot {
  const chain: string[] = [];
  for (let current = target; ; current = dirname(current)) {
    chain.push(current);
    if (chain.length > MAX_ANCESTORS) throw new InventoryError('refused', 'PATH_BOUND_REFUSED');
    if (current === parse(current).root) break;
  }
  const result: Snapshot = new Map();
  // Check root-to-leaf: ENOENT below an inaccessible/aliased ancestor is not absence.
  let missing = false;
  for (const current of chain.reverse()) {
    if (missing) {
      result.set(current, undefined);
      continue;
    }
    let stat: BigIntStats;
    try {
      stat = lstatSync(current, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        missing = true;
        result.set(current, undefined);
        continue;
      }
      throw new InventoryError('uncertain', 'ACCESS_UNCERTAIN');
    }
    if (stat.isSymbolicLink()) throw new InventoryError('refused', 'ALIAS_REFUSED');
    const expectedDirectory = current !== target || directory;
    if (expectedDirectory ? !stat.isDirectory() : !stat.isFile())
      throw new InventoryError('refused', 'TYPE_REFUSED');
    if (!stat.isDirectory() && stat.nlink > 1n)
      throw new InventoryError('refused', 'MULTIPLE_LINKS_REFUSED');
    if (stat.ino === 0n) throw new InventoryError('uncertain', 'IDENTITY_UNAVAILABLE');
    let actual: string;
    try {
      actual = realpathSync(current);
    } catch {
      throw new InventoryError('uncertain', 'ACCESS_UNCERTAIN');
    }
    const same =
      process.platform === 'win32'
        ? actual.toLowerCase() === current.toLowerCase()
        : actual === current;
    if (!same) throw new InventoryError('refused', 'ALIAS_REFUSED');
    result.set(current, stat);
  }
  // Recheck after canonical resolution and descendant observation. A lexical
  // path can stay the same even when its directory was replaced after lstat.
  let missingChecked = false;
  for (const [current, before] of result) {
    if (!before && missingChecked) continue;
    let after: BigIntStats | undefined;
    try {
      after = lstatSync(current, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new InventoryError('uncertain', 'ACCESS_UNCERTAIN');
    }
    if (!sameStat(before, after, current === target))
      throw new InventoryError('uncertain', 'CHANGED_DURING_OBSERVATION');
    if (!before) missingChecked = true;
  }
  return result;
}

function sameStat(a: BigIntStats | undefined, b: BigIntStats | undefined, leaf: boolean): boolean {
  if (!a || !b) return a === b;
  return (
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.mode === b.mode &&
    (!leaf ||
      (a.nlink === b.nlink &&
        a.size === b.size &&
        a.mtimeNs === b.mtimeNs &&
        a.ctimeNs === b.ctimeNs))
  );
}

function unchanged(first: Snapshot, last: Snapshot, target: string): boolean {
  for (const [file, a] of first) {
    const b = last.get(file);
    if (!sameStat(a, b, file === target)) return false;
  }
  return true;
}

function contains(parent: string, child: string): boolean {
  const tail = relative(parent, child);
  return (
    tail === '' ||
    (!isAbsolute(tail) &&
      tail !== '..' &&
      !tail.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`))
  );
}

/** Fixture anchors are injectable; the CLI uses the OS home and cwd only. */
export function dataInventory(
  options: {
    profileDir?: string;
    homeDir?: string;
    workingDir?: string;
  } = {},
) {
  const home = resolve(options.homeDir ?? homedir());
  const cwd = resolve(options.workingDir ?? process.cwd());
  const root = join(home, '.linkedin-mcp');
  const profile = resolve(cwd, options.profileDir || join(root, 'profile'));
  const budget = join(root, 'budgets.json');
  const credentials = join(root, 'credentials.json');
  const definitions = [
    {
      category: 'browser_profile',
      target: profile,
      directory: true,
      scope: 'selected_profile',
      retention: 'session_credentials',
    },
    {
      category: 'circuit_state',
      target: `${profile}.circuit.json`,
      directory: false,
      scope: 'selected_profile',
      retention: 'preserve_safety_stop',
    },
    {
      category: 'profile_owner_lock',
      target: `${profile}.owner.lock`,
      directory: true,
      scope: 'selected_profile',
      retention: 'owner_managed',
      lock: true,
    },
    {
      category: 'budgets_and_write_journal',
      target: budget,
      directory: false,
      scope: 'shared_across_profiles',
      retention: 'preserve_caps_and_replay_protection',
    },
    {
      category: 'budget_transaction_lock',
      target: `${budget}.lock`,
      directory: true,
      scope: 'shared_across_profiles',
      retention: 'owner_managed',
      lock: true,
    },
    {
      category: 'legacy_credentials',
      target: credentials,
      directory: false,
      scope: 'legacy_home_store',
      retention: 'credentials_not_used_by_browser_runtime',
    },
  ];
  const overlap =
    contains(profile, home) ||
    contains(profile, cwd) ||
    contains(profile, budget) ||
    contains(profile, credentials) ||
    contains(profile, `${budget}.lock`);
  const entries = definitions.map(({ target, directory, lock, ...description }) => {
    let observation: Observation;
    let reason: Reason | undefined;
    try {
      if (overlap && description.scope === 'selected_profile')
        throw new InventoryError('refused', 'SCOPE_OVERLAP_REFUSED');
      const first = snapshot(target, directory);
      const last = snapshot(target, directory);
      if (!unchanged(first, last, target))
        throw new InventoryError('uncertain', 'CHANGED_DURING_OBSERVATION');
      observation = last.get(target) ? 'present' : 'absent';
      if (lock && observation === 'present')
        throw new InventoryError('uncertain', 'LOCK_OWNERSHIP_UNVERIFIED');
    } catch (error) {
      observation = error instanceof InventoryError ? error.state : 'uncertain';
      reason = error instanceof InventoryError ? error.reason : 'ACCESS_UNCERTAIN';
    }
    return {
      ...description,
      observation,
      ...(reason ? { reason } : {}),
      content: 'not_inspected',
      ownership: 'unverified',
    };
  });
  return {
    schemaVersion: 1,
    mode: 'offline_metadata_inventory',
    status: entries.some((e) => e.observation === 'refused' || e.observation === 'uncertain')
      ? 'needs_attention'
      : 'observed',
    profileSelection: options.profileDir ? 'configured' : 'default',
    entries,
    erasurePreview: {
      supported: false,
      deletionAuthorized: false,
      ownership: 'unverified',
      instruction:
        'No deletion plan is produced. Coordinated erasure requires a separate reviewed operation; preserve circuits, shared budgets, journals and locks.',
    },
    limitations: [
      'This bounded metadata snapshot does not prove stopped owners, exclusive ownership, JSON validity, permissions or erasure readiness.',
      'File contents, profile children, other profiles, temporary state files, client configs, client-retained results, manual evidence and backups are not enumerated.',
      'In-memory caches and preview tokens in other runtimes cannot be inventoried here.',
      'Paths, contents, identifiers, counts, sizes and timestamps are omitted. Observation can become stale immediately.',
      'Native Windows ACL privacy and coordinated erasure remain unverified.',
    ],
  };
}
