# LinkedIn MCP: current gaps and zero-cash execution roadmap

Updated October 7, 2026. This is the actionable PRD/TRD and product backlog for
`devag7/linkedin-mcp`. Preserve the original
[2026 roadmap](../PRODUCT_TECHNICAL_ROADMAP_2026.md) and its historical findings;
this document adds current evidence rather than rewriting that baseline.

## Current execution order — October 7

Core **3.0.0 is released**, 22 tools; [all four destination receipts](LAUNCH_EVIDENCE_2026-10-07.md)
verify source/tag `2992258` and the immutable approved artifact. The GitHub README
and setup demonstration can now describe the published version. Old dated
publication-pending entries below are historical, superseded by those receipts.
PR #5 remains draft; its brief is not a core capability.

1. **Launch correction:** published, pinned quick start; real published-package
   synthetic setup demo; Glama description/source refresh and accurate existing
   curated-list submission. Acceptance: no pending-release or job-brief claims in
   current launch copy; exact URLs and platform-generated limitations recorded.
   Dependencies: verified release. Effort: small ongoing documentation upkeep. Cash: $0.
2. **First use:** consenting volunteer cohorts in Claude Desktop, Cursor and VS Code
   using published 3.0.0 and [the protocol](FIRST_USE_VALIDATION.md). All three cohorts
   currently have zero measured attempts. Acceptance: publish denominators, timing,
   failure categories, cleanup and optional repeat-use response counts; count each
   person's first started attempt once across clients and report later trials separately; measure the
   80% within 15 minutes target without substituting fixtures. Dependencies: participant
   consent and installed clients/accounts. Effort: medium observation/support. Cash: $0
   mandatory; any existing client/model subscription is optional and user-funded.
   Consent covers tool invocations and implicit reads, with no unenforced numeric
   HTTP cap promised. Useful partial profiles qualify only under the results guide's
   explicit fields/provenance/freshness/status conditions. The [published-package readiness check](FIRST_USE_READINESS_2026-10-07.md),
   [volunteer consent kit](FIRST_USE_VOLUNTEER_KIT.md) and
   [private results/scoring template](FIRST_USE_RESULTS.md) are prepared. All three
   exports pass published SDK flows; native1.140.0 VS Code startup has a session-runtime
   prerequisite, Claude import remains untested and Cursor is absent on this Mac.
   These engineering checks do not enter the cohort denominator. No runtime defect
   reproduced; any later code repair must use a version after3.0.0.
3. **Trust/privacy:** coordinated erasure must account for profile, circuit, owner
   locks and shared budget/journal state without resetting another active identity's
   limits. Native Windows NTFS ACL proof must verify another user cannot read state;
   mode-bit fixtures are insufficient. Acceptance: destructive scope preview, active
   ownership refusal, safe alias handling, interruption/restart tests and native ACL
   receipts before completion claims. Dependencies: separate reviewed implementation,
   disposable data and consenting Windows environment. Effort: medium/high initial,
   recurring platform regression. Cash: $0 mandatory. One low development-only esbuild
   finding remains; recheck supported build-tool updates on **October 8** and document
   build exposure, not merely the audit exit code.
4. **Earn 3.1:** diagnose PR #5's partial result offline against redacted shape/status
   evidence first. Keep three explicit reads maximum, identity checks, source links,
   freshness and partial-result semantics. Acceptance: a separately consented bounded
   check produces a useful brief before merge/release; no new account access is
   authorized by this plan. Saved jobs and richer filters require separate verified
   provider evidence. Dependencies: PR review, useful live result and fresh consent.
   Effort: medium implementation, high endpoint maintenance uncertainty. Cash: $0
   mandatory; any official paid provider is optional and user-funded.

