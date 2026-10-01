# LinkedIn MCP: current gaps and zero-cash roadmap

**Audit date:** 2026-10-01 (Asia/Kolkata)  
**Purpose:** Update the original [product and technical roadmap](../PRODUCT_TECHNICAL_ROADMAP_2026.md) using the current local checkout and remote repository. The original roadmap is retained unchanged. This is a planning and verification document, not a claim that unreleased work is available to npm users.

## Decision in one page

The project can advance without paid hosting, paid proxies, paid analytics, paid ads, paid LLM APIs, or paid test accounts. Use the maintainer's local machine, the public repository's standard GitHub Actions runners, public npm, the MCP Registry, documentation, and consenting volunteer feedback. These have **no required direct cash cost under the cited public-project terms as checked today**, although they require substantial maintainer time and terms may change. Never make a paid account or service a dependency for the core product.

The highest-value next work is **integration and proof**, not another batch of tools. The 397-test local implementation is still uncommitted and unreleased; `origin/main` contains a later messaging PR that overlaps the local edits. Reconcile that PR, review and preserve the cumulative work, clear dependency advisories, repair release retry behavior, run hosted CI, then publish a version only after its gates pass. Current live LinkedIn compatibility and user onboarding success remain unmeasured.

The 10,000-star ambition remains possible as a long-term community goal, not an engineering acceptance criterion. A paid campaign is not required, and no forecast can promise the result. The public repository currently reports **10 stars** through the GitHub API; the published npm version is **2.0.3**. Remote source still lacks the local roadmap implementation.

## 1. Evidence snapshot

| Check | Observed 2026-10-01 | Meaning |
| --- | --- | --- |
| Local tests | 397/397 passing across 20 suites, run again for this audit. | The tested local cases pass. No real LinkedIn request was made. |
| Other local gates | `lint`, `typecheck`, `metadata:check`, and `build` pass. | Source and metadata are internally consistent in this checkout. |
| Previous package proof | [Progress report](ROADMAP_PROGRESS.md) records a clean install and fresh packed artifact passing. | Credible local evidence; hosted OS/browser/client proof is still needed. |
| Local Git state | `HEAD` is `1b4a4c8`; 79 modified/untracked paths were present at audit. | Cumulative work needs a safe review/commit strategy. Preserve unrelated `pr_diff.txt`. |
| Remote Git state | `origin/main` is `e368b61`, **three commits ahead** of local `HEAD`. The merged PR #1 changes messaging endpoints, normalization, discovery and tests. | Do not publish or rebase blindly; reconcile overlapping files and rerun gates. |
| npm | `npm view linkedin-mcp-tools version` returns `2.0.3`. | Users of `@latest` do not have this local implementation. |
| Dependencies | Production audit reports 6 affected packages: 2 high, 3 moderate, 1 low. Both high cases are transitive through the MCP SDK. | Triage and update the lockfile before release; an advisory does not by itself prove this application is exploitable. |
| Registry | Local `server.json` schema/metadata checks pass; a live Registry lookup timed out during this audit. | Do not claim current Registry listing or new-version publication without a successful live lookup/job. |

