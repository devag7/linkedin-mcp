# First-use and reliability evidence protocol

The roadmap's 80% first read within 15 minutes is a target, not a measured result.
Recruit consenting volunteers only after source and packed gates pass. Do not send
recruitment messages or enable tracking automatically. No volunteer was recruited
or tested in this local task.

Record only voluntary random study/attempt codes, attempt order/group, client/app
version, OS, Node/package version, elapsed seconds, fixed status/verification
booleans and the last completed setup step. The CSV defines the exact allowlist. Do not
collect LinkedIn identities/content, profile paths, cookies or token values.
Participants can stop or decline recording; no background analytics is installed.

Sequence: install pinned package → offline doctor → intentional manual login →
one approved read with its implicit identity checks → inspect data/partial
metadata → close client/server and confirm no owned browser remains. Stop at a
checkpoint; do not try another account to work around it. Do not test writes for
first-use onboarding. Record missing Chrome/display, permissions, unsupported
client, expired session, challenge, shape error, budget/pacing and cancellation
separately. Save fixed diagnostic codes, not raw page/MCP payloads.

Overall new-user numerator = people whose **first started attempt** completes a
qualifying useful read within15 minutes; denominator = all consenting people with
a started first attempt, counted once across all clients. Prior product users are
a separate returning-user cohort, not new-user successes. Keep every started first
failure; report later-client trials/repeats with separate started denominators and
distinct-person counts. First-client strata use only each person's initial client.
Record first read eventual completion separately
from the 15-minute target. A passing local mock does not enter either count.

For reliability, collect voluntary aggregate tool call counts, success/partial/
error category, challenge/provider outage classification and elapsed time. Report
sample and classification rules before proposing an SLO. Keep challenges visible
and show both overall and provider-available rates. Never erase failures from the
headline total. Month-1/4 reuse is a separate voluntary follow-up; no hidden user ID.

Hosted OS/Node results, actual Chrome first launch and graceful browser cleanup
must be linked to their real job/run evidence before the setup matrix says verified.
Synthetic engine lifecycle tests do not replace a real launch/cleanup observation.

## Published 3.0.0 cohort — ready to measure, no participants yet

Test `linkedin-mcp-tools@3.0.0`, source/tag
`299225871a3ff925984ca658974f334e90103c57`, archive SHA256
`c79f78e5e77814febb3f68ab9a391ef860515bcfd2d6f97001eadd6e00f58fe5`.
The [publication/install receipts](LAUNCH_EVIDENCE_2026-10-07.md) prove package
and SDK/config fixtures; they do not prove native client UI acceptance or live reads.

| Initial client | First-person started attempts | Useful first read within 15 minutes | Later-client trials / repeat-use observations |
| --- | --- | --- | --- |
| Claude Desktop | 0 | Not measured | 0 / 0 |
| Cursor | 0 | Not measured | 0 / 0 |
| VS Code | 0 | Not measured | 0 / 0 |

Before each attempt, obtain separate consent for (a) the tool-scoped login/read
and its implicit provider requests, (b) the anonymous started/outcome tally, (c)
optional private timing/status recording and (d) optional follow-up.
The participant operates their own account and client. Fix the chosen tool and
invocation scope before starting; no automatic retry, exploratory probes or writes.
Published3.0.0 does not enforce a numeric HTTP-request maximum; do not promise one.
A participant needing a hard cap must wait for a reviewed enforcing runner.
A checkpoint ends the attempt. Close the session even after failure; record whether
cleanup was actually observed. If recording is declined, do not collect their data.

Start the clock before installation; include prerequisites, configuration merge,
client restart, manual login and the selected read. Capture failures in the same
first-person denominator; later starts stay in their separate denominators.
Use the [header-only CSV](FIRST_USE_RESULTS.csv) privately under its participant-chosen
retention/deletion date, following [fixed scoring/privacy rules](FIRST_USE_RESULTS.md).
The [volunteer kit](FIRST_USE_VOLUNTEER_KIT.md) defines one login and one get_my_profile
invocation plus cold whoami/close_session, including implicit identity/profile sections.
Unknown request counts stay unknown and do not alone invalidate that observed scope.

A useful partial can qualify: nonempty own firstName/headline recognized as useful,
canonical own-profile source link, valid fetchedAt within the attempt, source voyager,
no error envelope, and consistent status=partial/partial=true (or ok/false). The read
contract has no top-level ok:true. Empty, missing, contradictory, unverified or
out-of-scope results fail. Useful partial successes are reported separately, never
as proof of complete profile sections or last profile-update freshness.
[Published offline readiness](FIRST_USE_READINESS_2026-10-07.md) separates SDK
export checks from native UI evidence. No runtime/version/release change.

No actual participant rows are published. Report weekly aggregate sample sizes,
client splits, failures and elapsed-time distribution. Repeat use means a voluntary
report of use on two distinct weeks within 28 days; report opt-in and response
counts separately. Monthly summarize first successful reads, repeat use, GitHub
traffic and net stars without conflating repository interest with account success.

An existing maintainer sanity check is not a fresh-user attempt and cannot enter
this cohort. The 80% target remains unmeasured until consenting attempts exist.
