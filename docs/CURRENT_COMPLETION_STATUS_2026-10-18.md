# Current completion status — reviewed October 29, 2026

This is the current-state index for the original roadmap, the job-seeker plan,
and Claude distribution. Older dated evidence remains in its original files.
“Shipped” means present in a verified public artifact; a passing fixture or
hosted check does not establish live LinkedIn behavior.

The [October 21 full-scope audit](COMPLETION_AUDIT_2026-10-21.md) maps every
original functional requirement, later backlog item and job-seeker addition.
The complete roadmap has not been achieved.

## October 29 distribution and maintenance update

Both public 4.2.0 Claude packages and their checksum files are now attached to the
[finalized release](https://github.com/devag7/linkedin-mcp/releases/tag/v4.2.0).
Unauthenticated downloads matched the reviewed files and GitHub asset digests;
an independent readback confirmed the checksums, retained core tag/npm integrity
and current pilot links. This establishes distribution, not native installation
or directory acceptance. The core archive and tag remain unchanged.

The source-lock [Hono repair](SECURITY_HONO_NODE_SERVER_2026-10-29.md),
[PR #52](https://github.com/devag7/linkedin-mcp/pull/52), is merged at `497110a`.
It changes one adapter resolution from 1.19.17 to 2.1.5 without changing the
15-file public archive. Full source, production, fresh-consumer and publisher
audits recorded zero findings after repair. Local validation passed 823 tests
with one platform skip; all 14 hosted jobs passed at both the reviewed head and
[merged main](https://github.com/devag7/linkedin-mcp/actions/runs/40840783813).
The redundant same-version release was cancelled before publishing steps and
is not counted as a passing release run. Existing consumer lockfiles are not
automatically repaired by a source-lock update.

The [public opt-in invitation](https://github.com/devag7/linkedin-mcp/issues/13)
now points to the merged 4.2.0 kit and scoring guide. Recorded attempts remain
0/0, unmeasured. No participant contact or account access occurred.

The [offline interview preparation kit](INTERVIEW_PREPARATION_2026-10-29.md)
is implemented in a [4.3.0 release candidate](RELEASE_READINESS_4.3.0.md). The
source-only checkpoint passed 835 local tests, source/installed-package checks
and independent review. The versioned candidate's final-head gates and publication
remain separate. Published 4.2.0 does not support the new option. Its acceptance
is separate from completed 4.2.0 distribution; required new service spend is $0.

## October 27 release and materials update

Core 4.2.0 is published and independently verified on npm, GitHub Packages, MCP
Registry and GitHub Releases; [source/archive/provenance evidence](RELEASE_EVIDENCE_4.2.0.md).
It adds optional reusable evidence and deterministic resume/cover-letter drafts
to the existing worksheet, keeping 24 tools and legacy request compatibility.
Only explicitly selected, unverified supplied facts enter the drafts; no library
is stored. New forms, uploads, application submission and provider routes are absent.

The production run's first upload succeeded but its visibility gate failed.
A later read matched exact public bytes. The failed-job-only same-source resume
passed all 10 jobs and skipped another npm upload; the original cause remains unknown.
The separate bounded read-only metadata tolerance affects future workflows,
not the immutable release source or its preserved failed attempt.

Both 4.2.0 Claude wrappers build from the verified public archive and pass local
staged/unpacked checks. Their final hosted/integration/public asset gates are
recorded separately in the evidence and [Release distribution notes](https://github.com/devag7/linkedin-mcp/releases/tag/v4.2.0).
Native 4.2.0 use and directory acceptance remain unproven; prior 4.1.2 receipts are historical.
The version-separated [4.2.0 kit](FIRST_USE_VOLUNTEER_KIT_4.2.0.md) and
[results guide](FIRST_USE_RESULTS_4.2.0.md) are merged, and the existing invitation
was updated on October 29 after verified publication. No recorded participant
has started; keep 0/0 as unmeasured. Historical protocols and failed receipts remain intact.

## Core release and distribution evidence

| Area | Evidence | Boundary |
| --- | --- | --- |
| Core package | [4.2.0 release evidence](RELEASE_EVIDENCE_4.2.0.md): npm archive/provenance, GitHub Packages, active MCP Registry metadata and finalized GitHub Release/tag independently verified; 24 tools and exact 15-file npm archive, SDK ^1.32.1 floor and input guard | No broad live-provider or native-client first-use proof |
| Safety and setup | Default-disabled writes, reviewed preview tokens, shared caps/journal, offline diagnosis and client-config export; release tests and hosted matrix | LinkedIn account restrictions remain possible |
| Job-seeker convenience | `prepare_job_application` creates a worksheet and optional evidence-linked draft materials from user-supplied facts; `export_application_tracker` formats user-entered records as CSV | No application filling, uploading, submitting, saved-job retrieval, or server-owned tracker persistence |
| Local retirement | Selected-profile retirement and interrupted-retirement preview; Windows private-state guard | Shared safety state, other profiles, client data and backups are outside selected retirement; complete coordinated erasure remains open |
| Claude Desktop bundle | Unsigned 4.2.0 MCPB and local plugin builders wrap the verified public runtime; [asset/evidence status](RELEASE_EVIDENCE_4.2.0.md) distinguishes local, hosted and public checks. Historical [4.1.0 native Mac receipt](evidence/claude-native-4.1.0-2026-10-18.md) remains separate. | Native 4.2.0 install, live account use, other client/OS pairings and directory acceptance remain unproven |

## Open acceptance gates

| Gate | Current observation | Concrete finish line |
| --- | --- | --- |
| First use | Version-separated [4.2.0 consent kit](FIRST_USE_VOLUNTEER_KIT_4.2.0.md), [scoring guide](FIRST_USE_RESULTS_4.2.0.md) and updated public invitation are available. The recorded cohort remains 0/0, unmeasured; historical versions do not establish 4.2.0 first use. | A willing participant consents personally; count every first started attempt, keep failures and version cohorts separate, and retain minimal results privately. |
| Job research briefs | Draft [PR #5](https://github.com/devag7/linkedin-mcp/pull/5) is blocked. Earlier live runs returned no useful job and had cleanup failures; its later search-only head had failed hosted/package cleanup jobs. | Fix reproducible cleanup and useful-result failures, then obtain new bounded consent for live validation before merge or release. Preserve failed receipts. |
| Native clients and account compatibility | No fresh-user 4.2.0 read measured in Claude Desktop, Cursor or VS Code. | Record consented real-client first use and observed failure categories, then repair what participants encounter. |
| Full privacy retirement | Selected-profile tools are scoped and released. | Design, review and test complete coordinated erasure with active-owner, interruption, same-account race and Windows evidence. Never use it to reset safety caps. |
| Official provider and Claude directory | Official LinkedIn app grants/scopes are unavailable. The local browser server is not a remote HTTPS connector. [Current official route/policy research](CLAUDE_DIRECTORY_RESEARCH_2026-10-27.md) distinguishes local plugin submission from remote HTTPS/OAuth and identifies interface-control and installable-source gaps. | Obtain permitted provider access and written eligibility clarification; prepare a complete installable GitHub plugin source before any directory submission. A remote connector requires separate HTTPS/OAuth design. Do not claim listing eligibility from a local `.mcpb`. |
| Application submission | LinkedIn Easy Apply and external ATS submission are absent. | Require a permitted integration, exact per-job field/attachment mapping, human final approval and receipt proof. Keep unsupported auto-apply claims out of release copy. |
| Further product scope | Saved jobs, richer job filters, inbox keyword search, post search, job alerts/application history and server-owned tracker persistence are absent. The offline interview/follow-up kit is a 4.3.0 release candidate, not yet a published feature in this preparation snapshot. Public 4.2.0 provides bounded materials assembly; native usefulness remains unmeasured. | Complete the final-head candidate gates and independently verify release destinations for the interview kit. Follow the source/identity/privacy criteria for provider features; capture routes only under new scoped consent. |
| SDK security maintenance | Core 4.2.0 retains SDK ^1.32.1/input guard and Zod 4.6.7; earlier esbuild/Vitest findings are resolved. The [October 29 adapter lock repair](SECURITY_HONO_NODE_SERVER_2026-10-29.md) clears the newly observed moderate source finding; repaired source/consumer/publisher audits recorded zero. | Continue advisory monitoring and update affected existing installations deliberately. A zero known-finding audit is not broad provider or native-client proof. |
| Distribution and adoption | [Awesome MCP PR #15490](https://github.com/punkpeye/awesome-mcp-servers/pull/15490) remains open on October 21. The October 21 [Glama observation](https://glama.ai/mcp/servers/devag7/linkedin-mcp) showed older 4.0.0 installation instructions and generic hosted deployment copy; it is not a fresh October 27 readback. Its [Admin page](https://glama.ai/mcp/servers/devag7/linkedin-mcp/admin) requires the repository owner's GitHub sign-in for claiming/re-sync. The [private traffic ledger](ADOPTION_TRAFFIC_LEDGER_2026-10-19.md) now records 12 stars, +2 since October 19; first-use remains 0/0. | Recheck Glama; if still stale, the owner signs in and requests re-sync, then corrects editable fields and seeks platform correction for generated hosted copy. The October 27 private capture reports 12 stars, +2 since October 19, with 22 observed October days and no complete month. Clones are not installs. Capture traffic weekly and consented first-use/repeat-use outcomes separately. 10,000 stars and GitHub Trending daily are targets, not guaranteed milestones. |

An older external [Dockerfile PR #2](https://github.com/devag7/linkedin-mcp/pull/2)
also remains open. Its submitted diff removes the `builder` stage while still
copying from it, and predates the current experimental Docker recipe. It is
not a 4.1.0 release gate or a verified hosted deployment path; review any
container work against current source as a separate change.

## Local Claude plugin preparation

A [published local plugin bundle](CLAUDE_PLUGIN_2026-10-22.md) wraps exact public
4.2.0 with a job-preparation skill. Public distribution, hosted checks, native
startup and directory acceptance are separate gates. This does not add
application submission, a remote connector or PR #5 to the released runtime.

## Next sequence

1. Use the verified public 4.2.0 runtime after checking its release evidence.
   The [4.2.0 consent kit](FIRST_USE_VOLUNTEER_KIT_4.2.0.md) and
   [results guide](FIRST_USE_RESULTS_4.2.0.md) define a new, separate cohort.
   The existing public invitation now uses these merged instructions;
   a participant must personally consent before starting. Historical protocols
   and failures stay preserved. No individual outreach is part of this update.
2. Use the first real observed onboarding failures to prioritize fixes. Treat
   PR #5, complete erasure, provider access and application submission as
   independent gates; none is a prerequisite to truthfully distributing the verified
   core package. Do not claim those unfinished features are included.

No mandatory paid service is needed for the local release or this evidence
work. User-supplied hardware, Chrome, client access and any future approved
provider or hosting arrangement remain separate prerequisites.