Sources for current remote and package context: [GitHub repository](https://github.com/devag7/linkedin-mcp), [npm package](https://www.npmjs.com/package/linkedin-mcp-tools). Local commands and files above are the evidence for checkout-specific claims.

## 2. What is already implemented locally

The previous session's [coverage report](ROADMAP_COVERAGE.md) is broadly consistent with this checkout. Treat these as **local implementation**, not released or live-verified features:

- Authenticated loopback HTTP with bounded requests and a shared runtime.
- Persisted checkpoint stop, account binding, profile ownership, atomic shared budgets, and conservative write journaling.
- Write preview/confirmation and `unknown` outcome handling; writes disabled by default.
- Native structured results/output schemas for all 22 registered tools, bounded read pages, and explicit partial/unsupported continuation states.
- Offline doctor, generated capability metadata, packaged-install checks, and user workflow guides.
- Detailed coverage, privacy, first-use validation, and distribution documents.

The previous result's **397 passing tests** was reproduced. Local success does not establish that Voyager routes, page extraction, client applications, or account behavior work today.

## 3. Missing work against the original roadmap

| Priority | Gap now | Free path to close it | Proof of completion |
| --- | --- | --- | --- |
| **P0** | Reconcile remote PR #1 with the cumulative local implementation. The remote fix percent-encodes parentheses in `msg_conversation` URNs and adds sender-attributed, sorted messaging output; the local endpoint still uses plain `encodeURIComponent`. | Preserve a recoverable snapshot/branch of the local changes. Integrate the three remote commits carefully into `src/browser/endpoints.ts`, `normalize.ts`, `discovery.ts` and contracts; import their tests. | Combined branch passes all source/packed gates; a full conversation URN produces an encoded query and message schemas represent the new fields. No local safety behavior is lost. |
| **P0** | Local implementation is not reviewed, committed, released, or installed by normal users. The review plan exists but has not been executed. | Split by [review boundaries](REVIEW_PLAN.md), use GitHub PRs and public standard CI, record each gate. Do not push a version bump until publication is ready. | Reviewable commits/PRs merged; versioned package and docs match; release verification is linked. |
| **P0** | Production dependency audit: 6 affected packages, including high-severity `fast-uri` and `ip-address` versions pulled through `@modelcontextprotocol/sdk@1.29.0`. Other affected packages are `@hono/node-server`, `body-parser`, `hono`, `qs`. | Use `npm audit` and `npm explain`; update compatible locked dependencies, then all gates/packed proof. If a package cannot be safely updated, document actual reachability and a time-bound mitigation. No paid scanner is needed. | New production audit output and reviewed dependency diff. Do not use an unreviewed `npm audit fix --force`. Examples of upstream advisories: [fast-uri](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx), [ip-address](https://github.com/advisories/GHSA-mwp4-54f8-5fhr). |
| **P1** | Hosted Node 20/22 × Linux/macOS/Windows matrix is configured but not yet observed for these local changes. Actual Chrome launch/cleanup and real client applications are also unverified. | Run public repository GitHub Actions standard runners; test Chrome launch/close without a LinkedIn account where possible. Ask consenting users for one first-read test on their own device. | Links to passing/failing hosted runs, actual browser lifecycle logs without secrets, and a dated client/OS support table. [Public standard Actions runners are free](https://docs.github.com/en/billing/concepts/product-billing/github-actions). |
| **P1** | Current endpoint, locale and account-state compatibility is unknown. Capability dates are intentionally `Unchecked`. | Obtain only consented, redacted captures from people already using the project; build sanitized fixtures and record route/date/account-state provenance. Keep normal CI offline. | Each claimed live route has a dated result and failure mode; unsupported paging stays unsupported until captured. |
| **P1** | First-use success, workflow completion, and repeat use have not been measured. | Use [the volunteer protocol](FIRST_USE_VALIDATION.md), GitHub Discussions/issues, and voluntary aggregate reports. No hosted analytics or raw LinkedIn data collection. | Sample size, 15-minute first-read result, failure-stage breakdown, and follow-up reuse counts are reported with limits. |
| **P1** | Release workflow creates the GitHub release/tag **before** npm publish. If npm publishing fails, the next run sees the tag and skips publication; the Registry job is also `continue-on-error`, so discovery failure can remain unnoticed. | Make the release workflow retryable and idempotent per destination, verify npm publication before marking the release complete, and surface Registry failures in a visible issue/job summary. Test with a dry-run or isolated workflow branch; do not publish from the audit. | A failed npm or Registry step can be retried safely without manufacturing another version; an actual release proves all expected destinations. |
| **P1** | Full coordinated erasure of shared safety/journal state is still manual. | Build a local CLI dry-run showing exact paths/account scope and blocking active owners. Deletion requires explicit user choice and preserves uncertain-operation warning. No cloud service. | Tests for multiple profiles, concurrent owners, ambiguous writes, and cross-platform paths; [privacy docs](PRIVACY.md) match behavior. |
| **P2 / optional** | Official provider is a design and an unavailable mode, not an adapter. | Keep browser mode as the usable open-source core. Implement official OIDC/self-service publishing only if the maintainer independently obtains a permitted developer app and grants. No paid partner product is required by the core roadmap. | Granted scopes and approved API calls verified; unsupported reads remain unavailable. LinkedIn's [API access rules](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) limit the available functions. |
| **Outcome, ongoing** | No release-driven adoption, Registry listing, community response, or star-growth evidence yet. | Publish accurate docs and a reproducible demo after release; use free GitHub Discussions, issue labels, README examples, Registry/directory listings, and maintainer-written technical posts. | Monthly first-use/reuse/support/referral/stars report. Never substitute star count for useful repeat usage. |

### Cost policy for every PR

The core path may use local Node/Chrome, public npm, public GitHub standard Actions, GitHub Releases/Discussions/Pages if useful, and the public MCP Registry. Public npm packages are available without a paid plan: [npm public packages](https://docs.npmjs.com/about-public-packages/). Check each service's current terms before relying on it.

Do **not** introduce a mandatory hosted database, server, paid proxy, captcha service, residential IP provider, paid browser service, paid observability/analytics, paid CI runner, paid security scanner, paid LinkedIn tier, or per-call AI model. Optional integrations must leave the free local core independently usable. Never silently fall back from denied official API access to an unofficial browser action. Record expected cash cost (`$0 required` or `optional user-paid`) and ongoing maintainer burden in each feature proposal.

Maintainer time, a personal computer, network use, volunteers' time, and possible platform/account restrictions are real costs and risks even when direct cash spend is zero. No daily cap guarantees account safety: [LinkedIn prohibits unauthorized automated activity](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions).

## 4. Additional advances worth researching or building

These were **not fully covered in the original roadmap**. The order reflects user value and release risk, not excitement about new protocol features.

| Rank | Advancement | Why now / $0 implementation | Gate before claiming support |
| --- | --- | --- | --- |
| 1 | **Dependency and supply-chain hygiene.** Enable free public-repo CodeQL/Dependabot where available; pin or verify downloaded `mcp-publisher` artifacts. Replace long-lived `NPM_TOKEN` with npm trusted publishing and provenance after release workflow hardening. | npm [trusted publishing](https://docs.npmjs.com/trusted-publishers/) uses GitHub OIDC and requires npm CLI ≥11.5.1 and Node ≥22.14.0; current release job uses Node 20, so migration needs a controlled job change. [GitHub code scanning is available for public repositories](https://docs.github.com/en/code-security/getting-started/github-security-features). | CI demonstrates signed/provenance-backed publication, no token fallback, and a repeatable rollback. Do not edit credentials in chat or docs. |
| 2 | **MCP SDK v2 compatibility spike.** The project locks the v1 SDK at 1.29.0. The official TypeScript SDK v2 supports the final 2026-07-28 protocol and has a migration guide. | Create an isolated branch or fixture server; compare current clients, structured outputs, cancellation, transport, and tool annotations. Preserve 2025-era compatibility. This is code/time cost only. Sources: [SDK v2](https://github.com/modelcontextprotocol/typescript-sdk), [migration guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/upgrade-to-v2.md), [2026 protocol](https://blog.modelcontextprotocol.io/posts/2026-07-28/). | A conformance/compatibility matrix passes for target clients; no forced SDK upgrade in the first security release. |
| 3 | **Local review UI for writes.** An optional MCP App or local-only page could display exact post/message target and body before approval, using the existing journal and zero hosted infrastructure. | Helps users understand irreversible effects. MCP Apps are part of the 2026 MCP ecosystem, but host support and sandbox behavior vary. Start with a CLI/fixture prototype and security review. | Tested with at least one supporting host; no implicit approval, secret leakage, or remote browser exposure. [MCP 2026 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/). |
| 4 | **Portable, local research exports.** User-triggered Markdown/JSON export of selected job/company/profile results with URLs, timestamps, partial-state markers and deletion guidance. | Makes the product useful outside a chat without cloud storage. Avoid background archiving or broad personal-data retention. | Export is bounded, user-selected, redacted where appropriate, and covered by privacy docs. |
| 5 | **Free protocol conformance and client demos.** Add a version-pinned MCP conformance check and a small fixture-backed demo for each supported client. | Makes compatibility claims reproducible and improves discoverability. The MCP project publishes [conformance resources](https://plan.modelcontextprotocol.io/conformance). | CI time remains reasonable and tests use no LinkedIn account; client docs include exact version/date. |

Do not prioritize Tasks, remote hosting, autonomous multi-step research, bulk messaging, or additional write endpoints until the release, live-read, and first-use gates are met. New MCP features should solve an observed user problem and preserve the local cost model.

## 5. Recommended zero-cash execution order for Codex

1. **Protect and reconcile.** Preserve all local modifications in a recoverable branch/snapshot; integrate `origin/main` PR #1 without dropping safety/contract changes; import the remote tests and rerun all gates. Do not delete or overwrite `pr_diff.txt`.
2. **Triage dependency advisories.** Update compatible transitive packages and lockfile, explain any remaining advisory's actual application reachability, and verify package output.
3. **Make release retryable.** Repair tag/npm/Registry ordering and inspect the `curl | tar` publisher download. Prefer free OIDC trusted publishing when prerequisites can be met; otherwise keep a narrowly scoped current token until the new flow is proven.
4. **Split and review the cumulative changes.** Follow [REVIEW_PLAN.md](REVIEW_PLAN.md). Run standard public hosted CI and the packed install check on each review boundary. Keep live LinkedIn tests separate and consented.
5. **Publish a verified version.** Confirm npm, GitHub Release, and Registry independently; verify the installed package exposes the new behavior. Do not assume that a successful local build changes `@latest`.
6. **Validate the product with volunteers.** Run first-read tests and route-specific captures with explicit consent. Update the capability inventory from evidence and report failures honestly.
7. **Grow through useful free artifacts.** Demonstrate one problem solved per guide/release, answer issues, invite contributions through normal GitHub channels, and review aggregate adoption monthly. Defer optional official/API/UI expansion until users confirm its value.

### Ready-to-paste first task

> Read `AGENTS.md`, `PRODUCT_TECHNICAL_ROADMAP_2026.md`, `docs/ROADMAP_COVERAGE.md`, `docs/REVIEW_PLAN.md`, and `docs/ZERO_COST_GAP_AUDIT_2026-10-01.md`. Preserve the cumulative uncommitted changes and `pr_diff.txt`. Reconcile the merged messaging changes in `origin/main` (`e368b61`) with the local safety/contract implementation, including the conversation-URN encoding fix and the new message attribution tests. Do not publish, bump the version, run live LinkedIn writes, or add paid dependencies. Run lint, typecheck, all tests, metadata check, build, and packed-install verification. Report the merged behavior, exact test results, remaining conflicts, and a reviewable diff before moving to the next backlog item.

## 6. What this audit does not establish

- No real LinkedIn session, endpoint, browser login, write, checkpoint, or client-app interaction was run here.
- A local passing suite does not prove an endpoint works on LinkedIn today or that users can install the package easily.
- The Registry lookup timed out; current listing state is unverified.
- Security advisories are dependency findings. Exploitability in this server needs route-level analysis; update and test them regardless.
- The 10,000-star target has no evidence-based deadline or guarantee. Free distribution can work, but it still needs sustained developer support and user value.
