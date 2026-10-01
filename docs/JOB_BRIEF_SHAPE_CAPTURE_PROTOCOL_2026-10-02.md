# Job brief: offline diagnosis and proposed shape-only capture

October 2, 2026. **Prepared; no new LinkedIn access has been authorized or run.**
The earlier consent is consumed. PR #5 stays draft and its feature release remains
gated on evidence-backed fixes and a freshly consented useful brief. Core 3.0.0 is
a separate 22-tool release owned by the coordinated core-release chat.

## What offline inspection establishes

`get_job_details` calls the existing `jobPostingGraphql` builder. Its pinned query
ID is historical; current validity is unknown. `assertReadResponse` rejects nested
nonempty `errors` arrays or error objects before `shapeJobDetails` runs, returning
the fixed `PROVIDER_ERROR` envelope. This is the expected propagation path, not a
diagnosis of the provider's underlying cause. No raw message, extensions code or
response shape was retained in the consumed execution.

`shapeJobs` reads only normalized `included` entities with type suffix
`.JobPosting`, retaining `title`, `formattedLocation`/`location` and numeric
`listedAt`. The reviewed synthetic fixture contains location/description and the
research tests also contain listing time and company/detail fields. SDK tests
preserve those supported observations, including after a nested detail error.
Additional SDK regressions reproduce three title-only linked rows followed by
nested provider errors: both statuses stay partial, three search title facts
survive, missing fields stay unknown, raw causes stay private, and no fourth
attempt or fallback happens. These fixtures establish supported-shape behavior;
they cannot distinguish omitted live fields from an unsupported live field path.

No endpoint, query ID, field mapping, error classifier, identity defense or
three-attempt ceiling has been changed. Stale query IDs, permissions and changed
field paths remain hypotheses. Changing a route requires observed evidence; do
not substitute competitor code, a permissive validator or a blind fallback.

## Proposed fresh consent: one diagnosis only

Freeze and identify the exact resulting source SHA after source/package gates.
The runner is `scripts/diagnose-job-brief.ts`; its reducer is
`scripts/job-response-shape.ts`. Both are source-only and excluded from the npm
archive. Validate their strict TypeScript compilation separately, their redaction
regressions and the installed package's SDK gates. Record archive identity and
current-head hosted gates before access. Do not modify the frozen build while
consent is pending. A different source/runtime, query, account or budget requires
a new scope decision.

Use the existing explicitly selected profile on this Mac with normal pacing,
browser mode and both write flags false. Run offline setup/doctor first. Missing
Chrome/session, invalid state, active ownership, a budget lock or persisted stop
ends preparation; do not reset state, steal a lock, log in or repair a checkpoint
under this consent. No separate `health_check`, identity probe or profile read.

One real MCP SDK call through in-memory transport and the production runtime:

```json
{"name":"research_jobs","arguments":{"keywords":"TypeScript engineer","count":3,"enrich_first":true}}
```

At most three explicit Voyager GET attempts including cold identity, at most two
underlying read tools, three returned linked jobs, and no retries, continuation,
second query, writes, bookmarks, applications or login. Ordinary Chrome feed
navigation/assets/background traffic remain outside the explicit GET counter.
This is a source diagnostic, not an installed stdio or native-client validation.

The observer reduces only the search/detail JSON responses already returned by
those existing requests. It does not attach a network interceptor, request another
endpoint, record `/me`, change request headers or bypass validators. Existing
HTTP/auth/challenge/identity/error behavior and the request ceiling remain active.
Provider text is never executed. Use the SDK's 180-second total deadline and the
existing provider deadline. A timeout or any typed stop ends account work.

## Redaction and retention

Store one owner-only private receipt outside iCloud, never raw responses:

- Build/source identity, environment versions, transport, timestamps, status/code,
  counts, request bounds, fact-validation outcome and cleanup result.
- A bounded summary of allowlisted field paths with JSON types, observation counts
  and nonempty-string counts. No primitive values, raw entity type strings, dynamic
  property names, job IDs/URLs, descriptions, identity, cookies, headers or messages.
- Only fixed literal machine error classes from the reducer's reviewed allowlist;
  every other code becomes `unrecognized`. A recognized query code is evidence of
  that returned code, not permission to guess a replacement persisted query.

The reducer caps traversal at 10,000 nodes, depth 12 and 100 children per node.
Cycles, excess children or depth set `truncated`. Unknown keys become `<other>`.
Missing allowed fields do not prove no useful content exists under unknown or
truncated paths. If the summary cannot identify a fix, stop and propose a narrower
follow-up; do not silently expand capture scope or retain raw data.

Inspect source links and exact attribution in memory without opening them.
Always attempt local `close_session`, close SDK/server, dispose the browser and
verify owner release plus zero remaining associated Chrome processes. Uncertain
cleanup is a failure requiring manual inspection; no relaunch or lock deletion.
Preserve the profile, counters, checkpoints and journal. No `--logout` or erasure.

The CLI requires its fresh-source consent guard and a new absolute private output
path to prevent accidental execution. That guard is not proof of human consent;
the agent must first receive the explicit approval for the scope above.

## Next release gate

Review the redacted shape evidence, implement only justified changes and add SDK
regressions for the actual verified mapping/error/identity behavior. If a provider
route cannot be established, leave the feature blocked rather than guess.
Obtain fresh specific approval for one useful brief on the reviewed fixed build.
Require at least one linked job with a title and another observed location,
company, description or listing time, consistent contracts/provenance/bounds and
verified cleanup. Partial results remain partial compatibility evidence; SDK
source/stdio tests do not prove native chat or general provider availability.

Only then merge PR #5, choose the next appropriate semantic version (expected
3.1.0 for an additive tool), run exact local/package/hosted/dry-run gates, publish
through the existing workflow and independently verify all four destinations.
Update listings to the actual released scope. Mandatory maintainer cash remains
$0. First-use cohort, repeat-use measures, coordinated erasure, Windows privacy,
official OAuth and broad promotion remain separately unproven.
