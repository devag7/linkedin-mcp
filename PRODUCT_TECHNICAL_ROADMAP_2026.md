# LinkedIn MCP: product, technical, and growth roadmap

**Research snapshot:** 2026-09-30  
**Repository:** [devag7/linkedin-mcp](https://github.com/devag7/linkedin-mcp)  
**Local revision reviewed:** `1b4a4c8` (`package.json` v2.0.3)  
**Purpose:** A decision document and execution brief for Codex. This document proposes work; it does not claim that the proposed features are shipped.

## 1. Executive decision

Build the most trustworthy **local, user-controlled LinkedIn MCP** for research and carefully reviewed actions. Win on dependable results, installation, transparent capability status, and privacy, rather than on the number of tools or promises of undetectable automation. In parallel, build an **official-API adapter** for the limited capabilities LinkedIn actually grants to ordinary developer applications. Keep the unofficial browser path clearly labeled and optional.

The 10,000-star goal is a **distribution outcome**, not a product requirement that code alone can guarantee. The repo had **10 stars** on the research date. A leading browser-based competitor had approximately **3.7k stars** and substantially more community activity. Reaching 10k will require a product that people recommend, a much wider audience than one MCP directory, sustained releases, documentation, demos, and support. Measure actual setup success and recurring use before treating stars as proof of value. Sources: [this repository](https://github.com/devag7/linkedin-mcp), [stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server).

**Do first:** harden HTTP, connect the circuit breaker to real responses, fix write accounting, clarify capability claims, and make setup reproducible. **Then:** improve read workflows, response contracts, compatibility, and the contributor experience. **Only then:** invest in broader distribution and advanced adapters.

## 2. Facts, assumptions, and constraints

### Verified baseline

| Area | Current state / evidence | Implication |
| --- | --- | --- |
| Product | 22 MCP tools: profiles, discovery, feed, inbox, session, and five gated writes. `src/server.ts`, `src/tools/*`. | There is already a useful surface. More tools alone are a weak differentiator. |
| Core path | Patchright persistent Chrome profile; in-page requests to LinkedIn's undocumented Voyager endpoints. `src/browser/engine.ts`, `src/browser/voyager.ts`. | Structured results are valuable, but endpoint churn and platform blocking remain fundamental risks. |
| Distribution | npm package, stdio and optional HTTP, MCP Registry release job, Docker files. `package.json`, `src/transports/*`, `.github/workflows/release.yml`. | Installation and safety can be improved without inventing a new architecture. |
| Safety | Queue, pacer, persisted budgets, circuit breaker, `confirm:true` writes. `src/safety/*`, `src/browser/guard.ts`. | Good primitives exist, but some are not integrated into production behavior. |
| Tests | Local audit: lint, typecheck, and build passed. In this run, 165 tests passed while `tests/tools.test.ts` failed during Patchright import with `Cannot read properties of undefined (reading 'playwright')`; full test gate therefore **did not pass**. | Reproduce in a clean install/CI and fix before marketing a green suite. The README's “166 tests” is a repository claim, not the result of this audit. |
| Documentation | README v2 is detailed; `SECURITY.md`, `CONTRIBUTING.md`, issue templates, and `server.json` still contain v1 or stale information. | Contradictions undermine trust and contributor onboarding. |

### External constraints

LinkedIn says third-party software that scrapes or automates activity on its site is prohibited and can lead to restriction or shutdown. There is no evidence-based “safe daily number”; pacing and caps cannot make an unauthorized workflow compliant. See [LinkedIn's prohibited software guidance](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions) and [User Agreement](https://www.linkedin.com/legal/user-agreement). This is a product and legal risk for users and maintainers, not just an engineering failure mode.

LinkedIn's official APIs use OAuth and permissions. Open self-service access covers sign-in identity and `w_member_social`; many read, organization, sales, and talent permissions require approval. The official Posts API supports several media types, but specific scopes and product access control each operation. Do **not** describe an official adapter as feature parity with Voyager. Sources: [Getting Access to LinkedIn APIs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access), [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api).

The MCP specification supports `structuredContent` and output schemas. The current server returns JSON inside text blocks, so clients can read it but do not receive the protocol's native structured result. Source: [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

### Assumptions to validate

1. Primary users are individual developers and job seekers doing **read-heavy** research, followed by creators who want reviewed publishing. Validate through interviews and opt-in feedback; do not assume sales prospecting is the best or safest wedge.
2. Users value local operation and data control enough to tolerate a browser login. Measure setup completion and first successful tool call.
3. An official-API track can attract users who need authorized publishing, even if it has fewer tools. Validate demand and feasibility before building a large adapter.
4. A 10k-star outcome requires a broader “professional graph for AI assistants” story, while maintaining accurate LinkedIn-specific claims. Test messaging, do not rename or broaden the product without evidence.

## 3. Market and positioning

### Competitive snapshot, 2026-09-30

| Project / route | Observed offer | Lesson for this repo |
| --- | --- | --- |
| [stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server) | Approximately 3.7k stars; broad local browser tool set, browser-session import, MCP bundle, Docker, cross-process browser coordination, active issues/PRs. | The incumbent already owns “LinkedIn MCP with many tools.” Differentiate with correctness, precise contracts, trust, setup, and a viable official path. Avoid unsupported claims that competitors are universally brittle. |
| [eliasbiondo/linkedin-mcp-server](https://github.com/eliasbiondo/linkedin-mcp-server) | Approximately 192 stars; search, profiles, companies, jobs. | Read-only tools remain a recognizable demand category. |
| [gohyperdev/linkedin-mcp](https://github.com/gohyperdev/linkedin-mcp) | Official OAuth route focused on publishing and media. | Publishing via approved APIs is a real alternative, but scope is narrower and developer-app setup is heavier. |
| This repo | 10 stars; 22 tools and in-page JSON path with gated writes. | Need evidence of dependable user outcomes, clear limitations, and a distribution engine. |

**Positioning statement:** “A local LinkedIn MCP for structured professional research and explicitly reviewed actions, with honest status and account-risk controls.” On official-API capable actions, label the route and granted scope. On browser actions, state that the integration is unofficial and can stop working.

### What makes users recommend it

- **First-use success:** a doctor command that explains Chrome, login, session health, MCP config, and the next action in plain language.
- **Predictable output:** stable result schemas, pagination, source/freshness metadata, and distinguishable `unsupported`, `empty`, `partial`, `blocked`, and `failed` states.
- **Safe control:** writes presented for review, bounded by policy, deduplicated where possible, and never auto-retried after an ambiguous network result.
- **Useful workflows:** job research, company research, professional profile summaries, inbox triage, and creator publishing, demonstrated end to end rather than as a tool inventory.
- **Honesty:** a public capability matrix distinguishing unit-tested, fixture-tested, live-verified, limited, and experimental operations.

## 4. PRD: product requirements

### 4.1 Users and jobs to be done

| Persona | Job | First workflow to support |
| --- | --- | --- |
| Job seeker | Compare opportunities and understand companies before applying. | Search jobs → inspect details/company → export a short, source-linked research summary. |
| Recruiter / researcher | Find relevant public professional information for human review. | Search people → inspect profiles → present a bounded, deduplicated shortlist. |
| Creator | Draft and review a post, then publish once with a clear outcome. | Compose locally → preview audience/text → explicit approval → publish → return post URL or an honest unknown status. |
| Developer / MCP maintainer | Integrate dependable LinkedIn data into an assistant. | Install → doctor → sample call → schema/contract tests → diagnostics without secrets. |

### 4.2 Release scope

**In scope, next two quarters:** security and safety fixes; diagnostic setup; schemas and pagination; endpoint compatibility fixtures; accurate docs; approved official identity/publishing where feasible; examples and community process.

**Out of scope for now:** mass outreach, auto-engagement, bulk harvesting, multi-account farms, captcha solving, evasion claims, hidden cloud collection of LinkedIn data, and unattended write campaigns. These do not serve the chosen trust position and increase account and privacy risk.

### 4.3 Functional requirements and acceptance criteria

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| P-01 | One-command diagnosis | `linkedin-mcp --doctor` reports package/Chrome availability, profile permission state, login/API result, selected transport, and actionable next steps. No cookie, profile content, or token appears in output. Works on macOS, Windows, Linux fixtures. |
| P-02 | Explicit capability inventory | `whoami` or a dedicated capability tool returns each operation's route, verification level, required permission, and last-known check date. Unknown availability is shown as unknown. README uses the same source of truth. |
| P-03 | Consistent read response | Every read has a typed `data`, `meta` (`source`, `fetchedAt`, `partial`, optional `nextCursor`), and a documented error code. Native MCP `structuredContent` is supplied while retaining text for compatibility. |
| P-04 | Bounded search | People, jobs, companies, posts (if added) support stable page size and cursor/offset as available; enforce maximum result and call budgets; disclose partial pages. No implicit crawl. |
| P-05 | Reviewed writes | A write exposes exact target, content, route, and effect for approval. An approved call has an operation ID and returns `ok`, `duplicate`, `already_connected`, `restricted`, `quota_exhausted`, `not_allowed`, `failed`, or `unknown`. Never silently reinterpret `unknown` as success. |
| P-06 | Account stop signal | A checkpoint, captcha, unusual activity page, HTTP 999, or challenge HTML hard-opens the breaker across tool calls and restart, blocks further data/action calls, and tells the user to resolve it manually. |
| P-07 | Safe local HTTP | HTTP is disabled unless explicitly selected, binds to loopback by default, validates origin, authenticates callers if exposed beyond loopback, enforces request size/time limits, and shares one browser/safety state per process. Security tests prove unauthenticated remote calls fail. |
| P-08 | Installation proof | CI exercises packed npm artifact and MCP initialize/list/call on Node 20 and 22, across major OS targets as feasible. Docs match tested install paths. |
| P-09 | Route-aware official mode | Official OAuth mode exposes only operations allowed by granted scopes; unsupported tools return a clear capability error. Browser mode remains opt-in and clearly marked as unofficial. |

### 4.4 Nonfunctional targets

These are **targets**, not current measurements. Instrument locally and publish aggregate results only with informed opt-in.

- Installation: at least 80% of volunteer testers achieve a first successful read within 15 minutes; track failures by step and OS.
- Correctness: at least 95% of fixture cases produce schema-valid output; no successful write status without a verified success signal.
- Security: zero unauthenticated HTTP tool calls in the test matrix; no credentials in logs, diagnostics, crash reports, or issue templates.
- Reliability: track tool-specific success and partial-result rates; set SLOs only after collecting a meaningful sample and excluding LinkedIn outages/challenges transparently.
- Maintenance: endpoint breakage yields a precise degraded status and a fixture/issue; no silent empty-array fallback for a broken endpoint.

## 5. TRD: architecture and concrete gaps

### 5.1 Existing data path

```text
MCP client → stdio or HTTP → tool registration → Guard
          → BrowserEngine (persistent Chrome) → in-page Voyager request
          → normalizer / write classifier → MCP text JSON response
```

The proposed design keeps this path but makes boundaries explicit:

```text
MCP adapter
  ├─ request context: caller, account, operation ID, deadline, cancellation
  ├─ policy engine: capability + confirmation + budget + breaker
  ├─ LinkedIn provider interface
  │    ├─ browser/Voyager provider (unofficial)
  │    └─ official OAuth provider (scope-limited)
  ├─ response normalizer: versioned schemas + provenance + partial state
  └─ diagnostics: redacted, opt-in metrics
```

### 5.2 Priority findings from this checkout

| Severity | Evidence | Change to make / proof required |
| --- | --- | --- |
| **P0** | `src/transports/http.ts` accepts POST `/mcp` without caller authentication, sends `Access-Control-Allow-Origin: *`, and listens with `httpServer.listen(port)`; it also calls `createServer()` per request. | Bind to `127.0.0.1` by default, validate `Origin`, reject unexpected hosts, add a documented authentication path for deliberate remote use, limit body size/time, and remove wildcard CORS. Share a single engine/guard or disable HTTP data tools until the state model is safe. Test hostile local webpage and unauthenticated LAN cases. |
| **P0** | `src/safety/circuit-breaker.ts` can classify hard challenge signals, but `src/browser/guard.ts` only soft-trips on `RATE_LIMITED` and `CLOUDFLARE_BLOCKED`; no production call to `breaker.classify()`/hard `trip()` was found. | Feed raw status, final URL, and bounded/redacted body signal into the breaker. On hard signal, persist global open and stop queued/future calls. Distinguish login expiry from checkpoint. Add integration tests through a tool call, not only unit tests of the classifier. |
| **P0** | `src/browser/guard.ts` records budget immediately after the raw POST returns; `src/tools/write.ts` classifies semantic status afterward. `voyagerPostRaw` returns non-2xx including 403/429. | Classify within the guarded operation and debit appropriately. Maintain separate attempted/successful/uncertain counters; count uncertain toward conservative safety limits, but do not count a known duplicate as a successful connection. Trip cooldown on returned 429/restriction. |
| **P0** | `src/server.ts` constructs `new BudgetTracker('default')` although the tracker is designed for account IDs; one persisted profile can be used by multiple processes. | Resolve a stable, non-secret account key after login. Prevent concurrent profile ownership and make check/reserve/commit atomic across processes. Fail closed if budget state is corrupt or unreadable; use atomic file replacement or SQLite with locking. |
| **P1** | `src/tools/write.ts` calls the new-thread message path “best-known” and states no clean 200 verification; `dedupeByClientGeneratedToken` is `false`. | Keep this path experimental until consented live verification on a controlled account. Add idempotency/operation journal, timeout ambiguity handling, and never automatically retry writes. |
| **P1** | `src/tools/session.ts` calls `engine.isLoggedIn()` before ensuring a browser context exists; `BrowserEngine.isLoggedIn()` returns false when the context has not been launched. | Make `whoami` distinguish `not_checked` from `logged_out`. Make `health_check` deliberately start a bounded session/probe and report the result without reading profile content into logs. Test a saved profile on a cold start. |
| **P1** | `src/tools/result.ts` puts JSON in a text content block only. | Add native `structuredContent` and output schemas with a versioned contract, preserve text for existing clients, test protocol compatibility. |
| **P1** | `src/transports/http.ts` reports health version `1.0.0`; `server.json` says `2.0.2` while `package.json` is `2.0.3`; `SECURITY.md` says supported version `1.x` and claims configurable CORS; `CONTRIBUTING.md` refers to `safeToolCall()`/`formatResult()` absent from v2. | Generate or validate version metadata in CI; refresh security, contributing, issue templates, and Docker claims against code. Remove misleading OAuth/cookie advice that describes the unused legacy path. |
| **P1** | `src/auth/*`, `src/client/*`, and `src/middleware/*` implement the old direct-fetch path but are not used by `src/server.ts`; `src/config/env.ts` still accepts their environment variables. | Either isolate as a separately tested official provider or remove from the shipped runtime/config. Avoid a “supports OAuth” claim until an MCP tool actually uses it. |
| **P1** | `README.md` and `DISCLAIMER.md` recommend a secondary or throwaway account; LinkedIn explicitly says fake accounts are prohibited. | Remove advice that implies creating a fake account. Explain the actual restriction risk and let users decide whether to use the tool within the rules applicable to their account. |
| **P1** | Local full test attempt failed in `tests/tools.test.ts` while importing Patchright; 165 tests passed, then the suite failed. | Reproduce with `npm ci`, isolate the import behavior, and require all four gates (`lint`, `typecheck`, `test`, `build`) to pass in a clean environment. Preserve exact CI logs. |
| **P2** | `src/server.ts` hardcodes `count = 22`; several endpoint comments mark paths and query IDs best-known or rotating. | Derive count/capabilities from registration; maintain endpoint manifest with fixture date, validation status, and automated contract checks. |

**Important nuance:** unit tests of a safety primitive establish its logic, not that real MCP calls reach it. The P0 rows above are integration issues. Avoid presenting numerical caps as a ban-prevention guarantee.

### 5.3 Write transaction design

1. Validate input and capability; reject unsupported or poorly verified routes before any browser action.
2. Create a local `operationId`, canonical target, payload hash, and human-readable preview. Never log the message/post body by default.
3. On explicit approval, acquire a per-profile lock; re-check breaker and budget **inside** the lock, then reserve an attempt.
4. Send exactly once. Classify response: verified success, known failure, or `unknown` (timeout/disconnect after submission).
5. Persist result and release lock. Repeated `operationId` returns prior result; an `unknown` result requires manual inspection before any repeat.
6. Separate **safety budget** (conservatively counts attempted/unknown actions) from **analytics** (confirmed success only). Return both only where useful to the user.

Suggested public shape:

```json
{
  "data": {
    "action": "create_post",
    "operationId": "local-opaque-id",
    "status": "unknown",
    "ok": false,
    "target": "self",
    "detail": "The request may have reached LinkedIn; check your feed before retrying."
  },
  "meta": {
    "source": "voyager",
    "fetchedAt": "2026-09-30T00:00:00.000Z",
    "partial": false
  }
}
```

### 5.4 Privacy, security, and abuse boundaries

- **Session data:** keep browser profile local with restrictive permissions; document exactly what `--logout` removes and avoid deleting a custom profile path without a clear confirmation in the CLI. Treat profile directories as credentials.
- **HTTP:** loopback default, strict origin/host validation, bearer auth for explicitly remote deployments, TLS termination guidance, no wildcard CORS, request caps and deadlines. Do not claim serverless compatibility while a persistent local browser is required. MCP security guidance warns against token passthrough and trust-boundary mistakes: [MCP security best practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices).
- **Diagnostics:** redaction at source; test that cookie values, CSRF tokens, profile text, messages, and auth headers never appear in logs or support bundles. Use opt-in telemetry with no personal content and an easy off switch.
- **Data retention:** document what is stored: Chrome profile, budgets, breaker state, future operation journal. Provide a deletion command and schema migrations.
- **Abuse:** no bulk-send workflow, no rate-limit bypass switch in user-facing release, no automated captcha solving. Treat platform checkpoint as an operational stop and require human action.

### 5.5 Compatibility and test strategy

- Maintain fixture snapshots of redacted Voyager responses for each endpoint and multiple locales/account states; record capture date and schema version. Never commit live identifiers or secrets.
- Test each tool through MCP initialize/list/call for `ok`, empty, partial, auth expiry, 429, checkpoint, timeout, malformed JSON, and cancellation. Write paths need unknown-outcome and duplicate/idempotency cases.
- Test separate stdio processes against the same profile and budget store; test Windows/macOS/Linux behavior, packed npm install, first browser launch, graceful close, and no lingering child process.
- Keep optional live tests manual/opt-in on accounts whose owners authorized the exact action. Never run live writes in normal CI. Do not use production accounts to validate exploratory payloads.
- Use an endpoint compatibility status page generated from fixtures and live smoke evidence, with dates and scope. A passing fixture is not proof the live endpoint still works.

## 6. Sequenced implementation plan for Codex

**Rule:** each item is a separate, reviewable PR. Before editing, inspect the current branch, preserve the untracked `pr_diff.txt`, and follow `AGENTS.md`. Do not send LinkedIn writes while implementing. Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` for code PRs. Document any failure precisely; do not claim a green gate if it is red.

| Phase / timing | Deliverables (suggested PRs) | Exit gate |
| --- | --- | --- |
| **0. Contain risk, week 1–2** | P0-1: secure or temporarily disable HTTP data tools; P0-2: integrate hard breaker and checkpoint propagation; P0-3: fix write accounting and returned 429 handling; P0-4: account/profile locking and fail-closed budget state. | Security tests demonstrate no unauthenticated HTTP actions, hard checkpoint blocks all calls across restart, and two processes cannot exceed a shared cap. |
| **1. Truth and install, week 2–4** | Fix test suite; clean v1 docs/config claims; generate version/registry metadata; add `--doctor`; clarify browser requirements and exact tool verification states. | A clean user can install packed npm artifact and complete first read; all CI gates pass. |
| **2. Contract quality, month 2** | Versioned schemas, `structuredContent`, output schemas, standard errors, bounded pagination, capability manifest; endpoint fixture library. | Existing MCP clients still work; fixture/protocol tests verify every registered tool. |
| **3. High-value workflows, month 3** | End-to-end examples for job research, company research, profile comparison, inbox triage; add missing reads only when demanded and validated; improve source links. | User tests show workflow completion and fewer manual retries; no unbounded collection behavior. |
| **4. Official adapter pilot, months 3–5** | Design provider interface; implement OAuth identity and permitted publishing on a test app; scope-aware discovery; document app setup and restrictions. | Each exposed action has documented granted scope and a successful approved API integration test; unsupported operations are explicitly unavailable. |
| **5. Community and distribution, continuous** | Better README demo, troubleshooting, examples, changelog, discussions, contributor labels, registry verification, release notes, substantive tutorials and integrations. | Track first-use success, recurring users, issue response time, referral sources, and star growth monthly. |

### Codex-ready first backlog

1. **HTTP threat fix:** patch `src/transports/http.ts` and `src/server.ts`. Add tests covering bind host, origin rejection, unauthenticated POST, body limit, and resource cleanup. Update README and SECURITY. If remote auth cannot be implemented safely in one PR, restrict to loopback and explicitly mark remote HTTP unsupported.
2. **Breaker integration:** patch `src/browser/voyager.ts`, `src/browser/guard.ts`, `src/safety/circuit-breaker.ts` as needed. Carry safe response signals into guard; hard-trip and persist. Add MCP-level checkpoint test and restart test.
3. **Write transaction:** patch guard/write tools so classification occurs before accounting, response-returned 429/restriction affects the breaker, and unknown outcomes are modeled. Add focused cases for 200 GraphQL error, 409, 429, timeout, repeated operation ID.
4. **Budget identity and locking:** replace `'default'`, introduce per-profile ownership and atomic reserve/commit state. Test simultaneous processes and corrupt state. Do not reset to fresh counters on read failure.
5. **Truth sweep:** update `README.md`, `DISCLAIMER.md`, `SECURITY.md`, `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/*`, `server.json`, health version, and capabilities. Correct cold-start session reporting, remove unsupported claims and fake-account advice, and add CI checks for version/tool-count drift.
6. **Reliable package test:** reproduce Patchright import failure from a clean `npm ci`, fix test configuration/dependency interaction, and run packed-artifact MCP smoke in CI.

Each PR description should state: user-visible change, risk addressed, files touched, acceptance tests, current limitations, and rollback. Avoid bundling feature work into security PRs.

## 7. Go-to-market plan for a 10,000-star ambition

### North-star and funnel

Stars measure attention and endorsement, but may not indicate that the server works. The operational north-star is **weekly users who complete a useful workflow without a support intervention**. Because this is a local tool, use anonymous, opt-in feedback or voluntary surveys; never collect LinkedIn content to measure adoption.

Track: README views/referral source where available → install attempts → doctor success → first read → week-4 reuse → issue/PR participation → stars. Record star history from GitHub's privacy-safe endpoint or GitHub Insights, not scraped stargazer identities. Source: [GitHub star-history API announcement](https://github.blog/changelog/2026-09-04-new-api-endpoint-provides-privacy-safe-star-history-data/).

### Growth experiments, ordered

| Experiment | Artifact | Success signal | Stop/adjust if |
| --- | --- | --- | --- |
| Clear 90-second demo | Real screen capture or terminal walkthrough showing login, doctor, a search, and an honest result. | More first reads per README visitor; fewer setup questions. | Viewers cannot reproduce it on supported OSes. |
| Three problem-led guides | “Research a company before an interview,” “Compare jobs,” “Draft and review a post,” each with actual sample output and account-risk note. | Click-through, successful usage reports, relevant GitHub referrals. | Guides promise unsupported operations or encourage automation at scale. |
| Install matrices | Verified steps for Claude Desktop, Claude Code, Cursor, Codex and other MCP clients as tested; copyable version-pinned configs. | Lower setup abandonment by client/OS. | Maintenance cost exceeds use; mark community-maintained entries. |
| Community loop | Enable Discussions, publish a roadmap, triage help-wanted issues, answer issues quickly, contributor guide that matches v2. | Repeat contributors, answer rate, merged community PRs. | Maintainer cannot support promised response times. |
| Ecosystem distribution | Verify official MCP Registry listing; publish to reputable directories, package metadata, example collections; share technical writeups with permission and clear disclosure. | Qualified installs/referrals, not raw listing count. | Source claims become stale or directories imply endorsement. |
| Release storytelling | Monthly factual release notes: one user problem solved, evidence, limitation, example. | Returning users and organic references. | Content outpaces product quality. |

GitHub's own community guidance emphasizes a useful README and community files; Discussions support open product feedback. Sources: [GitHub maintainer guidance](https://github.blog/open-source/maintainers/healthy-and-sustainable-communities/), [GitHub Discussions docs](https://docs.github.com/en/discussions/collaborating-with-your-community-using-discussions/about-discussions), [official MCP Registry](https://github.com/modelcontextprotocol/registry).

### Star math and scenarios

From 10 to 10,000 is **9,990 net new stars**. Over 24 months, that averages about **416/month** or **14/day**; over 12 months, about **833/month** or **27/day**. This arithmetic is a planning constraint, **not a forecast**. The leading direct competitor's roughly 3.7k stars shows the category has interest, while also showing that 10k requires category expansion or a breakout distribution moment.

| Scenario (illustrative, not forecast) | Conditions | 24-month star range |
| --- | --- | --- |
| Maintenance only | Useful repo, sporadic releases, little documentation/distribution. | Hundreds to low thousands. |
| Strong niche product | High install success, reliable reads, good docs, active community, consistent organic distribution. | Low thousands, potentially competitor scale. |
| Breakout | Above plus broad developer-media reach, integrations, sustained network effects, and a distinctive workflow beyond the category's current audience. | 10k becomes plausible, still not guaranteed. |

**Decision gates:** after 30, 60, and 90 days, compare cohort setup/reuse and issue patterns. If installs grow but first-use success is poor, pause promotion and fix setup. If use is high but stars lag, improve explanations and discoverability. If both lag, interview users and revisit positioning before expanding the tool list.

## 8. Future scope and predictions

These are **conditional hypotheses as of 2026-09-30**, not facts about a future release.

1. **Official access will matter more.** Platform enforcement and enterprise procurement will favor approved OAuth routes. The official path cannot replace search/inbox without permissions LinkedIn grants; build it as a capability-specific provider and pursue partner access only with a concrete business case.
2. **MCP clients will expect native contracts.** Structured results, clear annotations, capability discovery, auth boundaries, and compatibility with evolving MCP transport/security requirements will matter more than text-wrapped JSON. Track protocol releases and SDK support before migration. Source: [MCP spec](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).
3. **Browser endpoints will keep changing.** Assume Voyager query IDs and response shapes rotate. Invest in fixture capture, fast degradation detection, and transparent status rather than claiming permanent resilience.
4. **Human-controlled workflows will be easier to trust.** Draft/review/approve tools and local summaries can create value without autonomous mass actions. Explore privacy-preserving saved research, local export, and optional user-approved integrations only after first-use quality is proven.
5. **Distribution will consolidate around trust.** A clear privacy model, accurate docs, reproducible releases, and responsive maintenance may be a stronger long-term advantage than any single endpoint trick. Validate with adoption and contributor data.

Possible later additions, gated by demand and permission: saved-job read workflows, post search, local comparison of user-selected profiles, media publishing through official API, plugin-style client installers, and a local UI for reviewing actions. Each needs a separate PRD and platform-permission check. Avoid building a large SaaS or CRM until the local tool shows repeat use.

## 9. Open decisions for the maintainer

1. Is the primary product **read-heavy local research** (recommended), creator publishing, or an authorized enterprise integration? Pick one headline audience for the next 90 days.
2. Should HTTP remain loopback-only for v2.x (recommended until authenticated remote design is reviewed), or become a supported remote product with dedicated security ownership?
3. Should write actions stay alpha behind an explicit feature flag until checkpoint and idempotency behavior is proven end to end? Recommended: yes.
4. Is the maintainer willing to operate an official LinkedIn developer app and support its approval/scopes? If not, defer the official adapter and state the limitation.
5. What monthly maintenance capacity exists for endpoint breakage, support, docs, and content? The 10k aspiration needs sustained work, not a one-time launch.

## 10. Source register and evidence notes

**Primary project evidence:** [repository](https://github.com/devag7/linkedin-mcp), local `README.md`, `package.json`, `src/server.ts`, `src/transports/http.ts`, `src/browser/{engine,voyager,guard}.ts`, `src/safety/*`, `src/tools/*`, `SECURITY.md`, `CONTRIBUTING.md`, `server.json`, CI workflows. Local revision and test results are recorded above. The untracked `pr_diff.txt` was not modified.

**External primary sources:** [LinkedIn prohibited software](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions); [LinkedIn User Agreement](https://www.linkedin.com/legal/user-agreement); [LinkedIn API access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access); [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api); [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools); [MCP security guidance](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices); [MCP Registry](https://github.com/modelcontextprotocol/registry); [GitHub community guidance](https://github.blog/open-source/maintainers/healthy-and-sustainable-communities/); [GitHub star history announcement](https://github.blog/changelog/2026-09-04-new-api-endpoint-provides-privacy-safe-star-history-data/).

**Competitor self-descriptions (compare claims cautiously):** [stickerdaniel/linkedin-mcp-server](https://github.com/stickerdaniel/linkedin-mcp-server); [eliasbiondo/linkedin-mcp-server](https://github.com/eliasbiondo/linkedin-mcp-server); [gohyperdev/linkedin-mcp](https://github.com/gohyperdev/linkedin-mcp). Star counts and features are a dated snapshot and will change.

## 11. Ready-to-paste execution brief for Codex

> Read `AGENTS.md` and `PRODUCT_TECHNICAL_ROADMAP_2026.md`. Start with Phase 0, PR 1: secure the optional HTTP transport. Inspect the current checkout and preserve unrelated changes. Implement loopback binding by default, origin/host checks, bounded request bodies and deadlines, and a safe shared engine/guard lifecycle. If secure authenticated remote access does not fit this PR, explicitly disable remote binding and document that limit. Add targeted tests for unauthorized local-webpage/LAN requests and resource cleanup. Update README and SECURITY claims to match behavior. Run lint, typecheck, tests, and build; investigate the existing Patchright-import failure rather than claiming all tests pass. Report the files changed, proof from tests, remaining risks, and the next Phase 0 PR. Do not run live LinkedIn writes or publish a release as part of this task.

After that PR is reviewed, execute the other Phase 0 items in order, using the acceptance criteria and risk notes above. Reassess the roadmap against new evidence before Phase 2 and update this document when decisions change.
