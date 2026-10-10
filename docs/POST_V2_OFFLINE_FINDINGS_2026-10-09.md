# Post-v2 offline findings — October 9, 2026

PR #5 remains draft. No account request, merge, version change or publication is
authorized by this investigation. Published core 3.0.0 and the separate
owner-led first-use cohort (zero started attempts) are unchanged. Mandatory cash
cost is $0.

## Historical result remains failed

The consumed v2 run used source
`ec0b153d84e01987e524f63b8583957d3944bb1f`. Its private mode-0600 receipt has SHA256
`3d0151e612dff782c94c6b9cfa59245244401f3968a19b0a0876b02541265c0d`.
It made three explicit GET attempts/two underlying reads, returned partial in
both status fields, and produced one sourced title fact but zero useful jobs.
Detail selection rejected an unsupported identity with numeric agreement.
Cleanup tracked 16 processes before disposal and two at both checks; final
verification failed after 5,048 ms. Owner release and inactive context were not
sufficient. The retained receipt has no process identities, so it cannot identify
the original survivors. Neither the failed receipt nor its frozen archive is
modified or relabeled. The complete identifier report stays private.

## Two reproduced defects repaired

1. The signal handler exited successfully even when `dispose()` rejected. Three
   disposable Node fixtures reproduced exit status 0 for failed SIGINT, SIGTERM
   and SIGHUP disposal. The handler now exits 1 on failure, retaining failed
   ownership; a successful disposal still releases ownership and exits 0.
   The diagnostic disables these handlers, so this is not its historical cause.
2. If the observer's own argv quoted the disposable profile flag, process
   accounting seeded the Node observer and its probe/compiler descendants as
   profile processes. A disposable native observer reproduced this false
   positive. Accounting now excludes only its known current PID, after complete
   record validation. Genuine profile children are independently selected and
   their descendants retained. Malformed inventories, uncertain references,
   birth identity, PID reuse, reparenting and strict survivor checks remain.
   The historical runner normally receives its profile through the environment;
   this defect is not established as the historical cause either.

Before repair, the focused engine/process suite had six failures and 41 passes.
After repair, all 47 passed. The expanded SDK/engine/process/cleanup suite passed
171 tests without deadline or assertion relaxation. Disposable delayed-exit and
reparenting cases retain the existing failure rules.

## A longer native fixture still fails cleanup

Actual macOS Chrome experiments used fresh temporary profiles and a synthetic
local page, with zero LinkedIn requests. Immediate headless and headed disposal
each tracked nine processes to zero. A headed 20-second hold tracked ten to two
at both checks and failed the unchanged five-second final bound. A repeat with
fixed, in-memory command classifications also failed: ten to two, 35 checks,
5,040 ms, one reparented process. Both survivors classified as `GoogleUpdater`.
This substring classification is not executable attestation or evidence of the
historical account run's survivor roles. Failed disposable profiles are retained;
no unknown or potentially shared updater is killed or silently excluded.

The [Chromium updater manual](https://chromium.googlesource.com/chromium/src/+show/refs/heads/main/docs/updater/user_manual.md)
describes an out-of-process update service and per-user/system installations.
That makes detached updater activity plausible, not proof of ownership or safe
termination. Root-browser closure cannot certify every auxiliary's exit.
The installed Patchright launch defaults already disable background networking
and service autorun. Adding redundant flags, changing system update policy or
extending the acceptance deadline would not repair the demonstrated ownership
uncertainty. **This longer native cleanup gate remains failed.** A passing short
CI fixture does not close it.

## Normalized identity evidence is insufficient

| Public source                                                                                                                                                                                                                                                                                            | What it establishes                                                                                               | What it does not establish                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [LinkedIn URN concepts](https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/urns)                                                                                                                                                                                                       | Entity type is part of a URN; IDs and URNs have distinct reference roles.                                         | A contract mapping normalized job URNs to canonical job identity.                                         |
| [Pinned jobs parser](https://github.com/mguttmann/linkedin-internal-api/blob/4110552e08c310188a628b427733d9ff3a7e813c/mcp/lib/jobs_parse.py#L87) and [its fixture](https://github.com/mguttmann/linkedin-internal-api/blob/4110552e08c310188a628b427733d9ff3a7e813c/mcp/tests/fixtures/job_posting.json) | Public use of `fs_normalized_jobPosting`. The fixture explicitly says it is synthetic and proves only its parser. | Current provider response form, authoritative same-object binding or safe acceptance of matching numbers. |
| [Pinned DOM parser](https://github.com/beastx-ro/first2apply/blob/afb44e63f7ee9f2aab375eb3b30805920ce9e6ad/apps/backend/supabase/functions/_shared/parsers/linkedin.ts#L330)                                                                                                                             | A job-page tracking breadcrumb containing `objectUrn`.                                                            | Canonical authority of that field in our REST detail envelope.                                            |

Production acceptance remains limited to the existing supported whole numeric
entity URNs, with exact requested-ID agreement and uniqueness. No normalized
namespace, alternate endpoint, reference borrowing or fallback is added.
Three SDK regressions reject normalized entities even with a public JobPosting
type and matching/mismatched `objectUrn` or matching `jobPostingUrn` hints; errors
contain no canonical job URL. Existing absent, unsupported, mismatched and
ambiguous identity regressions remain required. Research retains its independent
identity/source guard.

## Decision and next discriminating evidence

A useful brief is **not ready for another meaningful v2 repeat**. Its production
detail identity remains unsupported, and the longer native cleanup fails. The
same diagnostic could repeat numeric agreement without changing either decision.
No new consent is requested now. A future proposal requires evidence that binds
one detail object to a supported canonical identity, rules out competing objects,
and demonstrates strict cleanup with a representative held browser session.
Any changed diagnostic must justify each newly retained structural field,
freeze the exact source/archive/runner/policy, state query and bounds, and receive
new explicit human approval before account access. No raw values or content may
be collected under the consumed scope.

## Candidate gates

Fresh local gates passed: 779 tests/34 files with one worker, lint, source/runner
types, metadata and build. The short actual macOS browser check tracked nine
processes to zero in 171 ms; it does not supersede the longer failure above.
Normal and ignore-scripts exact 15-file archives and installed CLI/setup/SDK
checks passed. Production, isolated publisher and full fresh-consumer audits
have zero findings; the consumer resolved SDK 1.32.1 and proxy-addr 2.0.8.
Full source audit exits 1 with one low development-only esbuild finding,
[GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), through
tsup. Its Windows development-server exposure remains separately documented;
the one-shot build uses neither serve nor watch. It is not suppressed or claimed
resolved by the zero production audit.

The local draft archive SHA256 is
`0416d885847d749e5af37aa3b5365921fecef66b8f8b75b9e60d22a7e6f23ee2`.
Independent source/privacy review found no repair defect. Exact-head hosted
matrix, release dry run, local/hosted archive equality and review readback are
recorded in PR #5's check/evidence summary before this candidate is considered
frozen. These gates prove build/install/contracts and bounded short offline
lifecycle behavior; they cannot establish useful live provider results or close
the failed longer Chrome experiment. This is an offline candidate, not a live
validation authorization or release-ready build.
