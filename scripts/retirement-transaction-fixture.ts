/** Unshipped transaction proof. Accepts only capabilities created here for fresh temporary fixtures.
 * There is no CLI, environment target or adapter for actual user storage.
 */
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  fsyncSync,
  ftruncateSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { z } from 'zod';
import { StateLock } from '../src/safety/state-lock.js';
import {
  prepareRetirement,
  retirementDigest,
  retirementAncestry,
  scanRetirementProfile,
  type RetirementEntry,
} from '../src/retirement.js';

type Fixture = Readonly<{ root: string; home: string; profile: string }>;
const fixtures = new WeakMap<Fixture, { dev: bigint; ino: bigint }>();
const entrySchema = z
  .object({
    name: z.string().max(8192),
    directory: z.boolean(),
    dev: z.string().regex(/^\d+$/),
    ino: z.string().regex(/^[1-9]\d*$/),
    mode: z.string().regex(/^\d+$/),
    size: z.string().regex(/^\d+$/),
    links: z.string().regex(/^\d+$/),
    modified: z.string().regex(/^-?\d+$/),
    changed: z.string().regex(/^-?\d+$/),
  })
  .strict();
const receiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    operation: z.string().uuid(),
    phase: z.enum(['prepared', 'quarantined']),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    entries: z.array(entrySchema).min(1).max(5000),
  })
  .strict();
type Receipt = z.infer<typeof receiptSchema>;
const MAX_RECEIPT = 2 * 1024 * 1024;

