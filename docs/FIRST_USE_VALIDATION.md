# First-use and reliability evidence protocol

The roadmap's 80% first read within 15 minutes is a target, not a measured result.
Recruit consenting volunteers only after source and packed gates pass. Do not send
recruitment messages or enable tracking automatically. No volunteer was recruited
or tested in this local task.

Record only a voluntary pseudonymous participant code, client/app version, OS,
Node/package version, start/end time and the last completed setup step. Do not
collect LinkedIn identities/content, profile paths, cookies or token values.
Participants can stop or decline recording; no background analytics is installed.

Sequence: install pinned package → offline doctor → intentional manual login →
one approved read with its implicit identity checks → inspect data/partial
metadata → close client/server and confirm no owned browser remains. Stop at a
checkpoint; do not try another account to work around it. Do not test writes for
first-use onboarding. Record missing Chrome/display, permissions, unsupported
client, expired session, challenge, shape error, budget/pacing and cancellation
separately. Save fixed diagnostic codes, not raw page/MCP payloads.

First-use success numerator = volunteers completing that chosen read within 15
minutes; denominator = all consenting started attempts. Include failures and
report sample size/client/OS split. Record first read eventual completion separately
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

| Native client | Consenting started attempts | First read within 15 minutes | Repeat-use observations |
| --- | --- | --- | --- |
| Claude Desktop | 0 | Not measured | 0 |
| Cursor | 0 | Not measured | 0 |
| VS Code | 0 | Not measured | 0 |

Before each attempt, record separate consent for (a) manual login and the selected
bounded read, (b) redacted timing/status recording, and (c) an optional follow-up.
The participant operates their own account and client. Fix the chosen tool and
request ceiling before starting; no automatic retry, exploratory probes or writes.
A checkpoint ends the attempt. Close the session even after failure; record whether
cleanup was actually observed. If recording is declined, do not collect their data.

Start the clock before installation; include prerequisites, configuration merge,
client restart, manual login and the selected read. Capture failures in the same
denominator. Record only this minimal schema, stored privately with the participant's
chosen retention/deletion date:

```csv
participant_code,client,client_version,os,node_version,package_version,elapsed_seconds,last_step,result_code,within_15_minutes,cleanup_observed,recording_delete_on,followup_opt_in
```

The runnable kit now lives in [volunteer instructions and separate consents](FIRST_USE_VOLUNTEER_KIT.md),
with [fixed scoring/privacy rules](FIRST_USE_RESULTS.md) and a [header-only template](FIRST_USE_RESULTS.csv).
Use that updated schema for new attempts; the minimal schema above is historical.
Its default own-profile scope permits nine explicit GET attempts including login
verification and identity, with no separate health probe. This is a source-derived
envelope, not a runtime-enforced request limiter; report unknown enforcement honestly.
[Published offline readiness](FIRST_USE_READINESS_2026-10-07.md) distinguishes all
three SDK export flows from native UI blockers. No package/runtime change or new release.

No actual participant rows are published. Report weekly aggregate sample sizes,
client splits, failures and elapsed-time distribution. Repeat use means a voluntary
report of use on two distinct weeks within 28 days; report opt-in and response
counts separately. Monthly summarize first successful reads, repeat use, GitHub
traffic and net stars without conflating repository interest with account success.

An existing maintainer sanity check is not a fresh-user attempt and cannot enter
this cohort. The 80% target remains unmeasured until consenting attempts exist.