Weekly capture GitHub stars/traffic windows and voluntary first-use/reuse aggregates;
monthly compare net stars, first-successful-read and repeat-use measures. GitHub API
still reports **10 stars** on October 7. Record Trending only if actually observed.
Contributor loop: acknowledge reproducible issues within two working days, collect
redacted diagnostics, link fixes and close with verification. Tutorials and broader
promotion follow actual first-use/privacy evidence. No paid placement, hosting or
new domain is required. These ordered milestones retain the PRD/TRD and full backlog
below; they do not declare the original roadmap complete.

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
| P2 Bounded source-linked research briefs | 5/4/2; 12 | One requested topic, maximum 3 provider requests/10 entities; source URL + fetchedAt per claim; explicit partial/unknown; no inference presented as source fact; deterministic export Markdown/JSON | Existing verified read primitives, schema/source review; consented end-to-end read required before live claim | 3–5 days; 2–4 h/month | $0 deterministic assembly; optional user-funded model summarization |
| P3 Saved jobs | 5/2/3; 9 | Own saved jobs only, max25/request and max2 explicit pages; preserved source IDs/URLs, empty/changed-shape distinguished | Consented read capture of actual provider/UI route; no authorization currently. Competitor DOM implementation is feasibility evidence only | 3–6 days after capture; 3–6 h/month | $0 |
| P4 Richer job filters | 4/3/3; 8 | Date/work type/employment/experience/sort supported only for verified mappings; unsupported combinations rejected; tests prove query and cursor binding | Capture/inspect each query parameter under new consent; locale fixtures and documented defaults | 2–4 days; 2–4 h/month | $0 |
| P5 Conversation keyword search | 4/2/4; 6 | Own inbox only, explicit max2 pages/25 matches; no entire-inbox scan; source thread links where verified; completeness partial | Verify endpoint or implement bounded filtering over existing read results with clearly local semantics; sensitive-content retention review | 3–5 days; 3–6 h/month | $0 |
| P6 Post search | 3/2/4; 4 | Verified route/filter only, max25/request, schema/source link and changed-shape tests | Consented capture; locale and query-ID drift evidence. Do not copy rotating IDs from another repo | 3–6 days; 4–8 h/month | $0 |
| P7 Desktop client first-use matrix + packaging convenience | 5/3/2; 11, gated by access | Record app/OS/version/build, native config acceptance and cold setup; at least one authorized real first read per claimed pairing | Installed clients and renewed user consent; Windows/Linux volunteer machines; signed bundles only when feasible | 2–4 days + volunteers; 2 h/month | $0 with volunteer devices; code signing optional and outside required scope |
| P8 Data inventory/erasure + Windows ACLs | 4/3/3; 8 | Inventory first; safe alias refusal; account/session cleanup after all owners stop; journal removal explicit and documented as safety-history loss; NTFS deny-other-user proof | Review privacy/state migration; fixture+Windows tests; no silent budget reset while runnable profile remains | 4–7 days; 2–4 h/month | $0 |
| P9 Official identity/publishing provider pilot | 3/2/3; 5 | Actual OAuth scopes control discovery; unsupported browser reads never silently fall back; one approved identity/publish test per exposed action | Developer app, granted products/scopes, new action consent; no parity promise | 1–2 weeks after approval; 4–8 h/month | $0 planned API access; any paid third-party bridge optional/user-funded |
| P10 Tutorials/demo/distribution + contributor loop | 5/4/2; 12, after release | Reproducible demo, three honest tutorials, submitted listings with receipt/status, weekly issue response, monthly measures below | Published3.0.0 verified; existing accurate listings advance to review; broader promotion awaits P7/P8 | 3–5 days initial; 2–3 h/week | $0 public docs/repository/local recording |
| P11 Local opt-in adoption and traffic ledger | 4/4/1; 11 | Counts/timings only, no identity/content; missing samples remain unknown; weekly traffic export and monthly report | Volunteers and owner-readable GitHub traffic; retention consent and aggregation rules | 1–2 days; 1 h/month | $0 local JSON/CSV + GitHub Insights |
| P12 Development advisory follow-up | 4/3/1; 10 | Reassess October 8; compatible clean-install upgrade with all gates or documented mitigation; no forced dependency-tree break | One low development-only esbuild finding; production/publisher/consumer zero; latest tsup8.5.1 still requires ^0.27.0 | 0.5–1 day; weekly until resolved | $0 |

P2 precedes new provider routes because it builds repeat value from existing reads.
P7/P8 are parallel readiness gates before broad release promotion, irrespective of
numerical score. Scores do not override safety or required capture/access.
Choose each provider feature only after value feedback and capture evidence exist.

## Historical initial execution sequence (superseded)

Retained for traceability; use the October 7 execution order above. PRs #3/#4
are merged, core 3.0.0 is released and PR #5 remains draft.

1. Refresh PR #3, preserve `pr_diff.txt` and backup outside iCloud. Done: refreshed
   at `2562ff0`, corrected to `0017fe1`; no history rewrite/main push.
