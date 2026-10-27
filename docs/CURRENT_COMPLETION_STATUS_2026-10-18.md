# Current completion status — reviewed October 27, 2026

This is the current-state index for the original roadmap, the job-seeker plan,
and Claude distribution. Older dated evidence remains in its original files.
“Shipped” means present in a verified public artifact; a passing fixture or
hosted check does not establish live LinkedIn behavior.

The [October 21 full-scope audit](COMPLETION_AUDIT_2026-10-21.md) maps every
original functional requirement, later backlog item and job-seeker addition.
The complete roadmap has not been achieved.

## October 26 release and security update

The reviewed source repair is merged, and core 4.1.2 has completed its automated
release workflow. The npm archive matches the final reviewed candidate; fresh
production audit, registry signatures and attestations pass. Independent
four-destination results and current wrapper asset status are recorded in
[4.1.2 release evidence](RELEASE_EVIDENCE_4.1.2.md). The first publication attempt
failed its visibility check after upload; the original failure is retained and
the same-SHA resume skipped a second npm upload.

The local Claude plugin and public MCPB builders are now repinned to the
verified 4.1.2 archive. Package checks do not establish native client startup,
LinkedIn compatibility or directory eligibility. Old 4.1.1 zero-audit receipts
remain historical. The public pilot invitation was paused during repair; use
only the new version-separated 4.1.2 kit after verified release and merged
instructions. Recorded participant attempts remain 0/0, unmeasured.

## 4.2.0 additive source milestone

The application worksheet source now supports optional evidence-library reuse,
explicit per-requirement mapping, and deterministic resume/cover-letter drafts.
The tool count stays 24 and existing requests retain their old output shape.
[Requirements and workflow](APPLICATION_MATERIALS_2026-10-27.md) define the bounds;
[4.2.0 readiness](RELEASE_READINESS_4.2.0.md) separates this candidate from actual
publication. Do not infer 4.2.0 availability from this source index. The independently
verified public 4.1.2 core and Claude wrapper receipts below remain historical
version-specific proof. Local draft assembly does not establish native usefulness,
application filling or submission. Persistent libraries/trackers remain absent.

A separate [4.2.0 kit](FIRST_USE_VOLUNTEER_KIT_4.2.0.md) and
[results guide](FIRST_USE_RESULTS_4.2.0.md) preserve the approved account-read pilot
scope. No recorded participant has started. Update the public invitation only
after 4.2.0 publication is independently verified; keep older cohorts distinct.

## Published and verified

| Area | Evidence | Boundary |
| --- | --- | --- |
| Core package | [4.1.2 release evidence](RELEASE_EVIDENCE_4.1.2.md): npm archive/provenance, GitHub Packages, active MCP Registry metadata and finalized GitHub Release/tag independently verified; 24 tools and exact 15-file npm archive, SDK 1.32.1 and input guard | No broad live-provider or native-client first-use proof |
| Safety and setup | Default-disabled writes, reviewed preview tokens, shared caps/journal, offline diagnosis and client-config export; release tests and hosted matrix | LinkedIn account restrictions remain possible |
| Job-seeker convenience | `prepare_job_application` creates a local worksheet from user-supplied facts; `export_application_tracker` formats user-entered records as CSV | No application filling, uploading, submitting, saved-job retrieval, or server-owned tracker persistence |
| Local retirement | Selected-profile retirement and interrupted-retirement preview; Windows private-state guard | Shared safety state, other profiles, client data and backups are outside selected retirement; complete coordinated erasure remains open |
| Claude Desktop bundle | Unsigned 4.1.2 MCPB and local plugin wrap the verified public runtime; [asset/evidence status](RELEASE_EVIDENCE_4.1.2.md) distinguishes local, hosted and public checks. Historical [4.1.0 native Mac receipt](evidence/claude-native-4.1.0-2026-10-18.md) remains separate. | Native 4.1.2 install, live account use, other client/OS pairings and directory acceptance remain unproven |

## Open acceptance gates

