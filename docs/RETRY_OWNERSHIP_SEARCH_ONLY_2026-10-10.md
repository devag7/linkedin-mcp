# PR #5: retry, updater ownership and search-only decision

Started from `0154fac23a0cd963b54a7e9f4de0a088d46bcd88`. Published 3.0.0,
historical failed receipts, previous freeze files and protected sync copies remain
unchanged. No LinkedIn access, volunteer contact, merge or publication occurs.
Mandatory maintainer cost remains $0; first-use cohort remains zero attempts.

## Windows preflight: report both attempts

[Dry run 37938754941](https://github.com/devag7/linkedin-mcp/actions/runs/37938754941)
attempt 1 failed on Windows/Node 22 with `PROCESS_SNAPSHOT_TIMEOUT` during
`process_preflight`, exit 1, before Chrome launch. The native PowerShell/CIM
inventory exceeded its existing five-second deadline. Retained evidence cannot
separate PowerShell startup, CIM execution or runner scheduling as the cause.
The failed metadata and logs remain preserved.

Exactly one authorized failed-job retry was requested at the same full source
SHA. Attempt 2 passed. Only Windows/Node 22 actually re-executed among compatibility
jobs; the five already successful jobs were reused. Its previously skipped four
dependent release jobs then executed in dry-run mode. Job start timestamps and
the five attempt-2 top-level logs establish this; GitHub assigns copied successful
jobs new IDs, so ID changes alone do not prove re-execution. All nine publication,
destination mutation and release-finalization steps were skipped. The downloaded
release archive equals the local archive byte-for-byte, SHA256
`0416d885847d749e5af37aa3b5365921fecef66b8f8b75b9e60d22a7e6f23ee2`.

Non-recurrence is consistent with transient delay; the underlying cause is not
proven. No timeout increase, fallback, inventory-as-zero conversion or process
preflight code change is supported. No second failed-job retry is made.

## Native updater ownership: strict failure still reproduces

Disposable headed Chrome profiles used only synthetic local content. Native
identities/commands/paths stayed in memory. The private mode-0600 experiment
retains fixed executable/scope classifications, profile-reference/ancestry/birth
comparisons and aggregate process/cleanup counts. This is offline fixture evidence,
not a changed live diagnostic scope.

With two overlapping profiles, each acquired two tracked updater wake descendants
after a 20-second hold. Reported executable paths resolved under the user-level
GoogleUpdater installation, not either disposable profile; neither argv contained
a profile reference. Each pair had the corresponding profile's Chrome ancestor.
Installation-level server processes were also observed under init, outside both
tracked profile trees. Profile B (20 seconds) and profile A (about 40 seconds)
cleaned up with zero at both checks, in 206 and 214 ms respectively. No special
process handling was applied.

A separate single-profile 20-second repetition reproduced the failure: ten tracked
processes before disposal, two at both cleanup checks, final verification false
after 5,091 ms. The two tracked descendants had the same user-installation executable
classification and `--wake` role. Failed disposable state is retained. This narrows
the fixture's survivor role beyond a substring classification, but does not attest
the running executable image, prove exclusive termination authority or identify the
historical account run's survivors. The original live failure remains failed.

The [Chromium updater design](https://chromium.googlesource.com/chromium/src/+show/refs/tags/140.0.7263.2/docs/updater/design_doc.md)
describes installation-level updater services and launchd scheduling. A browser
ancestor establishes launch provenance, not exclusive ownership of subsequent
installation-wide work. Unknown/shared services are never killed or filtered;
tracked wake descendants remain counted. No engine/accounting handling changes,
system update changes or relaxed cleanup deadline are justified.

## Identity unchanged; search-only has a narrower question

`fs_normalized_jobPosting` remains rejected. The existing public REST parser's
[fixture is explicitly synthetic](https://github.com/mguttmann/linkedin-internal-api/blob/4110552e08c310188a628b427733d9ff3a7e813c/mcp/tests/fixtures/job_posting.json).
Additional pinned [DOM parsing](https://github.com/zaeeeeeem/LinkedinLeadOS/blob/17bec3f90a1ba700973f745a15432a28d7966113/src/capabilities/job.get/parse.ts)
and [HTML number extraction](https://github.com/andrebradshaw/linkedInJobs_2json/blob/466b068f29d54c16e629c530dfb1fe05120db9cd/async_getSearchResults.js)
do not establish a unique canonical identity for our REST detail object. A number
found anywhere in a document is insufficient. No endpoint or identity fallback
is added.

The existing `research_jobs(enrich_first:false)` path can form a useful comparison
from a supported job's own observed title plus location or listing date. Three
new real-SDK synthetic regressions prove: source/fetch attribution, two explicit
GET attempts including identity, one underlying search tool, no detail request,
useful partial results beside an insufficient title-only row, and rejection of
unsupported normalized identity. Company/description remain unknown. The useful
criterion is unchanged; titles, workplace flags and inferred fields cannot qualify.
Fixtures prove composition, not current live search-field availability.
The retained October 8 count-three run supplied three sourced title facts and
zero useful jobs; its detail read failed. Disabling that detail call on the same
observations would still leave a title-only brief. No production search-field
extraction change has been supported, so the mode flag alone is not a remedy.

## Decision

The Windows retry passes at the original source; the held native cleanup gate
still fails. A useful enriched brief remains blocked by unsupported identity.
Search-only is an offline-tested candidate, not a verified useful live brief.
PR #5 stays draft. No consent request is made while representative strict cleanup
is unresolved. A further proposal also needs a reason that a new observation can
change the title-only evidence, rather than merely disabling a rejected detail
call. Once those conditions hold, a newly consented search-only call could test
whether current supported search objects supply an independently attributable
title plus location/listing date. It would omit detail and identifier diagnostics,
retain only validated counts/status/timing and cleanup flags, and require a new
frozen build and explicit bounded scope approval. That possibility is not
authorization or a runnable frozen protocol.

Fresh local gates passed 782 tests/34 files, lint, source/runner types, metadata,
build, normal/ignore-scripts exact 15-file package checks and installed CLI/setup/SDK
checks. Production, isolated publisher and full fresh-consumer audits have zero
findings; consumer SDK is 1.32.1 and proxy-addr 2.0.8. Full source audit still exits
1 with one low development-only esbuild finding, GHSA-g7r4-m6w7-qqqr, through tsup;
the one-shot build does not use its Windows development server or serve/watch.
The draft local archive SHA256 is
`c69c6004ab8e271884eebe3bc621a5a0f6be1f5c2ffaf83a6a2dfc216c47b2d8`.

Exact-head CI and a new pinned release dry run must be completed and recorded in
PR #5's resulting-head check/evidence summary; the successful retry above belongs
to the prior `0154fac` source, not these new tests/contracts. Passing short
lifecycle checks do not replace the longer failed fixture or establish live
usefulness.
