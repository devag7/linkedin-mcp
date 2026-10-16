# Local data, retention and deletion

| Location | Contents | Retention / supported removal |
| --- | --- | --- |
| ~/.linkedin-mcp/profile or configured profile | Chrome cookies, local storage, cache and browsing/session data | Retained until logout or explicit selected-profile retirement; treat as credentials |
| <canonical-profile>.circuit.json | Fixed checkpoint reason, timestamps and cooldowns | Retained across logout/restart; explicit selected-profile retirement removes it; manual login clears a verified hard stop |
| ~/.linkedin-mcp/budgets.json | Hashed account keys, counters, warmup start, operation/input hashes, status and HTTP codes | No automatic expiry/eviction of journal IDs; new writes stop at 10,000 entries / 8 MiB |
| <profile>.owner.lock / <budget-file>.lock | Local owner identity, process/host/time/token | Released by the owning process; orphan repair after all owners/Chrome stop |

New profile directories and safety files request POSIX modes 0700/0600 on Linux
and macOS. Windows does not implement owner/group/other permissions through
[Node file modes](https://nodejs.org/docs/latest-v22.x/api/fs.html#fschmodpath-mode-callback).
The [merged Windows guard](https://github.com/devag7/linkedin-mcp/pull/24)
creates private native ACLs beneath the actual user profile, verifies existing
state and refuses unsafe custom parents before sensitive creation. A
[hosted second-user probe](https://github.com/devag7/linkedin-mcp/actions/runs/38685192976)
denied read and modification of 18 synthetic targets on Node 20 and 22 and
passed nine negative cases. The earlier
[public-parent exposure](https://github.com/devag7/linkedin-mcp/actions/runs/38213175092)
remains failed historical evidence. The guard is
[published in 4.0.0](RELEASE_EVIDENCE_4.0.0.md). **Published 3.1.0 predates it**:
do not use `LINKEDIN_PROFILE_DIR` under Public, shared or other broad-access
Windows locations with that package. The source proof covers the hosted runners and
synthetic state, not previously exposed files, every Windows policy, privileged
administrators or hostile same-account races. A hash is not anonymization.
Journals do not store target/content, cookies, raw provider bodies or response
details. Browser requests and returned data still involve LinkedIn and the
selected MCP client.
The server does not add cloud storage, analytics uploads or background telemetry.

`linkedin-mcp --logout` removes only an unaliased profile directory. Symlinks, Windows junctions and aliased ancestors are refused; nested links are unlinked without deleting their targets. For a custom
LINKEDIN_PROFILE_DIR, it refuses deletion unless the user also explicitly supplies
`--confirm-profile-deletion`. Review that exact path first: the whole directory is
removed. The command acquires profile ownership and refuses an existing owner.
It retains external circuit, budget and journal files; it does not reset caps or
clear checkpoints. Packed CLI tests verify the custom-path refusal and deletion.

To retire/uninstall completely, first stop all runtimes and associated Chrome for
all profiles using the shared budget file. Retain uncertain-operation records for
manual inspection if actions may be outstanding. Remove the exact profile and
external state only after deciding to forfeit replay protection. There is no safe
online command to erase a shared journal while another profile may own it. Do not
present state erasure as checkpoint recovery or resume automation with fresh caps.
Full coordinated erasure tooling is still an explicit coverage gap.

### Selected-profile retirement

Published 4.0.0 `--retirement-preview` inspects one selected browser profile
and prints bounded file/directory counts with fixed refusal reasons. It has
`applicationSupported:false` and no circuit-presence field. The unreleased
source extends the preview with circuit presence and an explicit apply command.
Neither preview prints paths, names, content or manifest hashes, acquires
locks, launches Chrome, makes account requests or deletes anything. Both set
`deletionAuthorized:false`. The separate
`--retire-profile --confirm-retirement` command will remove that selected
profile and its circuit file after fresh checks under the profile owner lock.
For a configured custom profile it also requires `--confirm-profile-deletion`.
Run the read-only preview first. The apply command makes no LinkedIn request.

The preview and apply preflight refuse observed owner locks, aliases/junctions, hard-linked files,
unexpected types, scope overlap, changed observations, more than 5,000 entries,
depth over 32 or aggregate regular-file size over 2 GiB. The apply command
removes the selected circuit state, which can contain a checkpoint stop. This is
an explicit safety-state reset for that profile. It retains shared budgets and
the write journal, legacy credentials, other profiles, client data and backups.
A successful preview is not stopped-owner proof or permission to delete;
filesystem observations can become stale immediately. An interrupted apply
leaves a private `.retirement.json` marker and possibly a quarantine directory;
subsequent previews, applies, normal browser startup and logout refuse until
an operator inspects the local state. An interrupted apply also retains its
owner lock. Do not delete the marker, lock or quarantine blindly. A noncooperating process
can still mutate files outside the ownership protocol. Complete coordinated
erasure and safe handling of uncooperating processes remain open. The
published 4.0.0 Windows guard does not authorize retirement or change the
preceding 3.1.0 archive.

Unreleased `--retirement-recovery-preview` gives a path-free, read-only report
for an interrupted selected-profile retirement: fixed presence fields and bounded
remaining quarantine counts. It never resumes removal or clears an owner lock or
marker. A valid marker always requires private operator review, even when its
planned quarantine is absent. The report does not inspect unrelated profiles,
shared history, client data or backups and cannot certify complete erasure.

Budget schema version 1 validates existing counters and adds operation and
warmupStartedAt fields without guessing old outcomes or LinkedIn account age.
Missing warmup start is initialized under a state lock at first verified use;
old counters/journal remain. Corrupt/unknown-version state fails closed. Older
versions that strip new fields must not share this state. Retain a secure backup
before a deliberate downgrade/migration. No automatic state reset is supported.

Doctor omits private paths and fixed diagnostics omit credentials/content/raw
exceptions. Normal tool logs contain operation names/codes/counts, not search
terms, message text or provider URLs. Synthetic tests check the error paths.
Manual --capture/--spike/--writecapture/--writeprobe output can contain real content
and identifiers; these are opt-in maintainer utilities, not support bundles. Review
and redact their output yourself before sharing. Do not attach Chrome profiles,
auth headers or unreviewed MCP result payloads to public issues.

## Local data inventory is not coordinated erasure

`--data-inventory` only observes fixed filesystem metadata, without reading
credential/safety contents, acquiring or clearing locks, changing storage,
launching Chrome or making account calls. It emits category labels and fixed
classifications; paths, owner/process identifiers, contents and exact metadata
are omitted. File JSON validity, exclusive/shared ownership, activity and native
permissions remain unverified even with exit 0. Profile children, additional
profiles, temporary files, logs, client-retained data, backups and in-memory
state are outside this bounded snapshot. Malformed file contents remain opaque.
Aliases (including detected Windows junctions), unexpected types, multiply-linked
files, inaccessible ancestry, unavailable identities and observed changes fail
closed. All present owner/transaction locks are uncertain, without inspecting or
stealing them. This feature does not complete P8 coordinated erasure or Windows
ACL proof and is not in immutable 3.0.0. Future deletion needs its own design and
review; this report never supplies an executable deletion plan.

### Inventory JSON contract

`schemaVersion:1`, `mode:offline_metadata_inventory` and `profileSelection` (default
or configured) identify the report. Six `entries` use only these fixed categories:

| Category | Scope and preservation reason |
| --- | --- |
| browser_profile | Selected profile; session credentials |
| circuit_state | Selected profile sibling; preserve safety stops |
| profile_owner_lock | Selected profile sibling; owner-managed |
| budgets_and_write_journal | Home store shared across profiles; preserve caps and replay protection |
| budget_transaction_lock | Shared home store; owner-managed |
| legacy_credentials | Legacy home store; not used by the browser runtime |

Each entry includes `scope`, `retention`, `observation`, `content:not_inspected`
and `ownership:unverified`. `reason` is omitted for successful presence/absence
observations. `erasurePreview` always has `supported:false`,
`deletionAuthorized:false`, `ownership:unverified` and a fixed preservation
instruction. There is no deletion command or proposed target list.

| Observation / reason | Meaning |
| --- | --- |
| present / absent | Two metadata observations agree; existing ancestry was checked root-to-leaf. A missing parent means its descendants are absent at that observation, not inaccessible. |
| refused / ALIAS_REFUSED | A symbolic link, junction or canonical directory alias was detected. No contents are opened or descendants enumerated; canonical-path metadata resolution may follow aliases solely to detect and refuse them. |
| refused / TYPE_REFUSED | An ancestor is not a directory or a leaf has an unexpected type. |
| refused / MULTIPLE_LINKS_REFUSED | A regular file has multiple hard links. |
| refused / SCOPE_OVERLAP_REFUSED | The selected profile contains the home, cwd or shared state locations. |
| refused / PATH_BOUND_REFUSED | The path exceeds 96 root-to-leaf components. |
| uncertain / IDENTITY_UNAVAILABLE | A native filesystem identity is unavailable. |
| uncertain / ACCESS_UNCERTAIN | Metadata or canonical-path inspection failed; raw error details are omitted. |
| uncertain / CHANGED_DURING_OBSERVATION | Presence or identity changed between observations. |
| uncertain / LOCK_OWNERSHIP_UNVERIFIED | A known lock directory exists; its owner is not read, tested or inferred. |

Exit 0 and `status:observed` apply only if all category observations are present
or absent; otherwise exit 1 and `status:needs_attention`. Both statuses retain all
content, activity and ownership limitations. Observations are sequential, not a
transactional snapshot; a new owner can start immediately afterward. Ancestor
identity/mode and leaf identity/type/link-count/size/time metadata are compared
in memory, but their values are never emitted. This does not exclude a filesystem
change that occurs entirely between observations, validate JSON or inspect nested
profile aliases. No permission/ACL or comprehensive local-data proof is claimed.

Disposable filesystem regressions and an installed CLI check exercise absence,
metadata presence, opaque malformed content, symlinks/junctions, wrong types,
hard links, ownership ambiguity, inaccessible ancestry, observed replacement and
resource bounds. These tests establish offline behavior, not native privacy or
provider compatibility. The command's read-only implementation performs only
lstat/realpath metadata calls; it never opens file contents or enumerates directories.
