# LinkedIn MCP: current gaps and zero-cash execution roadmap

Updated October 1, 2026. This is the actionable PRD/TRD and product backlog for
`devag7/linkedin-mcp`. Preserve the original
[2026 roadmap](../PRODUCT_TECHNICAL_ROADMAP_2026.md) and its historical findings;
this document adds current evidence rather than rewriting that baseline.

## Objective and decision rules

Build a convenient local research product people return to and recommend. GitHub
API currently reports **10 stars**. Ten thousand stars and a place on GitHub
Trending's daily page are ambitions measured over time, never promised outcomes.
Zero cash means no mandatory paid service or substantial maintainer expense.
Quality, documentation, safety and testing remain release requirements. A user's
existing computer, Chrome, Node and local MCP client are prerequisites; paid model
subscriptions or optional integrations are user-funded and never backend dependencies.

Primary users: individual job seekers preparing an application/interview, developers
connecting their assistant, and researchers preparing a small professional brief.
The value proposition is structured, source-linked, bounded research with explicit
freshness and limits. Bulk outreach, harvesting, account farms, evasion, automated
captcha handling and unattended write campaigns stay outside scope.

## Current source and installation comparison

Retrieved current GitHub repository metadata, default-branch commits, README and
source on October 1. Stars are snapshots, not quality rankings. Compared two
leading dedicated LinkedIn MCP repositories from GitHub's star-sorted repository
search; unrelated course/skill repositories were excluded. Their source establishes
implemented intent, not independent live compatibility. No competitor was logged
in or exercised against LinkedIn.

