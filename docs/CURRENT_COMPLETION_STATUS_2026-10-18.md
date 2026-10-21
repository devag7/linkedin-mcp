# Current completion status — reviewed October 21, 2026

This is the current-state index for the original roadmap, the job-seeker plan,
and Claude distribution. Older dated evidence remains in its original files.
“Shipped” means present in a verified public artifact; a passing fixture or
hosted check does not establish live LinkedIn behavior.

The [October 21 full-scope audit](COMPLETION_AUDIT_2026-10-21.md) maps every
original functional requirement, later backlog item and job-seeker addition.
The complete roadmap has not been achieved.

## Published and verified

| Area | Evidence | Boundary |
| --- | --- | --- |
| Core package | [4.1.0 release evidence](RELEASE_EVIDENCE_4.1.0.md): npm archive and provenance, GitHub Packages, MCP Registry, and GitHub Release checked independently; 24 tools and exact 15-file npm archive | No broad live-provider or native-client first-use proof |
| Safety and setup | Default-disabled writes, reviewed preview tokens, shared caps/journal, offline diagnosis and client-config export; release tests and hosted matrix | LinkedIn account restrictions remain possible |
| Job-seeker convenience | `prepare_job_application` creates a local worksheet from user-supplied facts; `export_application_tracker` formats user-entered records as CSV | No application filling, uploading, submitting, saved-job retrieval, or server-owned tracker persistence |
| Local retirement | Selected-profile retirement and interrupted-retirement preview; Windows private-state guard | Shared safety state, other profiles, client data and backups are outside selected retirement; complete coordinated erasure remains open |
| Claude Desktop bundle | [PR #37](https://github.com/devag7/linkedin-mcp/pull/37) merged at `e35721d`; hosted Mac/Windows bundle builds and [native Mac cold check](evidence/claude-native-4.1.0-2026-10-18.md) discovered 24 tools and cold `whoami`; the exact unsigned bundle and checksum are [v4.1.0 release assets](https://github.com/devag7/linkedin-mcp/releases/tag/v4.1.0) with independently verified SHA-256 | Native live account use, other client versions/OSes and Claude directory acceptance remain unproven |

## Open acceptance gates

| Gate | Current observation | Concrete finish line |
| --- | --- | --- |
| First use | The owner-authorized 4.1.0 opt-in [issue #13](https://github.com/devag7/linkedin-mcp/issues/13) was updated October 19 and still has no responses on October 21; the recorded cohort is 0/0. The [4.1.0 kit](FIRST_USE_VOLUNTEER_KIT_4.1.0.md) and [scoring guide](FIRST_USE_RESULTS_4.1.0.md) are available. The exact public package passed [fresh offline installation, 24-tool discovery and cold status](evidence/first-use-2026-10-18/published-offline.json) for all three exported client configurations on one Mac. | A willing participant personally consents and starts the pinned 4.1.0 protocol. Count every first started attempt and record only consented minimal results privately. Do not mix versions or treat 0/0 as a rate. |
| Job research briefs | Draft [PR #5](https://github.com/devag7/linkedin-mcp/pull/5) is blocked. Earlier live runs returned no useful job and had cleanup failures; its later search-only head had failed hosted/package cleanup jobs. | Fix reproducible cleanup and useful-result failures, then obtain new bounded consent for live validation before merge or release. Preserve failed receipts. |
| Native clients and account compatibility | No fresh-user 4.1.0 read measured in Claude Desktop, Cursor or VS Code. | Record consented real-client first use and observed failure categories, then repair what participants encounter. |
| Full privacy retirement | Selected-profile tools are scoped and released. | Design, review and test complete coordinated erasure with active-owner, interruption, same-account race and Windows evidence. Never use it to reset safety caps. |
| Official provider and Claude directory | Official LinkedIn app grants/scopes are unavailable. The local browser server is not a remote HTTPS connector. [Anthropic's directory policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) appears to require control of connected interfaces. | Obtain permitted provider access and written directory eligibility/route clarification before implementing or submitting a remote connector. Do not claim listing eligibility from a local `.mcpb`. |
| Application submission | LinkedIn Easy Apply and external ATS submission are absent. | Require a permitted integration, exact per-job field/attachment mapping, human final approval and receipt proof. Keep unsupported auto-apply claims out of release copy. |
| Further product scope | Saved jobs, richer job filters, inbox keyword search, post search, job alerts/application history, reusable resume/cover-letter drafts and server-owned tracker persistence are absent. | Follow the bounded source/identity/privacy acceptance criteria in the full-scope audit; capture provider routes only under new scoped consent. |
| SDK security maintenance | October 21 source audit found SDK 1.31.0 affected by new advisories. The 4.1.1 repair candidate requires and locks SDK 1.32.1; [repair evidence](SDK_SECURITY_REPAIR_2026-10-21.md). Fresh 4.1.0 installs and the verified public 4.1.0 MCPB already use 1.32.1. | Complete source, package and hosted gates, then verify every public 4.1.1 destination. Candidate metadata is not publication proof. |
| Distribution and adoption | [Awesome MCP PR #15490](https://github.com/punkpeye/awesome-mcp-servers/pull/15490) remains open on October 21. [Glama](https://glama.ai/mcp/servers/devag7/linkedin-mcp) still shows older 4.0.0 installation instructions and generic hosted deployment copy. Its [Admin page](https://glama.ai/mcp/servers/devag7/linkedin-mcp/admin) requires the repository owner's GitHub sign-in for claiming/re-sync. The [private traffic ledger](ADOPTION_TRAFFIC_LEDGER_2026-10-19.md) now records 12 stars, +2 since October 19; first-use remains 0/0. | Owner signs into Glama and requests re-sync, then corrects editable fields and seeks platform correction for generated hosted copy. Capture traffic weekly and consented first-use/repeat-use outcomes separately. 10,000 stars and GitHub Trending daily are targets, not guaranteed milestones. |

An older external [Dockerfile PR #2](https://github.com/devag7/linkedin-mcp/pull/2)
also remains open. Its submitted diff removes the `builder` stage while still
copying from it, and predates the current experimental Docker recipe. It is
not a 4.1.0 release gate or a verified hosted deployment path; review any
container work against current source as a separate change.

## Next sequence

1. Complete the SDK patch gates and public readback. A participant can then
   choose to start the already pinned 4.1.0 study under its own consent; do not
   silently change its version or combine a future patch-version cohort.
2. Use the first real observed onboarding failures to prioritize fixes. Treat
   PR #5, complete erasure, provider access and application submission as
   independent gates; none is a prerequisite to truthfully distributing 4.1.0.

No mandatory paid service is needed for the local release or this evidence
work. User-supplied hardware, Chrome, client access and any future approved
provider or hosting arrangement remain separate prerequisites.
