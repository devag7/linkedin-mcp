# Full-scope completion audit — October 21, 2026

**October 26 delta:** core [4.1.2 is published and independently verified](RELEASE_EVIDENCE_4.1.2.md).
The local Claude plugin package is implemented and its distribution checks are
tracked separately; native and directory acceptance remain open. The tables
below preserve the October 21 snapshot. Use the [current completion index](CURRENT_COMPLETION_STATUS_2026-10-18.md)
for current security, wrapper and pilot state. The full roadmap is still incomplete.

**The complete plan is not finished.** Public 4.1.0 delivers the 24-tool core,
offline client setup, selected-profile retirement and two local job-seeker
helpers. The 4.1.1 security patch is independently verified on npm and GitHub Packages,
with SDK 1.32.1 and an input guard. MCP Registry metadata and the finalized
GitHub Release/tag are also verified; see [current receipts](RELEASE_EVIDENCE_4.1.1.md).
The original roadmap and historical failed receipts remain unchanged.

This audit compares the immutable
[original roadmap](../PRODUCT_TECHNICAL_ROADMAP_2026.md), the
[P0–P12 execution backlog](PRODUCT_EXECUTION_PLAN_2026.md) and the later
[job-seeker/Claude plan](JOB_SEEKER_AND_CLAUDE_DISTRIBUTION_2026-10-16.md).
There is no defensible overall completion percentage: future hypotheses,
source features, native tests and adoption outcomes have different finish lines.

## Original functional requirements

| ID | Current result | Remaining acceptance |
| --- | --- | --- |
| P-01 Diagnosis | Shipped offline doctor/setup; live diagnosis remains explicit. | Real first use across claimed clients/OSes; preserve unknown account state until authorized reads. |
| P-02 Capability inventory | Shipped route, permission, result limit and verification metadata through cold `whoami`; browser availability stays unknown. | Public 4.1.1 refreshes the recorded offline-check date, including tools added after October 1. No new live-check claim. |
| P-03 Structured responses | Shipped typed envelopes, text/structured output and partial/error contracts. | Current live shape coverage and failure-rate measurements for each advertised provider operation. |
| P-04 Bounded search | Existing people/jobs/company/feed reads are bounded; cursors require matching paging evidence. | New saved-job/filter/post/inbox search features below; no implicit full crawl. |
| P-05 Reviewed writes | Shipped opt-in, preview proof, durable operation IDs, caps and unknown-outcome handling. | Current consented live evidence for each claimed action; new-thread messaging remains experimental. |
| P-06 Stop signal | Shipped persisted checkpoint/circuit handling and restart fixtures. | Current provider/locale challenge coverage remains incomplete. |
| P-07 Local HTTP | Shipped explicit loopback HTTP with authentication, origin/host and request bounds. | Remote multi-user service is a separate architecture; no remote deployment claim. |
| P-08 Installation | Published artifact and hosted Node 20/22 × Linux/macOS/Windows checks; native Mac Claude cold check. | New-user native first reads, particularly Cursor/VS Code and other OS/client versions. |
| P-09 Official provider | Not implemented in the active runtime; unavailable mode refuses early. | Owner supplies granted LinkedIn app products/scopes; implement and verify only permitted operations. |

## Complete execution backlog

