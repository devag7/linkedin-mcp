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
live health/identity → one read selected by the participant → inspect data/partial
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

## Testing the unreleased review branch

Until a new version is released, npm's published 2.0.3 is a different artifact.
Build and install the local tarball from the reviewed PR rather than testing
`@latest` and attributing its behavior to these changes. Record the source commit
and tarball integrity with the package version so the tested build is unambiguous.
Do not put the tarball or account data in a public report. After human review and
release, volunteers can use the exact new published version.

An existing maintainer setup can supply a consented live-read sanity check; label
it as such. It does not establish fresh installation, a new-user onboarding rate,
client compatibility on another device, or the 80% target. Keep cohort size zero
until genuinely consented first-use attempts are measured under the protocol.
