/** Bounded offline retirement preview and explicit selected-profile cleanup. */
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { dataInventory, selectedProfileObservation } from './data-inventory.js';
import { StateLock } from './safety/state-lock.js';

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
function sameCircuit(a: BigIntStats | undefined, b: BigIntStats | undefined) {
  return a && b ? identical(a, b) : a === b;
}
function sameMovedCircuit(a: BigIntStats, b: BigIntStats | undefined) {
  return (
    !!b &&
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.mode === b.mode &&
    a.nlink === b.nlink &&
    a.size === b.size &&
    a.mtimeNs === b.mtimeNs
  );
}
function retirementCircuitSnapshot(path: string): BigIntStats | undefined {
  try {
    const before = lstatSync(path, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink()) reject('TYPE_REFUSED');
    if (before.nlink !== 1n) reject('MULTIPLE_LINKS_REFUSED');
    if (before.ino === 0n) reject('IDENTITY_UNAVAILABLE');
    const actual = realpathSync(path);
    if (
      process.platform === 'win32' ? actual.toLowerCase() !== path.toLowerCase() : actual !== path
    )
      reject('ALIAS_REFUSED');
    if (!identical(before, lstatSync(path, { bigint: true }))) reject('CHANGED_DURING_OBSERVATION');
    return before;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function retirementObjectSnapshot(path: string, directory: boolean): BigIntStats | undefined {
  let observed = false;
  try {
    const before = lstatSync(path, { bigint: true });
    observed = true;
    if (before.isSymbolicLink()) reject('ALIAS_REFUSED');
    if (directory ? !before.isDirectory() : !before.isFile()) reject('TYPE_REFUSED');
    if (!directory && before.nlink !== 1n) reject('MULTIPLE_LINKS_REFUSED');
    if (before.ino === 0n) reject('IDENTITY_UNAVAILABLE');
    const actual = realpathSync(path);
    if (
      process.platform === 'win32' ? actual.toLowerCase() !== path.toLowerCase() : actual !== path
    )
      reject('ALIAS_REFUSED');
    if (!identical(before, lstatSync(path, { bigint: true }))) reject('CHANGED_DURING_OBSERVATION');
    return before;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (observed) reject('CHANGED_DURING_OBSERVATION');
      return undefined;
    }
    throw error;
  }
}

const retirementUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function expectedQuarantine(
  name: unknown,
  prefix: string,
  caseInsensitive = false,
): name is string {
  const head = `${prefix}.retirement-`;
  return (
    typeof name === 'string' &&
    basename(name) === name &&
    (caseInsensitive
      ? name.slice(0, head.length).toLowerCase() === head.toLowerCase()
      : name.startsWith(head)) &&
    retirementUuid.test(name.slice(head.length))
  );
}

function markerCaseInsensitive(path: string, expected: BigIntStats) {
  if (process.platform !== 'win32') return false;
  const name = basename(path);
  const index = name.search(/[a-zA-Z]/);
  if (index < 0) reject('RECOVERY_MARKER_INVALID');
  const character = name[index]!;
  const swapped =
    character === character.toLowerCase() ? character.toUpperCase() : character.toLowerCase();
  const alternateName = `${name.slice(0, index)}${swapped}${name.slice(index + 1)}`;
  const alternate = retirementObjectSnapshot(join(dirname(path), alternateName), false);
  if (!alternate) return false;
  if (alternate.dev !== expected.dev || alternate.ino !== expected.ino)
    reject('RECOVERY_MARKER_INVALID');
  return true;
}

function readRetirementMarker(path: string, expected: BigIntStats, profile: string) {
  if (expected.size < 1n || expected.size > 2048n) reject('RECOVERY_MARKER_INVALID');
  const fd = openSync(path, constants.O_RDONLY);
  let raw: string;
  try {
    if (!identical(expected, fstatSync(fd, { bigint: true })))
      reject('CHANGED_DURING_OBSERVATION');
    const buffer = Buffer.alloc(Number(expected.size));
    if (readSync(fd, buffer, 0, buffer.length, 0) !== buffer.length)
      reject('CHANGED_DURING_OBSERVATION');
    if (!identical(expected, fstatSync(fd, { bigint: true })))
      reject('CHANGED_DURING_OBSERVATION');
    raw = buffer.toString('utf8');
  } finally {
    closeSync(fd);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    reject('RECOVERY_MARKER_INVALID');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    reject('RECOVERY_MARKER_INVALID');
  const record = value as Record<string, unknown>;
  const caseInsensitive = markerCaseInsensitive(path, expected);
  const final = retirementObjectSnapshot(path, false);
  if (!final || !identical(expected, final))
    reject('CHANGED_DURING_OBSERVATION');
  const profileName = basename(profile);
  if (
    Object.keys(record).sort().join(',') !==
      'circuitQuarantine,phase,quarantine,schemaVersion,scope' ||
    record.schemaVersion !== 1 ||
    record.phase !== 'started' ||
    record.scope !== 'selected_profile' ||
    (record.quarantine !== null &&
      !expectedQuarantine(record.quarantine, profileName, caseInsensitive)) ||
    (record.circuitQuarantine !== null &&
      !expectedQuarantine(
        record.circuitQuarantine,
        `${profileName}.circuit.json`,
        caseInsensitive,
      )) ||
    (record.quarantine === null && record.circuitQuarantine === null)
  )
    reject('RECOVERY_MARKER_INVALID');
  return {
    quarantine: record.quarantine as string | null,
    circuitQuarantine: record.circuitQuarantine as string | null,
  };
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
function sameRetirementMember(expected: RetirementEntry, current: RetirementEntry) {
  return (
    expected.name === current.name &&
    expected.directory === current.directory &&
    expected.dev === current.dev &&
    expected.ino === current.ino &&
    expected.mode === current.mode &&
    expected.size === current.size &&
    expected.links === current.links &&
    expected.modified === current.modified &&
    expected.changed === current.changed
  );
}
function assertMemberIdentity(path: string, expected: RetirementEntry) {
  const current = lstatSync(path, { bigint: true });
  if (
    current.isSymbolicLink() ||
    current.isDirectory() !== expected.directory ||
    String(current.dev) !== expected.dev ||
    String(current.ino) !== expected.ino ||
    String(current.mode) !== expected.mode
  )
    reject('CHANGED_DURING_OBSERVATION');
  if (
    !expected.directory &&
    (String(current.nlink) !== expected.links ||
      String(current.size) !== expected.size ||
      String(current.mtimeNs) !== expected.modified ||
      String(current.ctimeNs) !== expected.changed)
  )
    reject('CHANGED_DURING_OBSERVATION');
}
function assertApprovedAncestors(
  root: string,
  name: string,
  approved: Map<string, RetirementEntry>,
) {
  const check = (member: string) => {
    const expected = approved.get(member);
    if (!expected?.directory) reject('CHANGED_DURING_OBSERVATION');
    const path = member ? join(root, member) : root;
    assertMemberIdentity(path, expected);
    const actual = realpathSync(path);
    if (
      process.platform === 'win32' ? actual.toLowerCase() !== path.toLowerCase() : actual !== path
    )
      reject('ALIAS_REFUSED');
  };
  check('');
  for (let parent = name ? dirname(name) : '.'; parent !== '.'; parent = dirname(parent))
    check(parent);
}

export function assertNoRetirementMarker(profile: string): void {
  try {
    lstatSync(`${profile}.retirement.json`);
    reject('RETIREMENT_INCOMPLETE');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
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
  // An interrupted retirement takes precedence over incidental lock observations.
  assertNoRetirementMarker(profile);
  const inventory = dataInventory({ ...options, homeDir: home, workingDir: cwd });
  const problem = inventory.entries.find(
    (entry) => entry.observation === 'refused' || entry.observation === 'uncertain',
  );
  if (problem) reject(problem.reason ?? 'OWNERSHIP_UNCERTAIN');
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
    scope: 'selected_profile_and_circuit_only',
    applicationSupported: true,
    deletionAuthorized: false,
    bounds: RETIREMENT_LIMITS,
    preserved: [
      'shared_budgets_and_write_journal',
      'legacy_credentials',
      'other_profiles',
      'client_data',
      'backups_and_evidence',
    ],
    limitations: [
      'This preview is not approval or stopped-owner proof. Apply requires --retire-profile --confirm-retirement.',
      'Cooperating owner locks are observed, not acquired; another owner can start afterward.',
      'External Chrome processes, open handles, permissions and native Windows ACLs are unverified.',
      'Counts are filesystem metadata; content is not read. Paths, names and manifest hashes are omitted.',
      'The apply command removes only the selected profile and its circuit; complete coordinated erasure and shared safety-history removal remain unsupported.',
    ],
  };
  try {
    const plan = prepareRetirement(options);
    return {
      ...base,
      status: 'preview_only',
      proposed: {
        profilePresent: plan.entries.length > 0,
        circuitPresent: plan.inventory.entries[1]?.observation === 'present',
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

/** Observe an interrupted retirement without resuming deletion or trusting its marker as authority. */
export function retirementRecoveryPreview(
  options: { profileDir?: string; homeDir?: string; workingDir?: string } = {},
) {
  const base = {
    schemaVersion: 1,
    mode: 'offline_retirement_recovery_preview',
    scope: 'selected_profile_and_circuit_only',
    deletionAuthorized: false,
    ownership: 'unverified',
    limitations: [
      'This report never clears a marker or lock, resumes deletion, or authorizes a retry.',
      'The marker names only this command’s planned quarantines; unrelated profiles, unknown siblings, shared history and client data are not inventoried.',
      'Open handles, other processes, native permissions, power-loss durability and same-account races are unverified.',
      'An operator must inspect any remaining private state before recovery; a missing path does not prove secure erasure.',
    ],
  };
  try {
    const home = resolve(options.homeDir ?? homedir());
    const cwd = resolve(options.workingDir ?? process.cwd());
    const profile = resolve(cwd, options.profileDir || join(home, '.linkedin-mcp', 'profile'));
    if (
      contains(profile, home) ||
      contains(profile, cwd) ||
      contains(profile, join(home, '.linkedin-mcp'))
    )
      reject('SCOPE_OVERLAP_REFUSED');
    const markerPath = `${profile}.retirement.json`;
    const marker = retirementObjectSnapshot(markerPath, false);
    if (!marker) {
      const selected = selectedProfileObservation({
        ...options,
        homeDir: home,
        workingDir: cwd,
      });
      if (selected.observation === 'refused' || selected.observation === 'uncertain')
        reject(selected.reason);
      if (retirementObjectSnapshot(markerPath, false)) reject('CHANGED_DURING_OBSERVATION');
      return { ...base, status: 'no_interruption_marker' };
    }
    const checkAncestors = retirementAncestry(profile);
    const names = readRetirementMarker(markerPath, marker, profile);
    const quarantine = names.quarantine && join(dirname(profile), names.quarantine);
    const circuitQuarantine =
      names.circuitQuarantine && join(dirname(profile), names.circuitQuarantine);
    checkAncestors();
    const original = retirementObjectSnapshot(profile, true);
    const moved = quarantine && retirementObjectSnapshot(quarantine, true);
    const circuit = retirementCircuitSnapshot(`${profile}.circuit.json`);
    const movedCircuit = circuitQuarantine && retirementCircuitSnapshot(circuitQuarantine);
    const lock = retirementObjectSnapshot(`${profile}.owner.lock`, true);
    const remaining = moved ? scanRetirementProfile(quarantine!) : [];
    checkAncestors();
    const finalMarker = retirementObjectSnapshot(markerPath, false);
    if (!finalMarker || !identical(marker, finalMarker))
      reject('CHANGED_DURING_OBSERVATION');
    return {
      ...base,
      status: 'needs_operator_review',
      observed: {
        originalProfile: !!original,
        plannedProfileQuarantine: !!moved,
        originalCircuit: !!circuit,
        plannedCircuitQuarantine: !!movedCircuit,
        ownerLock: !!lock,
        quarantinedFiles: remaining.filter((entry) => !entry.directory).length,
        quarantinedDirectories: remaining.filter((entry) => entry.directory).length,
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

/** A deliberately scoped privacy operation. Shared budgets and write history are never removed. */
export function retireSelectedProfile(
  options: { profileDir?: string; homeDir?: string; workingDir?: string; confirmed?: boolean } = {},
) {
  const scope = 'selected_profile_and_circuit_only';
  const preserved = [
    'shared_budgets_and_write_journal',
    'legacy_credentials',
    'other_profiles',
    'client_data',
    'backups_and_evidence',
  ];
  if (!options.confirmed) reject('CONFIRMATION_REQUIRED');
  const plan = prepareRetirement(options);
  const circuit = `${plan.profile}.circuit.json`;
  const receipt = `${plan.profile}.retirement.json`;
  const beforeCircuit = retirementCircuitSnapshot(circuit);
  if (!plan.entries.length && !beforeCircuit)
    return {
      status: 'nothing_to_retire',
      scope,
      profileRemoved: false,
      circuitRemoved: false,
      preserved,
    };
  // The profile lock is also used by Chrome. It is never stolen, including after a crash.
  const owner = new StateLock(`${plan.profile}.owner`, true);
  if (
    process.platform === 'win32'
      ? owner.directory.toLowerCase() !== `${plan.profile}.owner.lock`.toLowerCase()
      : owner.directory !== `${plan.profile}.owner.lock`
  )
    reject('ALIAS_REFUSED');
  owner.acquire();
  let markerCreated = false;
  let completed = false;
  try {
    owner.assertOwned();
    const current = plan.entries.length ? scanRetirementProfile(plan.profile) : [];
    if (retirementDigest(current) !== plan.digest) reject('CHANGED_DURING_OBSERVATION');
    if (plan.entries.length === 0) {
      try {
        lstatSync(plan.profile);
        reject('CHANGED_DURING_OBSERVATION');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    if (!sameCircuit(beforeCircuit, retirementCircuitSnapshot(circuit)))
      reject('CHANGED_DURING_OBSERVATION');
    // The fsynced marker blocks subsequent use after an interrupted operation.
    const quarantine = plan.entries.length ? `${plan.profile}.retirement-${randomUUID()}` : null;
    const circuitQuarantine = beforeCircuit ? `${circuit}.retirement-${randomUUID()}` : null;
    const fd = openSync(receipt, 'wx', 0o600);
    try {
      writeSync(
        fd,
        JSON.stringify({
          schemaVersion: 1,
          phase: 'started',
          scope: 'selected_profile',
          quarantine: quarantine ? basename(quarantine) : null,
          circuitQuarantine: circuitQuarantine ? basename(circuitQuarantine) : null,
        }),
      );
      fsyncSync(fd);
      markerCreated = true;
    } finally {
      closeSync(fd);
    }
    if (plan.entries.length) {
      owner.assertOwned();
      if (retirementDigest(scanRetirementProfile(plan.profile)) !== plan.digest)
        reject('CHANGED_DURING_OBSERVATION');
      const quarantined = quarantine!;
      renameSync(plan.profile, quarantined);
      const moved = lstatSync(quarantined, { bigint: true });
      const original = plan.entries.find((entry) => entry.name === '')!;
      if (
        !moved.isDirectory() ||
        moved.isSymbolicLink() ||
        String(moved.dev) !== original.dev ||
        String(moved.ino) !== original.ino
      )
        reject('CHANGED_DURING_OBSERVATION');
      const movedEntries = scanRetirementProfile(quarantined);
      if (
        movedEntries.length !== plan.entries.length ||
        movedEntries.some(
          (entry, index) => entry.name !== '' && !sameRetirementMember(plan.entries[index]!, entry),
        )
      )
        reject('CHANGED_DURING_OBSERVATION');
      // Unlink only approved files; rmdir refuses any new/unapproved child.
      const bottomUp = [...plan.entries].sort(
        (a, b) =>
          b.name.split(/[/\\]/).length - a.name.split(/[/\\]/).length ||
          b.name.localeCompare(a.name),
      );
      const approved = new Map(plan.entries.map((entry) => [entry.name, entry]));
      const checkOuter = retirementAncestry(quarantined);
      for (const entry of bottomUp) {
        owner.assertOwned();
        checkOuter();
        assertApprovedAncestors(quarantined, entry.name, approved);
        const path = entry.name ? join(quarantined, entry.name) : quarantined;
        assertMemberIdentity(path, entry);
        if (entry.directory) rmdirSync(path);
        else unlinkSync(path);
      }
    }
    if (beforeCircuit) {
      owner.assertOwned();
      retirementAncestry(plan.profile)();
      if (!sameCircuit(beforeCircuit, retirementCircuitSnapshot(circuit)))
        reject('CHANGED_DURING_OBSERVATION');
      renameSync(circuit, circuitQuarantine!);
      if (!sameMovedCircuit(beforeCircuit, retirementCircuitSnapshot(circuitQuarantine!)))
        reject('CHANGED_DURING_OBSERVATION');
      unlinkSync(circuitQuarantine!);
    }
    completed = true;
    return {
      status: 'retired',
      scope,
      profileRemoved: plan.entries.length > 0,
      circuitRemoved: !!beforeCircuit,
      preserved,
    };
  } finally {
    // Keep the marker on every partial/uncertain outcome, including a failed lock release.
    if (!markerCreated || completed) owner.release();
    if (completed && markerCreated) unlinkSync(receipt);
  }
}