| Backlog | State | Concrete next work and finish line |
| --- | --- | --- |
| P0 Safety corrections | Shipped | Ongoing advisory and contract regression maintenance. Passing fixtures do not establish safe live outcomes for every route. |
| P1 Setup/client exports | Shipped | Observe real first-start failures in Claude Desktop, Cursor and VS Code; repair the failures users encounter. |
| P2 Research briefs | Blocked draft [PR #5](https://github.com/devag7/linkedin-mcp/pull/5), head `0aa9c280`; not in any public core package | Reproduce/fix current cleanup failures offline, integrate current dependency fixes without rewriting history, obtain fresh bounded consent, then produce a useful source-linked result with clean teardown. Historical live/cleanup failures stay failed. |
| P3 Saved jobs | Not built | New consented capture of the own-account route; max 25 rows/page and two explicit pages; strict IDs, partial/empty/shape distinctions and live evidence. |
| P4 Richer job filters | Not built beyond keyword/location | Verify date/work type/employment/experience/sort mappings individually; reject unsupported combinations; bind paging to the full query. |
| P5 Inbox keyword search | Not built | Bounded local filtering or a verified own-inbox route; max two pages/25 matches, clear partial coverage and sensitive-content retention rules. |
| P6 Post search | Not built | Verified route/query/locale evidence under fresh consent; bounded rows, citations and shape-change failures. |
| P7 Native first-use/packaging | Partial | Public unsigned MCPB and one Mac cold discovery passed; published-package SDK export checks passed. Fresh-user live cohort remains 0/0. Measure every first started attempt, client and OS under the pinned consent kit. |
| P8 Inventory/erasure/Windows | Partial | Inventory, native private-state guard, selected-profile retirement and interrupted-retirement preview ship. Coordinated erasure across all profiles/shared journal, interruption, hostile same-account races and prior exposed-state handling remain unresolved. Retain replay protection while any profile can run. |
| P9 Official provider | Blocked by missing granted app access | Owner supplies granted scopes; implement a separate capability-limited provider and approved identity/publishing tests. No browser fallback masquerading as official access. |
| P10 Distribution/tutorials/community | Partial | Setup/demo/workflow guides and registry/package/release destinations exist. Awesome MCP submission awaits upstream acceptance; Glama needs owner sign-in/re-sync and hosted-copy correction. Three observed end-to-end tutorial flows, repeatable issue response and measured distribution outcomes remain open. |
| P11 Opt-in/traffic ledger | Partial | [Private ledger](ADOPTION_TRAFFIC_LEDGER_2026-10-19.md) ships; consent/scoring kit and public opt-in issue exist. Capture weekly; first-use and repeat-use samples and a complete monthly report are still missing. No hidden telemetry. |
| P12 Development advisory follow-up | Earlier esbuild issue resolved; SDK patch shipped on npm/GitHub Packages | Source moved to esbuild 0.28.2 in prior work. October 21 audit found four SDK advisories aggregated as one high package finding; SDK 1.32.1 clears the full source audit and the input guard ships in public 4.1.1. Core and desktop-bundle publication/readback are verified; do not repeat the stale “one low esbuild” claim as current. |

## Later job-seeker and Claude scope

| Feature | State / finish line |
| --- | --- |
| Local application worksheet | Published `prepare_job_application`; user supplies listing/resume evidence. It returns a draft and gaps. Native usefulness remains unmeasured. |
| Application tracker export | Published `export_application_tracker`; user-entered statuses → private CSV text. It does not own a database or verify employer receipts. |
| Resume/cover-letter draft reuse | Not built as a dedicated flow. Use supplied facts, preserve provenance and gaps, require user review and explicit storage/deletion behavior. |
| Persistent tracker/reminders | Not built. Design private schema, concurrency, inventory and erasure before persistence; user-entered submission status is not receipt proof. |
| Alerts/application history | Not built. Needs verified provider routes or clearly local user-input semantics; no background account polling is authorized. |
| Interview/follow-up preparation | General company/profile reads exist; dedicated source-linked preparation flow is not implemented or validated. |
| Form filling, resume upload, Easy Apply, ATS submission | Not built. A permitted provider integration, field/attachment mapping, exact per-job approval, durable unknown-outcome handling and actual receipt proof are prerequisites. No generic bulk submit feature. |
| Claude local extension | Public 4.1.1 MCPB/checksum with independently verified bytes and hosted Mac/Windows cold/guard checks. One historical 4.1.0 Mac native check passed; native 4.1.1/live pairings remain open. |
| Claude Code/Cowork plugin | Not built or tested; runtime/browser/profile compatibility is unknown. |
| Claude web/remote connector | Not implemented. Needs HTTPS, per-user OAuth/isolation, privacy/support, permitted provider access and real connector tests. |
| Claude directory listing | Not submitted or accepted. Current [policy §3F](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) requires control of connected endpoints/interfaces. This is an apparent eligibility blocker for the current LinkedIn browser path; obtain written route clarification/permission. Local installation is not directory acceptance. |

The original future ideas—official media publishing, comparison of user-selected
profiles, a local action-review UI and additional client installers—remain
conditional scope, not delivered promises. Revisit them after measured user demand.
Large SaaS/CRM hosting and mandatory paid bridges are not required for this local project.

## Fresh observations and priorities

- Main at audit start: `09a28d236528647f85efcdbbb0224200bcbd3907`.
  PR #41 and post-merge CI both passed 14/14. Release validation passed on a
  failed-job-only retry; the first Windows preflight timeout remains failed evidence.
- Public 4.1.0 npm bytes still match SHA-256
  `477c0cbfffe1901c9dea926dd8b9b4be6c9ff223154ff111854be949e798d8f9`;
  15 files, matching SRI, provenance source and public MCPB hash. MCP Registry is
  active/latest at this initial refresh; 4.1.1 became latest after the patch.
  GitHub package version and final release/tag remained present.
  Fresh consumer: 99 verified registry signatures, 15 verified attestations and
  zero production findings. GitHub Packages archive bytes were verified in the
  [October 18 release receipt](RELEASE_EVIDENCE_4.1.0.md); this refresh checked its version metadata.
- At 2026-10-21 07:43:40 UTC, GitHub reports **12 stars**, net **+2** since
  October 19. Latest window: 58 views/34 uniques; 3,872 clones/539 uniques.
  October covers only 16 observed days; no complete monthly report exists.
  Clone counts may include automation and cannot establish installs or people.
- [Pilot issue #13](https://github.com/devag7/linkedin-mcp/issues/13) now invites
  4.1.0 testing and has no responses. The recorded first-use cohort remains
  **0/0, unmeasured**; the 80% target has not been demonstrated.
- Awesome MCP PR #15490 remains open. Glama still carries 4.0.0 installation
  text and generated “Deploy Server” instructions on October 21. Owner-side
  GitHub sign-in is required to claim/re-sync its listing.
- 10,000 stars and daily GitHub Trending remain unachieved/unverified outcomes.
  No claim about Trending's ranking algorithm or a promised date is made.

The SDK patch and 4.1.1 bundle are now publicly verified. The fastest next
evidence-producing step is one willing new participant completing the separate
[4.1.1 kit](FIRST_USE_VOLUNTEER_KIT_4.1.1.md), while the owner fixes Glama access. Prioritize the participant's first reproducible failure. Work on
coordinated erasure and PR #5 offline in separate reviewable changes; provider
captures, live tests, submissions and external outreach require their stated scopes.

No LinkedIn request, participant contact or real-state deletion was part of
this audit. Required maintainer service spend remains $0; existing hardware,
client access, optional signing and future provider/hosting terms are separate.
