# Offline profile retirement: bounded preview and disposable transaction proof

Draft source feature, absent from published 3.1.0. Mandatory maintainer cash: $0.
This milestone deliberately does **not** enable a production deletion command or
claim complete/coordinated erasure. It adds a useful bounded preview and an
unshipped, capability-restricted transaction proof for independent review.

## PRD and scope

Before retiring a profile, a user needs to know whether the selected directory
can be inventoried safely and which external safety data would remain. Build this
source, then run `node dist/index.js --retirement-preview`. It reports fixed scope,
file/directory counts, refusal reasons, bounds and preserved categories. It emits
no paths, filenames, fingerprints, identifiers, credentials or contents. No
browser, process probe, network request, lock or receipt is created by the preview.

The candidate scope is **one selected browser profile**, preserving external
circuits, shared budgets and write journals, legacy credentials, other profiles,
client-retained data, backups and evidence. Shared state cannot safely be erased:
there is no authoritative registry of every custom profile, legacy version or
uncooperating browser using it. Removing circuit/journal files could reset safety
stops, caps or replay protection. The published 3.1.0 artifact is unchanged.

## TRD and limits

Preview walks metadata for at most 5,000 entries including the root, depth 32,
and 2 GiB of aggregate regular-file sizes. Directory reads are incremental, not an
unbounded `readdir` allocation. It rejects aliases/junctions and nested links,
hard-linked regular files, other file types, observed mount boundaries, invalid
native identities, scope overlap and changed observations. Present owner or shared
transaction locks fail closed without inspecting, clearing or stealing them.
Existing inventory performs the fixed external-state checks. Two manifest walks
and final inventory check detect observed changes; observations are not atomic.
OS filesystem calls have no hard wall-clock guarantee, especially on remote stores.

Private manifests are held only in memory by the production preview. They include
relative names and exact native metadata for identity/change comparisons; only
fixed labels and counts reach stdout. Hashes are not anonymization and are not
included in that report. `applicationSupported:false` and
`deletionAuthorized:false` are unconditional. There is no preview token,
`--erase-profile` command or MCP erasure tool, and no automatic server/client exit.
Existing `--logout` behavior is unchanged by this milestone.

`scripts/retirement-transaction-fixture.ts` is **not shipped or imported by the CLI**.
Its WeakMap-issued capability can only refer to a fresh temporary workspace
created by that module. A forged capability is rejected before filesystem access.
It demonstrates the following future transaction mechanics, never on actual state:

1. Require an exact private manifest preview digest, then acquire the selected
   profile owner and shared budget transaction locks in runtime order.
2. Revalidate the manifest, save/fsync a bounded mode-0600 receipt, then rename the
   profile to an operation-specific sibling quarantine. Preserve all safety files.
3. Refuse replacement roots or entries outside the manifest. Remove explicit
   approved members bottom-up without recursive rm or alias traversal.
4. Keep receipt and both locks after a durable interruption. A fresh invocation
   reloads the receipt; existing locks still refuse recovery. Only the fixture
   owner clears its known disposable locks for the serialized recovery tests.
5. Refuse a recreated profile or new/changed quarantine members. Retire only the
   originally approved remaining entries, remove the receipt, then release locks.

This is a serialized interruption/restart simulation, **not** OS-crash/power-loss,
directory-fsync durability or native Windows privacy proof. It does not establish
that hostile same-user path replacement cannot occur between syscalls. Production
activation is blocked until independent review establishes stronger ownership,
native-process/open-handle coverage and filesystem mutation guarantees. Test-only
capabilities or human assertions must not be substituted for those guarantees.
In particular, native Windows ACLs and custom-parent write/delete authority remain
unproven. POSIX modes or a successful owner-home fixture are insufficient for
Windows activation; public/shared custom parents need separate native evidence.

## Acceptance and remaining backlog

| Work | Acceptance / evidence | Dependency and maintenance | Required cash |
| --- | --- | --- | --- |
| Bounded preview | Fixed JSON/status; no mutation/launch/request; alias, owner, scope and bounds refusals; installed tarball tests | Keep categories/storage paths aligned; low ongoing work | $0 |
| Disposable transaction proof | Exact preview binding; external bytes unchanged; interruption refusals and disk recovery; recreated profile and unapproved-member refusal | Reviewed filesystem/state-lock design; medium maintenance | $0 |
| Production selected-profile application | Explicit short-lived approved preview, stopped-owner/open-handle proof, durable recovery and safe per-member mutation on supported native platforms | Independent review plus native privacy/ownership evidence; blocked | $0 using local/public CI tooling |
| Complete shared-state erasure | Authority over every profile and outstanding/unknown write; explicit safety-history-loss policy; prevent runnable profiles silently receiving fresh caps | Authoritative owner/profile coordination design; blocked | $0; no paid service required |
| Windows ACL proof | Native owner-only access and deny-other-user read tests | Native Windows runner/account separation; unverified | $0 public CI where feasible |

No rollout changes the 3.0.0 owner-led pilot's consent, cohort or scoring. PR #5
remains blocked. No participant, live-provider or Trending outcome is inferred.

## Local evidence — October 12, 2026

- 743 tests in 34 files pass, including 24 new disposable retirement regressions.
  Entry/depth bounds use real temporary trees; the byte bound uses synthetic
  metadata on a tiny file without allocating gigabytes. An absent-to-present
  observation is refused. No account/provider request or real-state deletion is
  performed by these fixtures.
- Source lint, types, generated metadata and build pass. The unshipped transaction
  script and its tests also pass separate ESLint and strict TypeScript checks.
- Exact 15-file installed-package verification passes. The fresh consumer resolves
  SDK 1.32.1 and proxy-addr 2.0.8 with zero production findings; full source audit
  has zero findings. No dependency or version was changed.
- Installed `--retirement-preview` uses disposable HOME/USERPROFILE and refuses
  owner locks, mixed live/logout flags and unknown `--erase-profile`. File bytes
  and directory entries remain unchanged. SDK transports still discover 22 tools;
  this does not establish native-client or live-provider support.
- A local editing error misplaced the receipt-digest check; its seven failing
  fixture tests, type failure and unused-import lint finding were recorded
  privately before repair. They are not relabeled as passed. All current checks
  above were rerun after that repair.
- A follow-up disposable recovery fixture reproduced lock creation through an
  aliased home before a later refusal. The fixture capability now validates the
  original root, home and state-directory identities before receipt reads or
  canonicalizing lock construction. The failed reproduction is retained privately;
  its regression checks that no alias-target lock is created. This does not remove
  the stated hostile-race or production-activation blockers.
- Dry run 38243984748 at `806033a` failed two Windows/Node20 synthetic process
  tests when the real observer PID collided with fixed fixture IDs. It remains
  failed (737 passed, four skipped, two failed). Fixture roots/children now use a
  disjoint logical namespace, with actual observer edges kept explicit and legacy
  cardinalities still asserted. Production process accounting is unchanged.
  Length-only failure assertions avoid logging selected process IDs.

The exact frozen head, archive hash and hosted outcomes will be recorded in the
draft PR and private receipt. An ineligible same-version dry run establishes
validation/immutability guards, not publication or a new release artifact. The
separate Windows confidentiality failure remains failed; this feature offers no
ACL enforcement or privacy exception. Independent review and activation gates
remain required.