2. Keep PR #3 draft. Review alias deletion, token/journal migration and release
   identity boundaries before merge consideration. Record hosted source SHA.
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
7. Complete P8 and advisory reassessment; follow release gates only under later
   publication authorization. Current task prohibits merge/version bump/release.
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
posting/messages to people require explicit authorization and are not executed here.

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
| First successful read | Consent-based timer from prerequisite/install start to first useful verified read; one first attempt per person across clients, failures retained; later-client trials separate; report denominators/failure stage, median/p90, OS/build and useful-partial count | One earlier maintainer existing-session read is documented, **not** a fresh-install cohort. No current cohort rate. Target ≥80% within15min only after ≥10 volunteers; fix highest failure stage before promotion |
| Repeat use | Voluntary count of testers with useful reads in at least2 distinct weeks within28days / eligible first-read testers | Unknown until longitudinal sample; report missing follow-ups separately. Prioritize P2/P3 if setup succeeds but return use is low |
| GitHub traffic | Weekly UTC views/clones totals and uniques plus referral/path exports; preserve daily records and deduplicate overlapping windows before monthly totals | Not collected here; unknown, not zero. Compare tutorial-linked referral changes with successful-read feedback |
| Net stars | Public repository star total at consistent UTC monthly boundaries; delta = end minus start | Observed10 on2026-10-01; new monthly samples required. Milestones100/1k/10k are experiment checkpoints, not deadlines or promises |
| Trending daily | Dated observation of all-language and TypeScript daily pages, inclusion/rank/absence recorded separately | Not verified here. Report observed days only; no guarantee or algorithm claim |
| Contributor loop | Substantive-response median/p90, issues reproduced/resolved, first contributions merged; distinguish bot replies | No measured baseline; review weekly and remove stale onboarding blockers |

Monthly report: time window/build cohort, above numerator/denominators and unknowns,
completed artifacts and referral sources, top three user failures, maintainer hours,
required cash actually spent ($0 planned), then one next experiment and stop rule.
If quality or first-read reliability drops, fix it before broad distribution.

## Historical source and first-feature evidence — October1

This checkpoint describes the earlier draft state. The current core execution
receipt below supersedes its merge, version and publication status.

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
existing schemas remain; Phase3 first new-provider features await captures and briefs
await a separate implementation; Phase4 official pilot remains unavailable; Phase5
distribution is a measured, release-gated plan. See
[coverage](ROADMAP_COVERAGE.md) for the earlier item-by-item inventory. Do not mark
all phases complete because source/CI pass.

At that checkpoint the next milestone was human review of the two draft tracks, remaining Claude/Cursor native-client acceptance
without LinkedIn access, then P2 bounded source-linked brief implementation under the
same endpoint and privacy limits. Live first-read validation requires renewed consent.

Additional baseline: a repository-wide Prettier check reports nine unchanged legacy
files (auth, client, circuit breaker and capture/endpoint utilities). Changed source
files are formatted; lint passes. Unrelated formatting was preserved, not silently
folded into these review tracks.


## Core-first3.0.0 decision — October2, 2026

The maintainer authorizes PR #3 → #4 integration and automated core3.0.0 publication
once its fresh22-tool source/package/hosted/dry-run gates pass. Keep PR #5 draft;
its partial live check (3 entities/3 facts, first detail PROVIDER_ERROR, useful gate
failed) is separate offline-first investigation. No new account request is allowed.
No research tool/demo/release claim ships in3.0.0. The old23-tool dry run is not a
core-artifact gate. [Core release evidence](RELEASE_READINESS_3.0.0.md) and
[directory ledger](DISTRIBUTION_SUBMISSIONS_2026-10-02.md) govern current execution.

P7 first-use/native client and P8 erasure/Windows privacy remain open; do not use
release or offline fixture success to close them or for broad promotion. Existing
maintenance/cash estimates and ambition remain; no mandatory service/expense is
introduced. Any further provider diagnosis requires reviewed bounded instrumentation
and fresh consent. Current counts/error code cannot identify a rotating endpoint
or permission/normalization cause, so no speculative production fix is made.

## PR #5 follow-up candidate — October2, 2026

