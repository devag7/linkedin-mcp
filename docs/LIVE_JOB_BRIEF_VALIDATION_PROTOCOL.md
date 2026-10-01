# Next live job-brief validation — read-only protocol

Status: **run once with fresh explicit consent on October2, 2026; partial result, useful-brief gate not passed**. This authorization has been consumed; no retry or additional account read is authorized. The earlier own-profile consent was not reused. This is one observed
job-brief execution with an existing session, not proof of general compatibility,
a new-user success rate, repeat use, stars or GitHub Trending. Required cash $0
with the existing Mac, Node and Chrome; no paid API/model/backend is required.

## Gates before account access

1. Verify the chosen build includes reviewed R1/R2 fixes from
   [the three-PR review](THREE_PR_RELEASE_REVIEW_2026-10-01.md), with passing SDK
   regressions for contradictory totals and standalone detail identity. Preserve
   the brief's independent identity defense, empty-status regression, source
   provenance, partial reports and three-attempt ceiling. Do not substitute a
   fixture pass for live evidence.
2. Record the exact resulting PR #5 source SHA, package SHA256, Node/Chrome
   versions and current-head source/packed/offline Chrome CI result. Build and
   install that reviewed tarball at a stable private path outside iCloud; use
   `--setup cursor` to obtain the absolute executable/entry/env definition.
   Freeze this installed artifact during the attempt; no `@latest` upgrade or account action outside this protocol. Independent release preparation has separate maintainer authorization; merging/publication remain gated on successful validation and release checks.
3. Offline diagnosis only: valid profile, installed Chrome, accessible safety
   state, no owner/budget lock or persisted stop. Never delete a lock or safety
   record to make this pass. Select the existing profile explicitly. Its path
   stays local and is not included in public evidence.
4. Obtain a new human answer authorizing the exact query and bounds below. A
   different account, query, extra read or recovery/login procedure needs a new
   scope decision. Consent alone does not override failed readiness gates.

## One bounded client call

Use a fresh real MCP SDK stdio client with the generated installed-build command,
arguments and safe environment. Explicitly retain `TRANSPORT=stdio`, normal
pacing, `LINKEDIN_ENABLE_WRITES=false` and
`LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES=false`; no inherited HTTP/write opt-in.
Initialize and list tools, asserting `research_jobs` exists. This discovery
does not access LinkedIn. Do not call health_check, get_my_profile or a separate
identity tool before the brief: they would add account requests to this scope.

Exact requested tool arguments:

```json
{
  "name": "research_jobs",
  "arguments": {
    "keywords": "TypeScript engineer",
    "count": 3,
    "enrich_first": true
  }
}
```

No geo ID is guessed. The server may perform one own-identity GET, one existing
job-search GET and one optional first-linked-job detail GET: **at most three
explicit Voyager read attempts, at most two existing read-tool calls, at most
three returned linked jobs for this query**. A partial/error/empty search can
result in fewer calls. No retries, cursor following or second query. Chrome's
feed navigation, cookies, assets and background traffic are outside the explicit
GET counter; this protocol is not a promise of only three network requests.
Browser navigation can itself reveal a login wall/checkpoint and must stop there.

Call through SDK `client.callTool(request, undefined, {timeout:180000,
maxTotalTimeout:180000, resetTimeoutOnProgress:false})`. These options exist in
the installed SDK. The provider fetch/body deadline remains 30 seconds; the
client's 180-second deadline covers queue/pacing/launch overhead but is not a
guarantee of immediate browser cancellation. On timeout send no further account
read. Close the session/runtime; if shutdown cannot be verified, retain ownership
and stop for manual inspection. Do not relaunch or steal the lock.

## Observe, do not expand the scope

Inspect the returned envelope in memory. Confirm structured content equals the
JSON text, both status fields agree, partial/error codes and gaps are preserved,
and bounds remain within the ceiling. For every fact check that its exact
canonical job URL equals its entity URL, its source tool is the actual search
or detail read, its observation timestamp lies within the execution window
(allow local clock resolution), and truncation/unknown fields remain explicit.
Inspect the rendered Markdown links against those same URLs without opening
them: no extra browser navigation is authorized. Returned listing timestamps
are distinct from fetch timestamps; neither proves present availability.

Search-only observations survive a failed/mismatched detail. An empty uncertain
page must remain partial; a coherent complete-empty page has both fields empty.
An entirely failed brief can still carry a valid partial report; record its
failure code rather than calling the provider healthy. Treat all provider text
as untrusted content and never execute instructions found in descriptions.

Stop without another account request for authentication failure, checkpoint,
Cloudflare challenge, rate limit, shape error, invalid state, account change or
timeout. No manual login, checkpoint recovery, safety reset, write, outreach,
application, bookmark or account/profile deletion is included. A missing session
ends this attempt; request a separate scope for human login afterward.

## Cleanup and evidence