| Gate | Current observation | Concrete finish line |
| --- | --- | --- |
| First use | Version-separated [4.1.2 consent kit](FIRST_USE_VOLUNTEER_KIT_4.1.2.md) and [scoring guide](FIRST_USE_RESULTS_4.1.2.md) are prepared. The recorded cohort remains 0/0, unmeasured; historical versions do not establish 4.1.2 first use. | Resume the existing public invitation only after verified release and merged kit. A willing participant consents personally; count every first started attempt, keep failures and version cohorts separate, and retain minimal results privately. |
| Job research briefs | Draft [PR #5](https://github.com/devag7/linkedin-mcp/pull/5) is blocked. Earlier live runs returned no useful job and had cleanup failures; its later search-only head had failed hosted/package cleanup jobs. | Fix reproducible cleanup and useful-result failures, then obtain new bounded consent for live validation before merge or release. Preserve failed receipts. |
| Native clients and account compatibility | No fresh-user 4.1.2 read measured in Claude Desktop, Cursor or VS Code. | Record consented real-client first use and observed failure categories, then repair what participants encounter. |
| Full privacy retirement | Selected-profile tools are scoped and released. | Design, review and test complete coordinated erasure with active-owner, interruption, same-account race and Windows evidence. Never use it to reset safety caps. |
| Official provider and Claude directory | Official LinkedIn app grants/scopes are unavailable. The local browser server is not a remote HTTPS connector. [Anthropic's directory policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) appears to require control of connected interfaces. | Obtain permitted provider access and written directory eligibility/route clarification before implementing or submitting a remote connector. Do not claim listing eligibility from a local `.mcpb`. |
| Application submission | LinkedIn Easy Apply and external ATS submission are absent. | Require a permitted integration, exact per-job field/attachment mapping, human final approval and receipt proof. Keep unsupported auto-apply claims out of release copy. |
| Further product scope | Saved jobs, richer job filters, inbox keyword search, post search, job alerts/application history, dedicated interview/follow-up flows and server-owned tracker persistence are absent. Source4.2.0 adds bounded offline materials assembly; publication and usefulness remain separate gates. | Follow the bounded source/identity/privacy acceptance criteria in the full-scope audit; capture provider routes only under new scoped consent. |
| SDK security maintenance | Core 4.1.2 retains SDK 1.32.1/input guard, migrates to Zod 4.6.7, repairs affected transitive and publisher dependencies, and clears current audits; [repair evidence](SECURITY_REPAIR_2026-10-26.md). Earlier esbuild/Vitest findings are resolved. | Continue advisory monitoring. A zero known-finding audit is not broad provider or native-client proof. |
| Distribution and adoption | [Awesome MCP PR #15490](https://github.com/punkpeye/awesome-mcp-servers/pull/15490) remains open on October 21. [Glama](https://glama.ai/mcp/servers/devag7/linkedin-mcp) still shows older 4.0.0 installation instructions and generic hosted deployment copy. Its [Admin page](https://glama.ai/mcp/servers/devag7/linkedin-mcp/admin) requires the repository owner's GitHub sign-in for claiming/re-sync. The [private traffic ledger](ADOPTION_TRAFFIC_LEDGER_2026-10-19.md) now records 12 stars, +2 since October 19; first-use remains 0/0. | Owner signs into Glama and requests re-sync, then corrects editable fields and seeks platform correction for generated hosted copy. Capture traffic weekly and consented first-use/repeat-use outcomes separately. 10,000 stars and GitHub Trending daily are targets, not guaranteed milestones. |

An older external [Dockerfile PR #2](https://github.com/devag7/linkedin-mcp/pull/2)
also remains open. Its submitted diff removes the `builder` stage while still
copying from it, and predates the current experimental Docker recipe. It is
not a 4.1.0 release gate or a verified hosted deployment path; review any
container work against current source as a separate change.

## Local Claude plugin preparation

A [local plugin candidate](CLAUDE_PLUGIN_2026-10-22.md) wraps exact public
4.1.2 with a job-preparation skill. Source packaging, hosted checks, native
startup and directory acceptance are separate gates. This does not add
application submission, a remote connector or PR #5 to the released runtime.

## Next sequence

1. Use the verified public 4.1.2 runtime after checking its release evidence.
   The [4.1.2 consent kit](FIRST_USE_VOLUNTEER_KIT_4.1.2.md) and
   [results guide](FIRST_USE_RESULTS_4.1.2.md) define a new, separate cohort.
   Resume the existing public invitation only after these instructions merge;
   a participant must personally consent before starting. Historical protocols
   and failures stay preserved. No individual outreach is part of this update.
2. Use the first real observed onboarding failures to prioritize fixes. Treat
   PR #5, complete erasure, provider access and application submission as
   independent gates; none is a prerequisite to truthfully distributing the verified
   core package. Do not claim those unfinished features are included.

No mandatory paid service is needed for the local release or this evidence
work. User-supplied hardware, Chrome, client access and any future approved
provider or hosting arrangement remain separate prerequisites.