PR #5 remains draft. The isolated3.1.0 candidate integrates the core safety/setup
merge tree, keeps23 tools and preserves its additive bounded research_jobs contract.
Its first page permits at most3 explicit Voyager attempts including identity,
2 underlying tools and10 entities; no retries, pagination or inferred fit.
The original live run returned3 titles only and failed usefulness. A separately
consented shape-only diagnosis on0200276 observed detail data alongside provider
errors; strict rejection remains intact. Search card generic text is not mapped
to employer/location without semantic evidence. The diagnostic consent is consumed.

Offline SDK regressions remove arbitrary unrelated-company attribution and fix
the source diagnostic's serialized JSON comparison. They do not establish current
provider compatibility. See [redacted result and protocol](JOB_BRIEF_SHAPE_CAPTURE_PROTOCOL_2026-10-02.md).
The useful-brief gate, exact resulting-head local/package/hosted/dry-run gates and
all four publication destinations must pass before feature release. Core must
finish first. Native first-use/repeat cohorts, erasure/Windows privacy and broad
promotion remain open; mandatory maintainer cash stays$0.


## Core execution and next milestone — October2

This section is the October2 snapshot. The October5 authentication receipt below
supersedes its next milestone; source/package scope and open P7/P8 gates persist.

PR #3 then #4 are merged. Frozen main release source is
`a9f785b7131eb4ada24791e5ea3fa01e6f104906`;3.0.0 remains absent from the four
target destinations. The22-tool/15-file candidate passes524 local tests, all12
hosted main checks and all10 exact release dry-run jobs. Dirty/clean workspaces
produce identical archives. All57 sync copies, `pr_diff.txt` and backups remain
unchanged. [Current receipts and npm blocker](RELEASE_READINESS_3.0.0.md) distinguish
passed offline core gates from failed authenticated publication.

Publisher maintenance: isolated npm12.2.0 with three locked upstream bundle
patches; actual installed audit0, application production audit0. Only publication
uses that CLI, preserving the package-report contract. Dependencies: supported
hosted Node, public npm/GitHub infrastructure and working owner-managed trust
binding. Estimated maintenance is about1h/month to review pins, plus an audit
each release; remove patches once upstream incorporates them. Required cash$0.
No quality gate, application feature or safety/privacy requirement was reduced.

Next concrete milestone is owner verification/reset of the npm binding, followed
by automated recovery of the exact candidate and independent four-destination
verification. Merge/publication authority is already granted. Evidence snapshots
stay separate from frozen main until recovery completes. Glama source is refreshed
to that commit; description honestly says publication pending. The corrected
punkpeye submission remains draft, with22-tool local stdio and no brief capability.

PR #5 remains draft. Its earlier partial result proves bounded provenance/cleanup,
not useful job-brief compatibility. Counts/error code alone cannot identify a
route, permission or normalization cause. The separate offline investigation and
any independently consented diagnosis are not core3.0.0 evidence. No further
account access occurred in this core-release work.

Measurement refresh: GitHub reports10 stars on October2. Traffic exports retrieved
on October2 contain September17–30 UTC rows:58 views/26 reported uniques and128
clones/72 reported uniques. This lagged14-day window is not a monthly total,
distinct humans, successful reads or an attribution result. Weekly dated exports
and overlap deduplication remain required. First-use/repeat-use cohorts remain
unknown; no Trending result is claimed. P7/P8 promotion limits and the10,000-star
and daily-Trending measured ambitions remain.

## Authentication recovery milestone — October5

An explicitly authorized token-mode run36999000357 at frozen main `a9f785b`
passed all six platform/Node compatibility jobs and the release source/package
gates, then failed the npm publish request with401/`EOTP`. The signed provenance
statement is not package publication. All four3.0.0 targets remain absent in
independent read-back. Source, version,22-tool scope and15-file candidate stay
frozen. PR #5 remains draft, with no new LinkedIn request.

The supplied screenshot shows saved workflow filename `release.yml,ci.yml`,
which does not equal `release.yml`; trusted publishing is not verified. The owner
now requests token-only authentication. Dependency: privately replace the Actions
secret with a short-lived, package-scoped publish token usable without interactive
2FA under the existing npm package policy. Do not relax2FA, put credentials in
documentation or retry the failed token unchanged. If policy disallows tokens,
an owner authentication-path decision is required. Required cash$0; owner setup
plus one existing automated run, with no feature or gate reduction. Maintenance:
revoke exposed credentials, rotate/expire limited tokens and eventually repair
the workflow binding for token-free publishing when authorized.