| Repository / pinned source | Observed installation and product | Implication |
| --- | --- | --- |
| [stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server/tree/6eb4d1ffcd76e2fa428919c0f1f51e3bb29cb4dc), 3,692 stars | README offers uvx, Claude bundle, plugin and Docker; managed browser preparation and browser-session import/manual-login fallback. [Job tools](https://github.com/stickerdaniel/linkedin-mcp-server/blob/6eb4d1ffcd76e2fa428919c0f1f51e3bb29cb4dc/linkedin_mcp_server/tools/job.py) implement richer filters and bounded saved jobs; README also lists conversation and post search. [Bootstrap](https://github.com/stickerdaniel/linkedin-mcp-server/blob/6eb4d1ffcd76e2fa428919c0f1f51e3bb29cb4dc/linkedin_mcp_server/bootstrap.py) confirms automatic setup machinery. | Tool count alone does not differentiate. Make our first-run path concrete and predictable; investigate saved jobs next. Do not copy cookie import automatically or imply safety parity from inspection. |
| [eliasbiondo/linkedin-mcp-server](https://github.com/eliasbiondo/linkedin-mcp-server/tree/34d277c180ab4726a67d991494baf294e52230e9), 193 stars | README requires Python 3.12+, uv, clone/sync, Patchright browser installation, manual login and JSON client configuration. [Job registration](https://github.com/eliasbiondo/linkedin-mcp-server/blob/34d277c180ab4726a67d991494baf294e52230e9/src/linkedin_mcp_server/adapters/driving/mcp_tools/job.py) forwards date, employment type, experience, work type, Easy Apply and sorting to its use case. | Our smaller runtime install is useful; missing job filters reduce repeat value. Their parameters do not verify our Voyager wire shapes. |
| This project, safety review head `0017fe1` | Node 20+, Chrome, manual login; 22 tools; offline doctor; explicit capabilities and partial results; packaged stdio proof on three OSes. New writes require short-lived server proof and explicit client approval. | Stronger correctness evidence must translate into a shorter user journey. Setup configuration is the first separate feature; live first-read and desktop UI evidence remain separate. |

Client formats were checked against primary documentation:
[Cursor](https://cursor.com/docs/mcp),
[local MCP/Claude Desktop setup](https://modelcontextprotocol.io/docs/develop/connect-local-servers),
[VS Code](https://code.visualstudio.com/docs/agent-customization/mcp-servers).
Claude/Cursor use `mcpServers`; VS Code's native `.vscode/mcp.json` uses `servers`.
Current VS Code also recommends portable `.mcp.json` for new agent-host setups;
our explicit `vscode` export targets its documented native configuration, with
that choice disclosed. No desktop UI success is inferred from matching JSON.

## PRD and acceptance criteria

**User journey:** install a reviewed build → offline setup → resolve local issues →
manual login when authorized → merge client entry → cold `whoami` → health → one
useful read → close → repeat with the same stable installation/profile.

| Requirement | Acceptance and evidence |
| --- | --- |
| Convenient first run | One offline `--setup <client>` report includes diagnosis, selected-client configuration and exact login/doctor command arrays. Missing software/permissions/locks/stops are actionable; no Chrome launch, account request, download or config-file mutation. |
| Reliable client configuration | `--client-config` prints parseable JSON for Claude Desktop, Cursor and VS Code. Absolute Node and installed entry avoid GUI PATH differences; spaces remain separate array arguments. Override inherited HTTP/write opt-ins; never export tokens/cookies. Moving the installation requires regeneration. |
| Honest first successful read | Record client/OS/build and time to schema-valid own-profile read; partial results stay partial. A cold session is not labeled logged out. Setup readiness does not prove login. No new account requests under the previous consent. |
| Repeat research value | Bounded saved-job/filter/search/brief features below must expose source URLs, completeness, freshness, checkpoints and unsupported routes; no implicit crawling. |
| Reviewed actions | Five-minute process-owned proof binds action/target/content/ID. Human consent is a client requirement. Existing journal results remain lookup-only after restart/expiry; unknown outcomes never auto-retry. |
| Maintainability | No new provider endpoint without approved capture evidence and tests. Every feature has a separate draft PR, rollback path and recorded platform gates. Retain historical evidence and private backups. |

Target, not measured performance: at least 80% of a consented volunteer cohort
completes its first read within 15 minutes; report numerator, denominator, median
and p90, OS, build and failure stage. Never advertise this target as achieved.
Weekly repeat useful workflows are the operational north-star; stars are attention.

## TRD: implemented first feature

The separate `codex/first-run-setup` track is stacked on draft PR #3, whose safety
corrections stay independently reviewable. `src/setup.ts` reuses offline doctor
inspection and emits only an explicit environment allowlist. `src/index.ts` parses
`--setup <claude-desktop|cursor|vscode>` and `--client-config <client>` before starting
MCP. Setup returns `local_ready` or `needs_attention` and `session:not_checked`;
exit 1 means local attention is needed. Configuration export can still succeed
with missing Chrome/blocked state so the user can prepare configuration safely.

Each entry launches the installed build with an absolute Node executable and
entry path. It fixes stdio/browser mode and disables normal/experimental writes.
It carries the selected profile and explicit Chrome path without credential env
values. Login/doctor command descriptors reuse that exact environment, avoiding
login to a different profile from the client. It never replaces another client
entry or modifies a client file. Review and merge the `linkedin` entry manually.
For stable use install the reviewed tarball outside temporary npx caches/iCloud;
regenerate after moving Node, the package or upgrading the build.

`tests/setup.test.ts` checks formats, path-with-spaces handling and policy overrides.
`scripts/verify-setup.mjs` executes the compiled CLI, parses setup and export JSON,
then launches **those generated entries** with the real MCP SDK stdio client.
It lists 22 tools, checks cold identity, blocked health/profile, disabled-write
preview and clean closure using a disposable persisted-stop fixture. The packed
artifact verifier runs this against a fresh installed tarball. This proves actual
MCP client/process flow, not live providers or full application chat/read flows. Native VS Code 1.139.1 additionally accepted the export, launched it and discovered22 tools in a stopped disposable profile; the temporary window was closed and the original workspace restored. Claude/Cursor UI remains untested.
No new dependency, provider route or tool is introduced.

Rollback: omit the setup flags and use existing manual configuration. Retain PR #3
safety corrections and journals; do not downgrade state handling to erase outcomes.

## Prioritized feature backlog

Scores are engineering estimates from current evidence: user value V and feasibility
F are 1–5 (higher better), maintenance burden M is 1–5 (higher worse); order score
`2V + F - M`. Required cash is maintainer/backend cost; estimates exclude an existing
computer and voluntary user client costs. Hours are planning ranges, not guarantees.
All proposals require source/contract/packed/hosted gates and an honest capability entry.

| Priority / proposal | V/F/M; score | Acceptance criteria | Dependencies and evidence gate | Build / maintenance estimate | Required cash |
| --- | --- | --- | --- | --- | --- |
| P0 Safety review corrections | 5/5/2; 13 | Alias/junction deletion refused; issued proof for new writes; old outcome lookup; exact draft/tag SHA verification | PR #3 review + twelve hosted jobs; synthetic-only release tests | Implemented; 1–2 h/month review | $0 |
| P1 Offline setup + client export | 5/5/1; 14 | Three formats, exact installed-build launch/env, useful failures, no account access, packed real SDK flow | PR #3 safety head; primary client docs; VS Code native launch/discovery observed; full UI read checks still needed | Implemented; 1–2 h/month format review | $0; paid clients optional/user-funded |
| P2 Bounded source-linked research briefs | 5/4/2; 12 | One requested topic, maximum 3 explicit Voyager read attempts (including identity; browser assets/navigation excluded)/10 entities; source URL + fetchedAt per claim; explicit partial/unknown; no inference presented as source fact; deterministic export Markdown/JSON | Existing verified read primitives, schema/source review; consented end-to-end read required before live claim | Job brief implemented in separate draft; 2–4 h/month; other research scopes remain planned | $0 deterministic assembly; optional user-funded model summarization |
| P3 Saved jobs | 5/2/3; 9 | Own saved jobs only, max25/request and max2 explicit pages; preserved source IDs/URLs, empty/changed-shape distinguished | Consented read capture of actual provider/UI route; no authorization currently. Competitor DOM implementation is feasibility evidence only | 3–6 days after capture; 3–6 h/month | $0 |
| P4 Richer job filters | 4/3/3; 8 | Date/work type/employment/experience/sort supported only for verified mappings; unsupported combinations rejected; tests prove query and cursor binding | Capture/inspect each query parameter under new consent; locale fixtures and documented defaults | 2–4 days; 2–4 h/month | $0 |
| P5 Conversation keyword search | 4/2/4; 6 | Own inbox only, explicit max2 pages/25 matches; no entire-inbox scan; source thread links where verified; completeness partial | Verify endpoint or implement bounded filtering over existing read results with clearly local semantics; sensitive-content retention review | 3–5 days; 3–6 h/month | $0 |
| P6 Post search | 3/2/4; 4 | Verified route/filter only, max25/request, schema/source link and changed-shape tests | Consented capture; locale and query-ID drift evidence. Do not copy rotating IDs from another repo | 3–6 days; 4–8 h/month | $0 |
| P7 Desktop client first-use matrix + packaging convenience | 5/3/2; 11, gated by access | Record app/OS/version/build, native config acceptance and cold setup; at least one authorized real first read per claimed pairing | Installed clients and renewed user consent; Windows/Linux volunteer machines; signed bundles only when feasible | 2–4 days + volunteers; 2 h/month | $0 with volunteer devices; code signing optional and outside required scope |
| P8 Data inventory/erasure + Windows ACLs | 4/3/3; 8 | Inventory first; safe alias refusal; account/session cleanup after all owners stop; journal removal explicit and documented as safety-history loss; NTFS deny-other-user proof | Review privacy/state migration; fixture+Windows tests; no silent budget reset while runnable profile remains | 4–7 days; 2–4 h/month | $0 |
| P9 Official identity/publishing provider pilot | 3/2/3; 5 | Actual OAuth scopes control discovery; unsupported browser reads never silently fall back; one approved identity/publish test per exposed action | Developer app, granted products/scopes, new action consent; no parity promise | 1–2 weeks after approval; 4–8 h/month | $0 planned API access; any paid third-party bridge optional/user-funded |
| P10 Tutorials/demo/distribution + contributor loop | 5/4/2; 12, after release | Reproducible demo, three honest tutorials, submitted listings with receipt/status, weekly issue response, monthly measures below | Reviewed release and verified install URLs; ordered release/listing publication authorized after gates; no private outreach | 3–5 days initial; 2–3 h/week | $0 public docs/repository/local recording |
| P11 Local opt-in adoption and traffic ledger | 4/4/1; 11 | Counts/timings only, no identity/content; missing samples remain unknown; weekly traffic export and monthly report | Volunteers and owner-readable GitHub traffic; retention consent and aggregation rules | 1–2 days; 1 h/month | $0 local JSON/CSV + GitHub Insights |
| P12 Development advisory follow-up | 4/3/1; 10 | Reassess October 8; compatible clean-install upgrade with all gates or documented mitigation; no forced dependency-tree break | Existing three dev-tool findings; production currently zero; npm installer issue tracked in evidence | 0.5–1 day; weekly until resolved | $0 |

P2 precedes new provider routes because it builds repeat value from existing reads.
P7/P8 are parallel readiness gates before broad release promotion, irrespective of
numerical score. Scores do not override safety or required capture/access.
Choose each provider feature only after value feedback and capture evidence exist.

## Concrete execution sequence for Codex

1. Refresh PR #3, preserve `pr_diff.txt` and backup outside iCloud. Done: refreshed
   at `2562ff0`, corrected to `0017fe1`; no history rewrite/main push.
2. Keep the stack draft until the required final-head checks and separately
   consented validation pass. Then merge #3 → #4 → #5 with guarded head checks
   and retained ancestry; release authorization now permits this integration.
3. Implement setup in a separate branch/stacked draft PR. Run lint/typecheck/tests,
   metadata/build, generated-entry and packed checks; hosted twelve-job matrix.
4. Obtain native client UI evidence without requesting LinkedIn access. If a real
   first read is desired later, request new explicit consent; earlier read-only
   permission does not apply to further account requests.
5. Build P2 deterministic bounded briefs in its own PR after setup review. Use only
   existing reads, maximum budgets, source citation and partial-state handling;
   publish synthetic examples separately from authorized live samples.
6. Capture P3/P4 only after renewed consent; preserve redacted route provenance and
   schema fixtures; reject unknown endpoints and mark live status unproven until observed.
7. Follow [3.0.0 readiness](RELEASE_READINESS_3.0.0.md): publication is now
   explicitly authorized after validation/gates. Prepare and rehearse independently
   while account consent is pending; bump main once and use automated publishing.
   P8 remains a broad-promotion/privacy gate, not a completed feature. Do not
   promote Windows native privacy, erasure or a desktop first-read cohort without
   their required proof; retain the October8 development-advisory follow-up.
8. Run the distribution experiments below after reviewed release, preserve failures
   as well as successes, and choose the next backlog item from actual user failures.

## GitHub Trending daily distribution plan

A daily Trending appearance is observed at a dated URL, not delivered by code or
purchased promotion. Check [all-language daily](https://github.com/trending?since=daily)
and [TypeScript daily](https://github.com/trending/typescript?since=daily) separately;
record UTC observation time, scope, position or absent. Do not infer daily inclusion
from star velocity, a historical screenshot or another language/weekly view.
No bots, purchased stars, star exchanges, repeated spam or compulsory paid promotion.

**Release assets:** a 90-second terminal/video demo with exact published version,
Node/OS/client versions, offline setup, deliberate manual login, one bounded research
workflow, source-linked partial result and closure. Until a new live demo is approved,
use `npm run demo:offline` and `npm run verify:setup` prominently labeled synthetic/
offline. Record locally with free system tooling; use repository assets/GitHub Pages
if needed. Never include session cookies, private messages, tokens or personal data.
Quick start must distinguish source review from published package; provide stable
installation and regenerated client config instructions plus stop/recovery guidance.

**Problem-led tutorials after release:** (1) interview preparation from one company
and up to three source-linked profile/job reads; (2) compare ten jobs with explicit
filters/partial results and manual next page; (3) triage a bounded own conversation
page and draft locally without sending. Each includes exact tools/arguments, budgets,
sample synthetic output, freshness/limitations, tested version and troubleshooting.
Publish only features actually released; saved jobs/post search tutorials wait for
capture and live evidence. No account content is needed in public samples.

**Listings after release:** verify npm, official MCP registry and GitHub metadata
first; submit free repository listings to Glama, relevant maintained awesome-MCP
lists and other directories whose current criteria can be met for free. Check terms,
required fields and install URL at submission time; record URL/date/reviewer/status.
Paid expedited listings or hosting are optional and user-funded. Prepare useful
release notes and tutorial submissions for relevant communities under their rules;
repository/directory submissions are authorized in the current release task;
private outreach and account-content sharing remain separately authorized actions.

**Cadence:** launch week: one reproducible release demo + first tutorial, fix support
failures daily. Weeks 2–4: publish two more substantive tutorials based on observed
questions; upstream a verified client example or narrowly useful fix. Ongoing: daily
15-minute issue/compatibility triage during active launch, one meaningful weekly
improvement, and a weekly 20-minute traffic export. Avoid manufacturing daily posts.
Maintain a two-business-day first substantive contributor response target; label
reproduction status/area, link a minimal fixture, and provide a bounded good-first
issue. Celebrate merged useful fixes in the changelog; never reward inflated stars.

## Monthly measurement contract

Use local voluntary CSV/JSON and GitHub Insights/API exports, no hosted analytics
subscription. GitHub traffic is a rolling short window: export weekly rather than
trying to reconstruct an entire month at month end. Primary reference:
[GitHub traffic endpoints](https://docs.github.com/en/rest/metrics/traffic).
Publish aggregate counts only; keep volunteer records local under their retention
choice. No LinkedIn content, cookies, account IDs or stargazer identity collection.

| Measure | Definition / collection | Baseline and monthly decision |
| --- | --- | --- |
| First successful read | Consent-based timer from install start to first schema-valid read; report total attempts/successes/failure stage, median/p90, OS/build and partial count | One earlier maintainer existing-session read is documented, **not** a fresh-install cohort. No current cohort rate. Target ≥80% within15min only after ≥10 volunteers; fix highest failure stage before promotion |
| Repeat use | Voluntary count of testers with useful reads in at least2 distinct weeks within28days / eligible first-read testers | Unknown until longitudinal sample; report missing follow-ups separately. Prioritize P2/P3 if setup succeeds but return use is low |
| GitHub traffic | Weekly UTC views/clones totals and uniques plus referral/path exports; preserve daily records and deduplicate overlapping windows before monthly totals | Not collected here; unknown, not zero. Compare tutorial-linked referral changes with successful-read feedback |
| Net stars | Public repository star total at consistent UTC monthly boundaries; delta = end minus start | Observed10 on2026-10-01; new monthly samples required. Milestones100/1k/10k are experiment checkpoints, not deadlines or promises |
| Trending daily | Dated observation of all-language and TypeScript daily pages, inclusion/rank/absence recorded separately | Not verified here. Report observed days only; no guarantee or algorithm claim |
| Contributor loop | Substantive-response median/p90, issues reproduced/resolved, first contributions merged; distinguish bot replies | No measured baseline; review weekly and remove stale onboarding blockers |

Monthly report: time window/build cohort, above numerator/denominators and unknowns,
completed artifacts and referral sources, top three user failures, maintainer hours,
required cash actually spent ($0 planned), then one next experiment and stop rule.
If quality or first-read reliability drops, fix it before broad distribution.

## Evidence and remaining gaps

Safety correction head `0017fe1dd9de6cfb334b4eb6a77ddddcf19fbcfc` passes all12
[hosted checks](https://github.com/devag7/linkedin-mcp/actions/runs/36859609288)
on Linux/macOS/Windows Node20/22. Local safety run:470 tests/24 suites. Feature run:
474 tests/25 suites plus generated configuration, packed installation, lint,
typecheck, metadata and build pass. Detailed safety evidence is in
[review corrections](PR3_REVIEW_CORRECTIONS_2026-10-01.md); original
[execution evidence](ZERO_COST_EXECUTION_EVIDENCE_2026-10-01.md) remains historical.
The first feature matrix at `1bde68c` passed eleven jobs; Windows Node20 reported
474 passing assertions plus an unhandled Vitest progress-RPC timeout. Its synchronous
budget suite took69s. The test worker now yields between durable filesystem cases,
allowing pending acknowledgements to run without mocking storage, dropping assertions
or extending timeouts. This is an event-loop starvation diagnosis from logs and runner
source, not a proven provider failure. The corrected feature code head `a3b40506ff210400938121957200550451201ac2`
passes all twelve hosted source/packed jobs, including Windows Node20, in
[run36861794662](https://github.com/devag7/linkedin-mcp/actions/runs/36861794662).
No assertions, durable filesystem checks or timeout limits were removed.
Failure logs and native VS Code discovery evidence are
in `docs/evidence/first-run-2026-10-01/`.

These checks prove local policy/contract/process behavior and cross-platform packed
execution. They do not prove current LinkedIn endpoint compatibility, native client
UI first use, release availability, adoption or Trending. No new LinkedIn request,
merge, version bump or publication occurred. Windows fixture junction checks pass
on hosted Windows; NTFS ACL proof and complete erasure remain open.

Original-roadmap coverage: Phase0 corrections now include preview issuance/alias
safety; Phase1 setup gains configuration and exact next steps; Phase2 contracts and
existing schemas remain; Phase3 first new-provider features await captures and the first job brief is implemented in a separate draft, with broader briefs and live validation still open; Phase4 official pilot remains unavailable; Phase5
distribution is a measured, release-gated plan. See
[coverage](ROADMAP_COVERAGE.md) for the earlier item-by-item inventory. Do not mark
all phases complete because source/CI pass.

Next milestone: independent review of three draft tracks and the new archive/setup/brief boundaries, remaining Claude/Cursor native-client acceptance without LinkedIn access, then a newly consented job-brief read before any live claim. Broader profile/company briefs need a separate request-budget design. Live first-read validation requires renewed consent.

Additional baseline: a repository-wide Prettier check reports nine unchanged legacy
files (auth, client, circuit breaker and capture/endpoint utilities). Changed source
files are formatted; lint passes. Unrelated formatting was preserved, not silently
folded into these review tracks.

## P2 TRD and acceptance update — bounded job research

Implemented `research_jobs` in its own draft track stacked on PR #4. Value: one
client call produces a job comparison and source-linked requirements for the first
listing, with explicit unknowns and manual next steps. Scope deliberately uses
existing search_jobs/get_job_details; six-section profile reads cannot satisfy the
three-read ceiling. No rotating route or new provider mapping was invented.

Acceptance: first page only; count1–10/default5; optional numeric existing geo ID;
optional first-job detail/defaulttrue; max2 tool calls, max3 explicit Voyager GET
attempts including identity, max10 deduplicated linked jobs. Async request-local
bounds survive queue scheduling and stop before a fourth read. Browser navigation
and asset traffic are outside this explicit API counter, not claimed bounded.
Every fact has exact canonical job URL, source tool, observation timestamp and
truncation flag. Unknowns, missing links, mismatched detail identity, conflicting
titles, partial page metadata and read errors are visible. No inferred salary,
fit, availability, automatic paging/retry/storage or writes. Markdown escapes
untrusted source text; JSON retains query/provenance/status and recovery guidance.
The client still controls its own storage/model behavior.

Dependencies: existing MCP SDK, Zod, Guard and Voyager; no new dependency or paid
backend. Required cash $0; model-assisted interpretation is optional/user-funded.
Maintenance estimate2–4h/month to review existing read schemas and client cases.
Rollback: remove only research registration/catalog/schema/demo; preserve existing
reads and safety history. Expanding to company/profile/saved-job scopes needs a
separate reviewed bound and endpoint evidence.

Proof: synthetic real-SDK/registered-handler/Voyager tests; installed stdio stopped
profile check; reproducible `npm run demo:brief`. No current LinkedIn compatibility
is claimed. Packaging now excludes preserved sync copies via exact reviewed paths
and validates every archive byte; broken setup aliases return actionable offline
JSON with no commands. See [follow-up evidence](REVIEW_AND_BRIEF_EVIDENCE_2026-10-01.md).
The10,000-star and daily Trending experiments, quality gates, monthly measurement
contract and zero-mandatory-cash rules above remain unchanged.

Review/implementation milestones on October1: current PR #3 head62fcda8 and
PR #4 head3189e6f each pass all12 hosted gates after exact inventory, normal-pack
JSON and invalid-setup-path fixes. [Draft PR #5](https://github.com/devag7/linkedin-mcp/pull/5)
contains the first bounded job brief,496 local tests and clean/dirty15-file archive
proof. Independent review and new consented live validation remain required before
release/adoption claims. Original MD and57 sync copies remain preserved.

The brief implementation at66a5c89 passes all12 hosted source/packed/offline
Chrome checks in [run36877160263](https://github.com/devag7/linkedin-mcp/actions/runs/36877160263).
Final document-head results are linked on draft PR #5 and backed up. This closes
the implementation/fixture/platform milestone, not current provider, first-read
cohort, repeat-use, release or distribution outcome gates.

## Independent review follow-up — October 1

The requested PR #5 empty-page status mismatch is fixed and asserted through the
SDK in both fields; 497 local tests/27 suites and source/package gates pass.
The historical [three-PR review](THREE_PR_RELEASE_REVIEW_2026-10-01.md) identified
two shared P2 correctness blockers. The subsequent shared-source remediation
fixes both and adds23 SDK cases; neither finding remains open in the reviewed
resulting source. PR #5 adds separate brief-defense/partial SDK coverage. Exact
resulting-head gates remain required, without live claims from fixtures.

| Order | Proposal and acceptance | Dependencies | Effort / maintenance | Required cash |
| --- | --- | --- | --- | --- |
| Before release, R1 | Validate paging total against observed rows; contradictory zero/short pages cannot certify empty or complete. Real SDK tests retain true empty/final-page behavior and no implicit follow-up. | Shared pageResult/registered reads; existing synthetic SDK fixtures; propagate to both stacked feature drafts | 0.5–1 day; included in read-schema maintenance, about 1 h/month | $0 |
| Before release, R2 | Verify get_job_details identity equals requested ID before assigning its source URL; mismatch is a typed error, no retry. Test both supported URN forms and preserve useful partial briefs. | Existing shaper/contract and brief identity defense; stacked draft propagation | 0.5 day; included in existing read-schema maintenance, about 1 h/month | $0 |
| After correctness gates | One freshly consented read-only job brief under the [concrete protocol](LIVE_JOB_BRIEF_VALIDATION_PROTOCOL.md); record exact build, bounds, provenance checks, partial codes and verified cleanup | R1/R2 fixes, resulting-head local/hosted gates, fresh human consent, existing authenticated profile | 0.5 day per initial observed environment; later repeat-use cohorts tracked separately | $0 with existing local prerequisites |

R1/R2 implementation and shared acceptance are complete in PR #3 commit5e6f25b,
carried into PR #4 at1ee61b6 and PR #5 at888d001 with origin trailers. PR #3/#4
pass499/504 local tests, source/package gates and12 current-head hosted jobs
each. PR #5's independent brief identity check remains intact;524 local tests and
source/package/installed client gates pass. Its final hosted results are recorded
on the draft after the track-specific test follow-up.
This closes the two code findings, not current provider compatibility or release.

No further account request has been made. Keep all three drafts; do not merge,
bump or publish. Native client chat/live compatibility, full erasure, NTFS ACLs
and optional official integration remain open. The zero-mandatory-cash constraint
does not relax the acceptance criteria or convenience work. The10,000-star and
GitHub Trending daily goals remain measured distribution outcomes, not claims.

## 3.0.0 integration and readiness update

The maintainer now authorizes stack merges and automated publication after the
existing gates and separately consented bounded job-brief validation pass. Earlier
no-merge/no-publication restrictions are superseded; earlier account consent is not
reused. See [readiness and migration](RELEASE_READINESS_3.0.0.md).

Closed preparation requirements: justified major-version decision, exact upgrade
steps with state/replay preservation, final-diff safety/contract review, issued-proof
write guidance, truthful platform/client/provider scope, concise release notes and
a reproducible synthetic demo. Workflow corrections enable a SHA-pinned dry run,
fix resume tags and require independently public scoped metadata. New resulting
source/package/hosted proof and the dry-run result are recorded in readiness.

Required remaining release actions: resolve the failed useful-brief validation and obtain a separately authorized useful bounded read;
actual npm OIDC publication (trusted-publisher setup is confirmed); ordered guarded merges; one main version
bump/metadata sync; all four independent destination checks. No release is complete
until the actual destinations match the intended artifact/source. Public directory
updates have a separate [submission ledger](DISTRIBUTION_SUBMISSIONS_2026-10-01.md).

P7/P8, optional official OAuth, new provider routes, development advisory reassessment
and adoption measures remain open. Their acceptance criteria, quality expectations
and $0 required-cash estimates are unchanged. Do not close those requirements on
fixture evidence, launch dates or distribution activity. Broad promotion requires
the existing first-use/privacy gates; the 10,000-star/daily-Trending ambitions remain
measured experiments, with missing samples explicitly unknown.

## Bounded live evidence and next gate — October2, 2026

Fresh explicit consent was used exactly once under the job-brief protocol. SDK
stdio on the frozen5ef228a build returned partial3 entities/3 facts, with first
job detail stopped as PROVIDER_ERROR. Reported3 explicit Voyager attempts/2
underlying tools;0 retries/writes.62 validation checks and shutdown passed;0
useful entities under the runner's title-plus-another-observation criterion.
[Execution record](LIVE_JOB_BRIEF_VALIDATION_PROTOCOL.md#consented-execution-record--october2-2026).

The useful-brief release gate remains open. Do not relabel this as healthy provider
compatibility or proceed to ordered merge/version/publication. Review existing
normalization and typed error handling offline first; observed counts/code do not
identify a rotating endpoint, permissions or nested error cause. New live
provider-shape diagnosis requires a separately bounded protocol and renewed
consent; do not retry or weaken validators. Maintenance estimate0.5–1 day initial
triage, about1 h/month in existing read-schema maintenance; required cash$0.
Native client/cohort, erasure/Windows privacy and broader read coverage remain
separate open proposals.10,000 stars and daily Trending remain measured ambitions.
