# Job seeker product and Claude distribution decision

**Research date:** 2026-10-16. **Baseline:** main `787e5bf` after PR #31;
published npm `linkedin-mcp-tools@4.0.0`. This document is a product and
implementation plan, not evidence of LinkedIn application or Claude directory
acceptance. Provider rules and Claude submission requirements can change; recheck
the linked primary sources before release or submission.

**October 18 release update:** [4.1.0 is published](RELEASE_EVIDENCE_4.1.0.md)
with 24 tools, including the offline application worksheet and user-entered
tracker CSV. This updates the source-only classification below. The local
Claude Desktop bundle passed Mac/Windows offline checks, its source
merged through [PR #37](https://github.com/devag7/linkedin-mcp/pull/37),
and one [native Mac cold check](evidence/claude-native-4.1.0-2026-10-18.md)
passed. The exact unsigned bundle and checksum are
[GitHub Release assets](https://github.com/devag7/linkedin-mcp/releases/tag/v4.1.0).
Directory listing and live account compatibility remain separate gates. Current
[directory policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
appears to require ownership/control of the connected LinkedIn interface,
which this project cannot claim.

**Source progress, October 17:** PR #32 merged tool titles and the Claude
distribution assessment. PR #33 merged the offline
`prepare_job_application` worksheet; it accepts only user-provided listing and
resume evidence, fetches nothing, stores nothing and always reports
`submitted:false`. PR #35 merged `export_application_tracker`, which formats up
to 50 user-entered application statuses as a CSV without server persistence or
inferred submission. Both tools were subsequently published in 4.1.0.

## Executive decision

The product does **not** fill or submit job applications, including LinkedIn
Easy Apply. Its released live job-read tools are `search_jobs` and `get_job_details`;
`research_jobs` is still outside the release. No saved-job, application-history,
resume-upload, question-answering, form-fill or submit tool is registered. The
current job contracts return job facts and a source URL, not a verified Apply
method or application form. `get_job_details` rejects unbound job identity, so
an apparently similar response cannot be attached to the requested posting.

The valuable near-term product is **application preparation with a human final
submit**: find and compare jobs, show attributed facts and missing facts, help
the person draft truthful tailored material from information they deliberately
provide, then hand off to the original listing. No application-success claim
is made until the person confirms an employer/LinkedIn receipt. This keeps the
local product free to run and avoids building a brittle multi-step submit bot.

Do not advertise this project as a Claude **web connector** or a listed Claude
connector today. It is a local stdio server backed by a user-owned browser.
Claude's directory connector path requires a public HTTPS remote MCP server,
appropriate per-user OAuth, reliable tool tests, and legitimate control of or
permission to proxy the underlying API. A public proxy of users' browser
profiles would create privacy, security, platform-permission and ongoing-hosting
obligations the present architecture does not satisfy. A **local** Claude
Desktop configuration is already generated offline; native app acceptance and
end-to-end use still need measured testing. A local plugin or desktop extension
is a separate distribution track, with surface and review limits below.

## Source-backed application reality

| Flow | What LinkedIn says | Product implication |
| --- | --- | --- |
| Easy Apply | The member completes popup screens, reviews, then selects Submit application. A submitted LinkedIn application cannot be edited or withdrawn in the normal flow. [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a512388/apply-for-jobs-on-linkedin) | Never treat opening or filling as completion. Keep a person at the final review/submit step. |
| Apply | The button can redirect to an employer or job-board website. [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a511260/linkedin-help-center) | No universal form schema, account, attachment or submission receipt. Hand off to that site. |
| Rate/behavior limits | LinkedIn describes daily and speed limits intended to curb bots and inauthentic submissions. [Easy Apply limits](https://www.linkedin.com/help/linkedin/answer/a8068422) | No bulk apply, automatic retry, hidden pacing bypass or success guarantee. |
| Official integration | Apply Connect APIs are for approved ATS/LinkedIn partners receiving applicant submissions and managing jobs; they are not a general job-seeker submit API. [Apply Connect overview](https://learn.microsoft.com/en-us/linkedin/talent/apply-connect/), [partner restriction](https://learn.microsoft.com/en-us/linkedin/talent/apply-connect/create-configure-customer-application) | Do not call the partner webhook or job-posting endpoints a candidate Easy Apply API. |
| Platform permission | LinkedIn's [User Agreement](https://www.linkedin.com/legal/user-agreement) restricts unauthorized bots, scraping and bypassing limits. | A user asking for automation does not itself grant LinkedIn's authorization. Any future integration needs a separately validated permitted route. |

## Product requirements (PRD)

**Audience:** individual job seekers using their own local MCP client. Core job:
make a small number of better-informed applications with less repeated work.
Secondary audience: career coaches operating only with a person's informed
consent. No recruiter bulk-contact or application-farm positioning.

| Priority | User outcome | Current state | Acceptance before claiming shipped |
| --- | --- | --- | --- |
| P0 | Know exactly what a listing says, when it was fetched, and what is unknown | `search_jobs`, strict `get_job_details`, source links; live availability may be partial | Offline contracts plus consented current provider/first-use evidence; no fabricated pay, remote status or deadline |
| P0 | Compare two selected roles and open the original listing to apply manually | Bounded recipe in `WORKFLOWS.md` | A new user completes the flow in a native client and can distinguish Easy Apply from external Apply at the original site |
| P1 | Create a truthful application worksheet from user-provided resume facts and a selected source-linked job | Published 4.1.0 `prepare_job_application`; no live or native-client proof | Local-only draft; explicit evidence/missing-field columns; no invented credentials; no default persistence or resume telemetry; exact job identity and prompt-injection tests |
| P1 | Track saved, applied and follow-up states without losing provenance | Published 4.1.0 `export_application_tracker`; no server persistence | User-entered local records/export; separate `interested`, `drafting`, `submitted_unverified`, `receipt_verified`, `rejected`, `withdrawn`; no inferred submission. Persistent storage remains deferred until privacy, concurrency, inventory and erasure are designed and tested. |
| P1 | Reuse a tailored resume and cover-letter draft safely | Not built | User-supplied inputs only, reviewable text, no automatic upload, clear retention and deletion behavior |
| P2 | Job alerts, richer filters, saved jobs and application history | Not built | Verified route/shape and permission for each provider read; bounded paging, duplicate/empty/partial handling and current live evidence; no endpoint guesses |
| P2 | Interview and follow-up preparation | Only general company/profile reads | User-selected sources, citations and dates; no fabricated recruiter contact or automatic messages |
| Deferred | Fill or submit LinkedIn Easy Apply or external ATS forms | Not built | Validated permitted integration, field/attachment mapping, per-job explicit approval, idempotency/unknown-outcome design and actual receipt proof. No generic submit tool or bulk flow. |

**Measures:** first completed source-linked comparison; worksheet usefulness
from consenting users; time saved without increasing incomplete/false claims;
native-client first-use success; opt-in repeat use. Count every first started
attempt, including failures. `0/0` is unmeasured. Stars, 10,000 stars and GitHub
Trending daily are distribution outcomes to observe, not release gates or
promises. Publish honest demos rather than claim automatic applications.

## Technical requirements (TRD) and sequence

1. **Extend native Claude Desktop proof.** A temporary 4.0.0 `.mcpb` install,
   22-tool discovery and cold `whoami` passed on one Mac, then the extension was
   removed. The generated stdio config and first real read remain unverified in
   that native client. Keep tokens, cookies, paths and profile content out of
   public receipts.
2. **Application worksheet, offline first.** Add a pure function/tool taking a
   user-selected job ID/source facts and user-supplied resume facts. Return
   `known`, `needs_user_answer`, `unsupported_or_unverified` and draft fields,
   each with provenance. Reject source/job mismatch. Treat listing text as data,
   never instructions. Do not store raw resumes or send them to the provider.
3. **Local application tracker.** Start with an export-only formatter so the
   user controls retention and private storage. A later server-owned tracker
   would use a versioned private on-disk schema under
   the existing state guard, exact selected-profile isolation and atomic writes.
   Record only user-chosen job ID/URL, status timestamps and optional notes.
   No hidden analytics, cloud account, auto-discovery or inferred success.
   Include the tracker in inventory, selected retirement and later coordinated
   erasure design **before** enabling persistence.
4. **Route-backed reads only after evidence.** Capture saved jobs, filters or
   application history with a separate bounded read protocol. Verify identity,
   pagination and current response shapes; reject ambiguity. Keep read budgets
   and cleanup gates. Do not use the old draft job brief as proof of live value.
5. **Submission only through an authorized integration.** For any future
   application action, create distinct prepare/review/submit operations. Require
   an exact per-job preview, explicit human approval, one submission, durable
   operation ID, and `unknown` on ambiguous outcomes. Never retry an unknown
   submission automatically. If no permitted route exists, leave submit to the
   person in the browser.

**Estimated maintainer work:** offline worksheet 3–5 days; tracker 1–2 weeks
including privacy/erasure; native Claude checks 1–2 days with the app; each
provider read 3–6 days after authorized shape evidence, plus ongoing endpoint
maintenance. These are planning estimates, not completion claims. Required
hosting spend for local features: **$0**. User-provided Claude access and
optional services may have their own cost; a public remote service has ongoing
operational cost even when a free tier exists.

## Claude routes and exact listing steps

| Route | Works where | Current status | Cost/constraint |
| --- | --- | --- | --- |
| Existing local stdio config | Claude Desktop on the user's machine | `--setup claude-desktop` exports it; native import/use unverified | No project hosting bill; each user supplies Node/Chrome and their Claude access. [Claude local/remote distinctions](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors) |
| Local desktop extension (`.mcpb`) | Claude Desktop | The [4.1.0 unsigned bundle](https://github.com/devag7/linkedin-mcp/releases/tag/v4.1.0) pins the public npm archive; hosted Mac/Windows offline checks and one native Mac 24-tool/cold-`whoami` install and removal passed. No live account read was tested. | Could simplify installation. See [bundle evidence](CLAUDE_DESKTOP_BUNDLE_2026-10-17.md); current [connector guidance](https://claude.com/docs/connectors/building/submission) excludes standalone local MCPB from its portal while [Desktop help](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop) links a separate submission form. Current directory policy is an apparent additional blocker. |
| Local plugin bundle | Claude Code and Cowork local runtime, not ordinary Claude chat | Not built; Chrome/profile behavior in each runtime unverified | [Claude surface support](https://support.claude.com/en/articles/13837440-use-plugins-in-claude); paid Claude plan required to submit a directory plugin. |
| Remote custom connector | Claude web, Desktop, mobile and other hosted surfaces | Not supported by this local-only architecture | Public HTTPS server reachable from Anthropic, secure per-user auth, user-specific data isolation, verified operation and ongoing hosting. [Claude custom connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp) |
| Remote directory connector | Same hosted surfaces, listed in Claude | **Blocked**, not ready to submit | [Official checklist](https://claude.com/docs/connectors/building/submission): HTTPS, OAuth for account actions, title/hints, docs/privacy/support, populated reviewer account, real Claude tests. [Review criteria](https://claude.com/docs/connectors/building/review-criteria) require own or legitimately proxied APIs. |

For the remote directory path, the owner would: (1) establish a permitted
first-party or partner data provider and public HTTPS MCP architecture; (2)
implement per-user OAuth, least-privilege scopes, revocation and isolation;
(3) add accurate tool titles/annotations and test every advertised tool in a
real custom connector; (4) publish privacy, support and setup documentation,
and create a legitimate populated reviewer account; (5) submit at
[`claude.ai/directory/manage`](https://claude.ai/directory/manage) using a
**paid Claude plan**, choosing MCP connector, then complete Connection, Tools,
Listing, Use cases, Company, Authentication, Data handling, Test & launch,
Compliance and Review. Anthropic controls acceptance and visibility. [Current
portal instructions](https://claude.com/docs/connectors/building/submission).
The existing unofficial LinkedIn browser path does **not** clear step 1; a
public proxy and synthetic reviewer account must not be represented as
authorized LinkedIn access.

PR #32 added human-readable `title` metadata to the original 22 tools and
marked local `close_session` as a state-changing action. PR #33 added the
worksheet; PR #35 added the tracker export. Both shipped in 4.1.0. These
changes do **not** make this server a remote Claude connector or prove
directory acceptance.

## Original release gates and owner decisions

These were written before 4.1.0 publication. The worksheet and tracker now
ship; use the [current completion index](CURRENT_COMPLETION_STATUS_2026-10-18.md)
for remaining native, first-use and distribution work.

- Run local tests, lint, types, metadata and build; verify published-package
  installation separately from this source branch.
- Review the docs and tool metadata as a small PR. No application submit route,
  LinkedIn access, personal-data storage, Claude directory submission or paid
  hosting is part of this change.
- Next product implementation: publish the reviewed source-only worksheet and
  tracker in a versioned package, then test that exact package in Claude
  Desktop. Any account read requires its own specific test scope. Do not claim
  10,000 stars or Trending from readiness work alone.
