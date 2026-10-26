# Current completion status — reviewed October 22, 2026

This is the current-state index for the original roadmap, the job-seeker plan,
and Claude distribution. Older dated evidence remains in its original files.
“Shipped” means present in a verified public artifact; a passing fixture or
hosted check does not establish live LinkedIn behavior.

The [October 21 full-scope audit](COMPLETION_AUDIT_2026-10-21.md) maps every
original functional requirement, later backlog item and job-seeker addition.
The complete roadmap has not been achieved.

## October 26 security gate

Fresh source/production audits found four affected packages, including high
Zod and body-parser findings; the installed publisher also failed on newly
affected ip-address/undici versions. Earlier zero-audit receipts are historical.
The separate [source and publisher repair](SECURITY_REPAIR_2026-10-26.md) in
[PR #48](https://github.com/devag7/linkedin-mcp/pull/48) is merged at
`c7d9af30508c0d2a7b69d5df033e784268089dcd`. This repairs the source checkout,
not the immutable public 4.1.1 runtime or its wrappers. Replacement publication
and independent destination/archive verification remain required.

The local Claude plugin stays pinned to public 4.1.1 and blocked on its
zero-audit gate until a verified replacement archive can be reviewed and
repinned. The source-candidate MCPB audit and pinned-public plugin audit are
separate gates; neither is waived. Do not begin a new public 4.1.1 pilot or
recommend it as security-cleared. No profile access, publication, full roadmap
completion or plugin package-gate pass is implied by this source integration.

## Published and verified

| Area | Evidence | Boundary |
| --- | --- | --- |
| Core package | [4.1.1 release evidence](RELEASE_EVIDENCE_4.1.1.md): npm archive/provenance, GitHub Packages, active MCP Registry metadata and finalized GitHub Release/tag independently verified; 24 tools and exact 15-file npm archive, SDK 1.32.1 and input guard | No broad live-provider or native-client first-use proof |
| Safety and setup | Default-disabled writes, reviewed preview tokens, shared caps/journal, offline diagnosis and client-config export; release tests and hosted matrix | LinkedIn account restrictions remain possible |
| Job-seeker convenience | `prepare_job_application` creates a local worksheet from user-supplied facts; `export_application_tracker` formats user-entered records as CSV | No application filling, uploading, submitting, saved-job retrieval, or server-owned tracker persistence |
| Local retirement | Selected-profile retirement and interrupted-retirement preview; Windows private-state guard | Shared safety state, other profiles, client data and backups are outside selected retirement; complete coordinated erasure remains open |
| Claude Desktop bundle | Public unsigned [4.1.1 bundle/checksum](https://github.com/devag7/linkedin-mcp/releases/tag/v4.1.1), exact public download/hash verified; hosted Mac/Windows builds and packed/unpacked cold/guard checks passed. Historical [4.1.0 native Mac receipt](evidence/claude-native-4.1.0-2026-10-18.md) remains separate. | Native 4.1.1 install, live account use, other client/OS pairings and directory acceptance remain unproven |

## Open acceptance gates

| Gate | Current observation | Concrete finish line |
| --- | --- | --- |
| First use | The owner-authorized [issue #13](https://github.com/devag7/linkedin-mcp/issues/13) and existing [4.1.1 kit](FIRST_USE_VOLUNTEER_KIT_4.1.1.md)/[scoring guide](FIRST_USE_RESULTS_4.1.1.md) remain historical preparation. The recorded cohort is 0/0, unmeasured. New 4.1.1 attempts are paused by the current security gate; earlier offline/native observations do not establish first use. | After a replacement public artifact is independently verified, review and update the version-pinned kit and invitation before a willing participant personally consents and starts. Count every first started attempt and retain failures; keep minimal results private and version cohorts distinct. Do not treat 0/0 as a rate. |
| Job research briefs | Draft [PR #5](https://github.com/devag7/linkedin-mcp/pull/5) is blocked. Earlier live runs returned no useful job and had cleanup failures; its later search-only head had failed hosted/package cleanup jobs. | Fix reproducible cleanup and useful-result failures, then obtain new bounded consent for live validation before merge or release. Preserve failed receipts. |
| Native clients and account compatibility | No fresh-user 4.1.1 read measured in Claude Desktop, Cursor or VS Code. | Record consented real-client first use and observed failure categories, then repair what participants encounter. |
| Full privacy retirement | Selected-profile tools are scoped and released. | Design, review and test complete coordinated erasure with active-owner, interruption, same-account race and Windows evidence. Never use it to reset safety caps. |
| Official provider and Claude directory | Official LinkedIn app grants/scopes are unavailable. The local browser server is not a remote HTTPS connector. [Anthropic's directory policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) appears to require control of connected interfaces. | Obtain permitted provider access and written directory eligibility/route clarification before implementing or submitting a remote connector. Do not claim listing eligibility from a local `.mcpb`. |
| Application submission | LinkedIn Easy Apply and external ATS submission are absent. | Require a permitted integration, exact per-job field/attachment mapping, human final approval and receipt proof. Keep unsupported auto-apply claims out of release copy. |
| Further product scope | Saved jobs, richer job filters, inbox keyword search, post search, job alerts/application history, reusable resume/cover-letter drafts and server-owned tracker persistence are absent. | Follow the bounded source/identity/privacy acceptance criteria in the full-scope audit; capture provider routes only under new scoped consent. |
| SDK security maintenance | The 4.1.1 SDK 1.32.1 floor/lock and 10,000-element input guard are verified in public npm bytes. The October 21 release audits passed. The October 22 [development-tool follow-up](DEVELOPMENT_SECURITY_REPAIR_2026-10-22.md) raises Vitest to 4.1.12 and clears two newly reported moderate development findings; production remains unaffected. The earlier esbuild issue is resolved. | Core and bundle public destination gates passed. Ongoing advisory monitoring remains required; this does not prove live provider compatibility. |
| Distribution and adoption | [Awesome MCP PR #15490](https://github.com/punkpeye/awesome-mcp-servers/pull/15490) remains open on October 21. [Glama](https://glama.ai/mcp/servers/devag7/linkedin-mcp) still shows older 4.0.0 installation instructions and generic hosted deployment copy. Its [Admin page](https://glama.ai/mcp/servers/devag7/linkedin-mcp/admin) requires the repository owner's GitHub sign-in for claiming/re-sync. The [private traffic ledger](ADOPTION_TRAFFIC_LEDGER_2026-10-19.md) now records 12 stars, +2 since October 19; first-use remains 0/0. | Owner signs into Glama and requests re-sync, then corrects editable fields and seeks platform correction for generated hosted copy. Capture traffic weekly and consented first-use/repeat-use outcomes separately. 10,000 stars and GitHub Trending daily are targets, not guaranteed milestones. |

An older external [Dockerfile PR #2](https://github.com/devag7/linkedin-mcp/pull/2)
also remains open. Its submitted diff removes the `builder` stage while still
copying from it, and predates the current experimental Docker recipe. It is
not a 4.1.0 release gate or a verified hosted deployment path; review any
container work against current source as a separate change.

## Local Claude plugin preparation

A [local plugin candidate](CLAUDE_PLUGIN_2026-10-22.md) wraps exact public
4.1.1 with a job-preparation skill. Source packaging, hosted checks, native
startup and directory acceptance are separate gates. This does not add
application submission, a remote connector or PR #5 to the released runtime.

## Next sequence

1. Complete replacement publication and independent verification before repinning
   the plugin or updating the owner-led pilot invitation and consent kit. Existing
   public 4.1.1 bytes are not currently security-cleared. Preserve the historical
   [4.1.1 kit](FIRST_USE_VOLUNTEER_KIT_4.1.1.md) and
   [results guide](FIRST_USE_RESULTS_4.1.1.md); no participant has started either
   recorded cohort and no outreach is part of this integration.
2. Use the first real observed onboarding failures to prioritize fixes. Treat
   PR #5, complete erasure, provider access and application submission as
   independent gates; none is a prerequisite to truthfully distributing the verified
   core package. Do not claim those unfinished features are included.

No mandatory paid service is needed for the local release or this evidence
work. User-supplied hardware, Chrome, client access and any future approved
provider or hosting arrangement remain separate prerequisites.