export function createRetirementFixture(): Fixture {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-retirement-proof-')));
  const home = join(root, 'home');
  const profile = join(home, '.linkedin-mcp', 'profile');
  mkdirSync(profile, { recursive: true, mode: 0o700 });
  const capability = Object.freeze({ root, home, profile });
  const stat = lstatSync(root, { bigint: true });
  fixtures.set(capability, { dev: stat.dev, ino: stat.ino });
  return capability;
}
function fixtureGuard(fixture: Fixture) {
  const original = fixtures.get(fixture);
  if (!original) throw new Error('DISPOSABLE_CAPABILITY_REQUIRED');
  const current = lstatSync(fixture.root, { bigint: true });
  if (
    current.isSymbolicLink() ||
    !current.isDirectory() ||
    current.dev !== original.dev ||
    current.ino !== original.ino
  )
    throw new Error('FIXTURE_IDENTITY_CHANGED');
  retirementAncestry(join(fixture.root, 'anchor'))();
}
function present(path: string) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
function save(path: string, receipt: Receipt, fresh: boolean) {
  const raw = JSON.stringify(receipt);
  if (Buffer.byteLength(raw) > MAX_RECEIPT) throw new Error('RECEIPT_BOUND_REFUSED');
  const fd = openSync(path, fresh ? 'wx' : 'r+', 0o600);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1) throw new Error('RECEIPT_IDENTITY_UNCERTAIN');
    // Same-length phase edits are not assumed; write the whole bounded receipt.
    writeFileSync(fd, raw);
    ftruncateSync(fd, Buffer.byteLength(raw));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function load(path: string): Receipt {
  const before = lstatSync(path, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1n ||
    before.size > BigInt(MAX_RECEIPT)
  )
    throw new Error('RECEIPT_IDENTITY_UNCERTAIN');
  const fd = openSync(path, 'r');
  try {
    const stat = fstatSync(fd, { bigint: true });
    if (stat.dev !== before.dev || stat.ino !== before.ino)
      throw new Error('RECEIPT_IDENTITY_UNCERTAIN');
    return receiptSchema.parse(JSON.parse(readFileSync(fd, 'utf8')));
  } finally {
    closeSync(fd);
  }
}
function member(root: string, name: string) {
  const path = join(root, name);
  const tail = relative(root, path);
  if (
    isAbsolute(name) ||
    (name && (!tail || tail === '..' || tail.startsWith('../') || tail.startsWith('..\\')))
  )
    throw new Error('RECEIPT_SCOPE_REFUSED');
  return path;
}
function sameEntry(a: RetirementEntry, b: RetirementEntry) {
  return (
    a.directory === b.directory &&
    a.dev === b.dev &&
    a.ino === b.ino &&
    a.mode === b.mode &&
    (a.directory ||
      (a.size === b.size &&
        a.links === b.links &&
        a.modified === b.modified &&
        a.changed === b.changed))
  );
}
/** Fresh calls require the exact private preview digest; confirmation is a test workflow, not inferred consent. */
export function retireFixture(
  fixture: Fixture,
  options: {
    previewDigest?: string;
    resume?: boolean;
    interruptAt?: 'prepared' | 'renamed' | 'first_entry';
  } = {},
) {
  fixtureGuard(fixture);
  const receiptPath = `${fixture.profile}.retirement.json`;
  let receipt: Receipt;
  if (options.resume) receipt = load(receiptPath);
  else {
    const plan = prepareRetirement({ homeDir: fixture.home, workingDir: fixture.root });
    if (!plan.entries.length || options.previewDigest !== plan.digest)
      throw new Error('REVIEWED_PREVIEW_REQUIRED');
    receipt = {
      schemaVersion: 1,
      operation: randomUUID(),
      phase: 'prepared',
      digest: plan.digest,
      entries: plan.entries,
    };
  }
  if (
    receipt.entries[0]?.name !== '' ||
    !receipt.entries[0]?.directory ||
    new Set(receipt.entries.map((entry) => entry.name)).size !== receipt.entries.length
  )
    throw new Error('RECEIPT_SCOPE_REFUSED');
  const quarantine = `${fixture.profile}.retirement-${receipt.operation}`;
  if (retirementDigest(receipt.entries) !== receipt.digest)
    throw new Error('RECEIPT_DIGEST_MISMATCH');
  for (const entry of receipt.entries) member(quarantine, entry.name);
  const owner = new StateLock(`${fixture.profile}.owner`, true);
  const budget = new StateLock(join(fixture.home, '.linkedin-mcp', 'budgets.json'));
  let ownerAcquired = false;
  let budgetAcquired = false;
  let durable = options.resume === true;
  let complete = false;
  try {
    owner.acquire();
    ownerAcquired = true;
    budget.acquire();
    budgetAcquired = true;
    if (!options.resume) {
      // Lock acquisition is not authority over uncooperating Chrome. Fixtures have no browser.
      const current = scanRetirementProfile(fixture.profile);
      if (JSON.stringify(current) !== JSON.stringify(receipt.entries))
        throw new Error('PREVIEW_CHANGED');
      save(receiptPath, receipt, true);
      durable = true;
    }
    if (options.interruptAt === 'prepared') throw new Error('FIXTURE_INTERRUPTED');
    if (receipt.phase === 'prepared') {
      if (present(fixture.profile) && !present(quarantine)) {
        const current = scanRetirementProfile(fixture.profile);
        if (JSON.stringify(current) !== JSON.stringify(receipt.entries))
          throw new Error('PREVIEW_CHANGED');
        renameSync(fixture.profile, quarantine);
      } else if (present(fixture.profile) || !present(quarantine))
        throw new Error('RETIREMENT_AMBIGUOUS');
      const root = scanRetirementProfile(quarantine).find((entry) => entry.name === '');
      if (!root || !sameEntry(root, receipt.entries[0]!))
        throw new Error('RETIREMENT_IDENTITY_CHANGED');
      receipt = { ...receipt, phase: 'quarantined' };
      save(receiptPath, receipt, false);
    }
    if (present(fixture.profile)) throw new Error('PROFILE_RECREATED');
    if (options.interruptAt === 'renamed') throw new Error('FIXTURE_INTERRUPTED');
    if (present(quarantine)) {
      const expected = new Map(receipt.entries.map((entry) => [entry.name, entry]));
      for (const entry of scanRetirementProfile(quarantine)) {
        const approved = expected.get(entry.name);
        if (!approved || !sameEntry(entry, approved)) throw new Error('QUARANTINE_CHANGED');
      }
      const order = [...receipt.entries].sort(
        (a, b) =>
          b.name.split(/[\\/]/).length - a.name.split(/[\\/]/).length ||
          b.name.length - a.name.length,
      );
      let removed = 0;
      for (const entry of order) {
        fixtureGuard(fixture);
        owner.assertOwned();
        budget.assertOwned();
        const path = member(quarantine, entry.name);
        if (!present(path)) continue;
        retirementAncestry(path)();
        const actual = lstatSync(path, { bigint: true });
        if (
          actual.isSymbolicLink() ||
          String(actual.dev) !== entry.dev ||
          String(actual.ino) !== entry.ino ||
          String(actual.mode) !== entry.mode
        )
          throw new Error('QUARANTINE_CHANGED');
        if (
          !entry.directory &&
          (actual.nlink !== 1n ||
            String(actual.size) !== entry.size ||
            String(actual.mtimeNs) !== entry.modified ||
            String(actual.ctimeNs) !== entry.changed)
        )
          throw new Error('QUARANTINE_CHANGED');
        if (entry.directory) rmdirSync(path);
        else unlinkSync(path);
        if (++removed === 1 && options.interruptAt === 'first_entry')
          throw new Error('FIXTURE_INTERRUPTED');
      }
    }
    if (present(quarantine) || present(fixture.profile)) throw new Error('RETIREMENT_INCOMPLETE');
    unlinkSync(receiptPath);
    complete = true;
    return {
      status: 'fixture_profile_retired',
      completeErasure: false,
      sharedSafetyStatePreserved: true,
    };
  } finally {
    // Durable interruptions keep both locks. No automatic orphan repair or lock stealing.
    if (complete || !durable) {
      if (budgetAcquired) budget.release();
      if (ownerAcquired) owner.release();
    }
  }
}