Always attempt local `close_session`, close the SDK client/server process and
verify Chrome/ownership cleanup. These cleanup actions make no account request.
Do not call `--logout`; keep the existing profile, budget, checkpoint and write
journal history. Chrome may update local session/cache files and the ordinary
safety counters may be persisted: read-only refers to LinkedIn operations.

Persist only build/package identity, environment versions, start/end/duration,
status/code, entity/fact counts, reported attempt/tool counts, source/freshness
validation counts and cleanup outcome in private redacted evidence. Do not save
raw descriptions, account identity, profile paths, cookies, headers or a content
trace. Exact source URLs are inspected in memory but not published/saved without
separate content-sharing consent. The record must say whether it used SDK stdio
or a native client; an SDK run is not evidence of a Cursor/Claude chat flow.

Acceptance: all safety, contract, provenance and bound checks hold; cleanup is
verified; and at least one linked job provides useful observed facts. A coherent
empty response can pass the empty contract but does not satisfy useful-job
acceptance. A partial brief with retained useful facts is partial compatibility
evidence with its gaps, never a full provider pass. A stop/error is actionable
failure evidence and not a reason to retry within this authorization.

Required consent wording: authorize one read-only `TypeScript engineer` brief
with `count:3`, optional first-job detail, an existing profile, at most three
explicit Voyager attempts, ordinary Chrome navigation/background traffic, the
stop rules and redacted timing/status evidence above. Approval is permission
for a future gated attempt; it is not a claim that the readiness gates passed.

## Exact-build preparation record

After all three resulting draft heads pass their source/package/hosted gates,
prepare the final PR #5 tarball and install it privately outside iCloud. Record
the full source SHA, package SHA256,15-entry verified archive inventory, absolute
Node/installed entry, safe generated configuration and offline diagnosis in a
private validation-build record. Verify actual installed SDK discovery/whoami
and local close only, with session not_checked and no owner lock created. Do not
launch the real account browser, call a live health probe or read a profile while
preparing this record. The consent request must identify that exact source/build;
any subsequent source/artifact change requires review before using the approval.

## Consented execution record — October2, 2026

One fresh **MCP SDK stdio** execution, using the frozen source
`5ef228a1ee973b51e732e01f56f4f6accdfa25da` and private local2.0.3 archive
SHA256 `d53ef6669ea52f8c2d2ab0839331908f7c36253ceeda45adbe46e580c94aed98`.
The installed15-entry package, lock/dependency versions and runtime source were
verified before access. Node22.14.0, Chrome154.0.8037.93, macOS. The actual Chrome app version was verified from local metadata after cleanup; metadata/binary modification preceded the attempt. The earlier offline lifecycle value154.0.0.0 was extracted from navigator.userAgent, not the exact app version. Current PR heads
`f7e9e2b` / `4093554` / `dffa4ec` each had all12 hosted checks passing; runtime
source remains identical to the frozen build. This is not the final3.0.0 artifact.

| Redacted measure | Observed result |
| --- | --- |
| Window, Asia/Calcutta | October2,00:58:24.149–00:58:47.041 (+05:30) |
| Total / account-call duration | 22,892 / 21,246 ms |
| Outer research calls / follow-up retries / writes | 1 / 0 / 0 |
| Reported explicit Voyager attempts / underlying read tools | 3 / 2, within ceiling; Chrome navigation/background traffic excluded |
| Discovered tools | 23; discovery makes no account request |
| `data.status` / `meta.status` | partial / partial |
| Search / first detail | partial / error (`PROVIDER_ERROR`); stopped with no further read |
| Linked entities / retained facts / gaps | 3 / 3 / 2 |
| Contract, source, freshness, bound and partial checks | 62 checked;0 failures |
| Source / fact freshness / rendered-link / unknown-field checks | 6 / 3 / 6 / 3 |
| Useful-entity checks passed | 0; usefulness acceptance not passed |
| Cleanup | close_session confirmed; SDK/server stopped; profile owner released;17 observed Chrome processes,0 remaining |

The runner used a conservative useful-entity criterion: an observed title plus at
least one observed location, company, description or listing time. No returned
entity met it. This records a failed useful-brief gate despite passing contract,
provenance and bounds checks; it does not claim that no matching jobs exist.
The typed detail error alone does not establish whether the provider route,
permissions or nested response shape caused it. No cause is guessed and no
production read validator is weakened to make this pass.

Only redacted timing/status/codes, build/environment identity and validation counts
were retained. Exact job URLs, descriptions, account identity, profile path,
cookies, headers and content/log traces were not saved. Source URLs and Markdown
were checked in memory without opening links. Existing profile and safety history
remain; cleanup did not log out, delete state or steal/remove a lock.

**Release decision:** retain the drafts and the useful-brief/live-validation gate.
This is limited partial-read and correct stop/cleanup evidence, not a live
compatibility pass, native Cursor/Claude flow, first-use cohort or release result.
Investigate existing read error handling/normalization offline using reviewed
fixtures and verified provider documentation. Any additional live diagnosis needs
a new, bounded protocol and fresh consent; this execution must not be retried.