Next concrete milestone: owner confirms private secret replacement, existing
workflow resumes at exact frozen source, and every destination's actual bytes,
integrity, provenance, public visibility, Registry status and tag/SHA is verified.
Do not mark release/distribution complete until then. See the
[exact authentication and destination evidence](RELEASE_READINESS_3.0.0.md#token-mode-recovery-and-read-back--october5-2026).


## Final core source and authentication dependency — October5

The owner replaced the encrypted publication secret. A newly disclosed private
publisher cache vulnerability blocked the first retry before authentication.
Reviewed PR #6 resolves that blocker with locked upstream bytes plus a tested,
explicitly maintained cache guard; the upstream4.3.0 version alone is not called
fixed. Required cash$0; maintenance about2h/month plus per-release real behavioral
assertions/audit. No application dependency or shipped file changed.

Final source `5640dfaa6a05533143f3130b0663806378ac0afa` has531 passing local tests,
12/12 main checks and the reviewed-tree10/10 release dry run. The22-tool,15-file
archive remains byte-identical. Actual automated run37308641551 then used the
replacement token and failed with `EOTP`; all four3.0.0 destinations remain absent.
Secret replacement does not prove Bypass2FA/permissions or selected package policy.
Owner-only configuration evidence is the remaining authentication dependency;
do not disable2FA, retry unchanged credentials, switch auth paths without owner
instruction, or publish manually alongside automation.

Next concrete milestone: check owner publishing policy/token configuration,
resolve the evidenced cause, then resume at frozen `5640dfa` and verify all four
artifacts/provenance independently. Evidence is on a separate branch; PR #5
remains draft. No new LinkedIn request, first-use/erasure/Windows-privacy completion,
paid service or Trending result follows. All60 protected original/backup hashes
match. [Final gate receipt](RELEASE_READINESS_3.0.0.md#replacement-token-result-and-final-source--october5-2026)
records exact runs and what they establish.


## October6 gate refresh

OIDC recovery supersedes the token path; corrected owner connection-save
confirmation remains pending. `NPM_PUBLISH_AUTH=oidc` is verified. Frozen source
`5640dfa`,22 tools and15-file bytes remain unchanged;531 tests, source/build,
installed package/setup and offline demo pass again. No LinkedIn request.

Fresh production audit now reports critical proxy-addr2.0.7; full audit also
reports critical tinypool/Vitest and high source-map-js, six findings in total.
Earlier zero-production/no-high reports are dated historical results. Required
release gates therefore fail independently of authentication. Preserve frozen
main, logs and original/backup copies. Do not publish or lower gates. A separate
reviewed dependency repair and approved replacement candidate would require
compatibility checks, package/hosted checks and exact release dry run; cash$0,
maintenance effort to be estimated from the actual dependency/test-runner diff.
[Exact dependency and preflight evidence](RELEASE_READINESS_3.0.0.md#oidc-preparation-and-fresh-audit-blocker--october6-2026).


## Reviewed core dependency repair — October6

PR #7 is merged at new intended release SHA `efd3b53ffd8416c68ef703069d883ee1371cb533`
after reviewed-head12/12 CI and10/10 dry run. New22-tool/15-file tarball SHA256
`585ab2be9e3b20c4b872d424a622fac2ea81b752d6c4955d66e0ee086365c551`; only shipped
package.json changes, with all other14 shipped bytes identical to original frozen
candidate. Original candidate/evidence and60 preservation hashes remain intact.

All six application findings are traced; supported Vitest4 removes Tinypool,
patched mocker and leaf source-map-js/proxy-addr updates resolve five package-level
entries. Fresh consumer actual installed proxy-addr and lock both read2.0.8;
consumer production audit0, SDK22-tool/configuration flow pass. Application and
actual publisher production audits0. A current publisher selector-parser moderate
finding was patched through the existing locked bundle mechanism. One low tsup/
esbuild Windows development-server finding remains with explicit build exposure,
upstream supported-range constraint and October8 follow-up. No override, forced
fix or audit suppression;531 unchanged tests pass. Required cash$0; maintenance
runtime/build1h/month plus existing publisher2h/month and per-release audits.

Publication stays paused: release workflow disabled before merge; corrected npm
`release.yml`-only saved-connection confirmation pending; main CI37462546965 passes12/12 at the new SHA.
OIDC-only authorization supersedes token recovery. Restore/dispatch only after
confirmation and remaining actual gates; independently verify all four targets.
PR #5 remains draft, P7/P8 and monthly cohort/growth measures remain open, and no
LinkedIn requests, live compatibility or Trending result is claimed.
[Exact new candidate and gate evidence](RELEASE_READINESS_3.0.0.md#reviewed-dependency-repair-and-new-candidate--october6-2026).


## SDK repair and interrupted release — October7

SDK repair PR #8 merged; new frozenmain299225871a3ff925984ca658974f334e90103c57,
archivec79f78e5e77814febb3f68ab9a391ef860515bcfd2d6f97001eadd6e00f58fe5.
SDK floor^1.31.0, locked1.31.0;531 unchanged tests, PR/main CI12/12 and dry run10/10
pass. Production/publisher/fresh-consumer audits0; installed consumerSDK1.32.1
and proxy-addr2.0.8. One low dev-only esbuild finding remains explicit with
October8 follow-up. Existing candidates,57 copies/pr_diff/backups preserved.

Saved release.yml-only binding confirmed. Single productionrun37575316004
succeeds at OIDC exchange201 and upload202 Accepted, then fails strict npm
verification PACKAGE_NOT_VISIBLE. Workflow disabled again; no retry/fallback.
Independent read-back still shows npm latest2.0.3/target404, public GitHub
Packages2.0.3, Registry/Release target404, no tag. Do not advertise public3.0.0
or verified provenance from a signing log. Glama/directory entries retain22
local-stdio tools and no job briefs; final release links await verified targets.

Next: verify public npm's exact artifact/provenance when visible, then resume
existing workflow at frozenmain for missing destinations. Cash$0; no LinkedIn
requests; PR #5 draft; first-use/erasure/Windows privacy still open;10,000 stars
and Trending remain measured outcomes.
[Exact gates and failed step](RELEASE_READINESS_3.0.0.md#sdk-repair-new-release-source-and-stopped-publication--october7).

Subsequent check: npm3.0.0 metadata is visible with expected integrity, but the
archive URL still returns404. Exact public artifact/provenance/consumer install
remain unverified; no directory is marked as fully released. The digest failure
was a21-byte404 JSON body, not an obtained tarball. Publication stays stopped.


## Current core and draft feature status — October 8

Core 3.0.0 is released with 22 tools; the publication-pending snapshots above
are historical. [Launch evidence](LAUNCH_EVIDENCE_2026-10-07.md) records the four
verified destinations. First-use cohort remains zero attempts; the merged protocol
requires separate anonymous-tally consent before study start, offers optional
private-row recording, and counts one first attempt per eligible person.
80% within 15 minutes, repeat-use adoption, 10,000 stars and daily Trending remain
unmeasured goals, never guaranteed results.

PR #5 remains draft. Its dependencies and publisher/CI gates now match reviewed
core; synthetic title-only partial responses correctly have zero useful entities.
The previous live check failed usefulness, and retained counts cannot diagnose
its underlying provider cause. REST-primary is provisional, not live proof.
Exact-head hosted checks, a release dry run and a newly consented useful brief
are required before feature merge/release. No account request or recruitment
was made here; required maintainer cash $0. Erasure and native Windows privacy
proof remain open. See [candidate readiness](RELEASE_READINESS_3.1.0.md).

## Current core adoption and audit status — October 8

Core 3.0.0 is released with 22 tools; the publication-pending snapshots above
are historical. [Launch evidence](LAUNCH_EVIDENCE_2026-10-07.md) records the four
verified destinations. PR #11 is merged after independent review. The published
artifact and v3.0.0 tag are unchanged. [October 8 follow-up](OFFLINE_FOLLOWUP_2026-10-08.md)
records the exact gates, client access limits, completed scheduled audit and owner
pilot checklist. First-use cohort remains zero; 80% within 15 minutes is unmeasured.
The full source audit retains one low development-only esbuild finding, with no
compatible parent upgrade currently available; production audit remains zero.

PR #5 remains a separate draft. Dependency refresh and offline partial-result
regressions do not satisfy its freshly consented useful-brief requirement.
Coordinated erasure, native Windows privacy proof and current native client
first-read/repeat-use evidence remain open. Required maintainer cash $0;
10,000 stars and daily Trending remain measured ambitions, not promised outcomes.
