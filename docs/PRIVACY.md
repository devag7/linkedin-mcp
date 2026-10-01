# Local data, retention and deletion

| Location | Contents | Retention / supported removal |
| --- | --- | --- |
| ~/.linkedin-mcp/profile or configured profile | Chrome cookies, local storage, cache and browsing/session data | Retained until logout; treat as credentials |
| <canonical-profile>.circuit.json | Fixed checkpoint reason, timestamps and cooldowns | Retained across logout/restart; manual login clears a verified hard stop |
| ~/.linkedin-mcp/budgets.json | Hashed account keys, counters, warmup start, operation/input hashes, status and HTTP codes | No automatic expiry/eviction of journal IDs; new writes stop at 10,000 entries / 8 MiB |
| <profile>.owner.lock / <budget-file>.lock | Local owner identity, process/host/time/token | Released by the owning process; orphan repair after all owners/Chrome stop |

New profile directories and safety files request POSIX modes 0700/0600 on Linux
and macOS. Windows does not implement owner/group/other permissions through
[Node file modes](https://nodejs.org/docs/latest-v22.x/api/fs.html#fschmodpath-mode-callback).
Windows tests exercise ownership, shared-state transactions and cleanup, but do
not establish NTFS ACL privacy. Keep profiles and shared budgets in a directory
private to your OS account; review its native permissions before live use. Native
ACL enforcement/verification remains an explicit security follow-up. A hash is
not anonymization. Journals do not
store target/content, cookies, raw provider bodies or response details. Browser
requests and returned data still involve LinkedIn and the selected MCP client.
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
