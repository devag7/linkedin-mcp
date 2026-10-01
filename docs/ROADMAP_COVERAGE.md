# Coverage against the original 2026 roadmap

Updated 2026-10-01 (Asia/Kolkata), unreleased review branch based on upstream
`e368b61`, package 2.0.3; [draft PR #3](https://github.com/devag7/linkedin-mcp/pull/3). Every requirement below is checked against the initial
[PRODUCT_TECHNICAL_ROADMAP_2026.md](../PRODUCT_TECHNICAL_ROADMAP_2026.md).
The [zero-cash execution record](ZERO_COST_EXECUTION_EVIDENCE_2026-10-01.md) adds
upstream messaging source reconciliation, a clean production audit, retryable release
checks and real local Chrome lifecycle proof. Full development audit still has three
findings. Git integration and all 12 hosted source/package/browser jobs now pass;
human review and hosted publication remain outstanding.

Coverage means a requirement was assessed; it does not mean its exit gate passed.
The initial document and pr_diff.txt were preserved. Missing tracked files were
recovered from HEAD after the maintainer explained the iCloud synchronization loss
and explicitly authorized recovery. LICENSE is the committed MIT license.

States: **implemented locally** = code and offline evidence; **partial** = some
acceptance evidence remains; **prepared** = a usable document/design, not a deployed
feature or measured outcome; **external proof required** = real access, consent,
remote execution or sustained user data is needed. Source changes are not released.

## Product requirements (original section 4.3)

| ID | Coverage / evidence | Outstanding acceptance proof |
| --- | --- | --- |
| P-01 diagnosis | Implemented locally: offline doctor, explicit live option, fixed/redacted statuses, Chrome/profile/ownership/storage/token checks; doctor.test.ts and account-protocol.test.ts | Actual browser/login/API observations on supported OSes; fixture paths are not an OS certification |
| P-02 capability inventory | Implemented locally: capabilities.ts → whoami and generated CAPABILITIES.md/README/manifest; registration-derived count; metadata check; contracts.test.ts | Current live dates remain null; DOM locale compatibility unverified |
| P-03 typed/native output | Implemented locally: contracts.ts, register.ts, result.ts; all 22 registrations advertise schemas and matching structuredContent/text; typed error envelope works with client-side validation | Additional consented provider snapshots and client-application evidence; not a claim of live schema stability |
| P-04 bounded search | Implemented locally with route limits: stable count bounds, search budgets, one-page job/feed/notification offsets, query/count-bound cursors only for matching paging evidence; bounded first-page DOM/inbox/conversation/invitation views; pagination and protocol tests | DOM and messaging continuation unsupported; no guessed URL/API parameters or implicit crawl; additional paging shapes require captures |
| P-05 reviewed writes | Implemented locally: exact target/content/route/effect preview, operation ID/hash, changed-preview refusal, disabled-by-default alpha policy, separate experimental new-thread flag, reserve/classify/persist/replay; write-transaction.test.ts + contracts.test.ts | No approved live action or current success capture; generated post URLs unavailable; omitted preview_hash stays backward-compatible, so callers must deliberately follow review flow |
| P-06 hard stop | Implemented locally: shared browser/Voyager/DOM safety, bounded challenge signals, persisted breaker, manual verified recovery; checkpoint/protocol/restart suites | Current LinkedIn challenge/locale variants beyond tested signals remain unknown |
| P-07 local HTTP | Implemented locally: explicit selection, 127.0.0.1, every-route bearer auth, exact host/origin, no CORS, bounded body/deadlines/connections, shared runtime; http.test.ts + tools.test.ts | Remote/proxy/browser-CORS hosting deliberately unsupported; no remote OAuth/TLS product claim |
| P-08 installation | Partial: clean npm ci and four source gates; packed tarball installed in a fresh project; installed CLI/doctor/redaction/custom logout and two MCP processes; LICENSE required; all 12 hosted source/package/browser jobs pass on Node20/22 × Linux/macOS/Windows | Actual consenting volunteer first read and client-app compatibility remain untested; Windows ACL privacy is a separate open gate |
| P-09 official mode | Partial/prepared: explicit official selection refuses before browser creation; whoami/metadata report unavailable; inactive v1 credentials isolated; OFFICIAL_PROVIDER_PILOT.md checks official docs and defines provider/scope gates | Real developer app/product approvals/granted scopes, OAuth implementation and approved integration tests are not available; no browser fallback or implied official permission |

## Nonfunctional targets (original section 4.4)

| Target | Evidence now | Remaining measure |
| --- | --- | --- |
| ≥80% first successful read in ≤15 minutes | FIRST_USE_VALIDATION.md defines consenting cohort, denominator, OS/client breakdown and failure stages | No volunteer sample; no rate reported |
| ≥95% schema-valid fixture cases; no false successful writes | All tool contract cases pass native/client schema checks; write classifiers distinguish semantic errors, duplicates, restrictions and unknown; source gates in ROADMAP_PROGRESS.md | These are synthetic selected cases, not a 95% live reliability estimate; obtain redacted real provider captures |
| Zero unauthenticated HTTP calls / no secrets in diagnostics | Unauthorized/security cases exercise real local transport; doctor and synthetic error/log cases exclude cookies, CSRF, profile/message text and auth values; public templates request redacted codes | No universal audit of third-party/browser output; manual capture utilities intentionally can display real content |
| Tool-specific success/partial rates and evidence-based SLOs | Protocol/status fields and voluntary aggregate measurement plan prepared; no automatic telemetry | Collect meaningful opted-in observations; no SLO or adoption number invented |
| Precise degradation, no silent empty fallback | HTTP-200 provider errors/malformed envelopes/unknown entities rejected; missing job/profile core fails explicitly; DOM pages disclose incomplete visibility | Additional endpoint/localization shapes need fixtures; generic internal failures remain fixed/redacted rather than dumping payloads |

## Architecture and risk backlog (original sections 5.1–5.2)

| Finding / boundary | Current disposition |
| --- | --- |
| Per-request HTTP runtimes and unauthenticated exposure | Shared process runtime and authenticated loopback listener; PHASE0_HTTP_EVIDENCE.md |
| Checkpoints disconnected from production guard | Production response/page wiring plus durable stop/manual recovery; PHASE0_CHECKPOINT_EVIDENCE.md |
| Write accounting after blind HTTP return | Classification in transaction; attempted/successful/uncertain separate; returned 429/restriction cooldowns; PHASE0_WRITE_EVIDENCE.md |
| Default account / non-atomic state / concurrent Chrome | Verified own-member hash, canonical exclusive profile ownership, reload/reserve/commit locks, invalid-state stop; PHASE0_ACCOUNT_EVIDENCE.md |
| New-thread request unproven / no remote dedupe | Extra experimental gate; local journal, no retry, ambiguous result unknown; wire body not guessed or changed |
| Cold session falsely logged out | whoami not_checked/null; health intentionally opens/probes unless stopped |
| Text-only JSON | Native versioned envelopes plus compatibility text and output schemas |
| Version/docs drift | Registry/package/client versions generated and schema-checked; docs/security/contributor/templates/Docker updated; no fake-account advice |
| Dead v1 authentication configuration | src/legacy/config.ts isolated; active env no cookie/OAuth/cache/pacing-bypass settings; legacy helpers stay separately tested, outside shipped graph |
| Patchright import failure / misleading green suite | Clean npm ci in this checkout and fresh package installation passed; source/protocol tests import Patchright successfully; no historical failure erased |
| Hardcoded count / uncertain endpoint hashes | Successful registration names derive count; source catalog generates route/date/permission inventory; current live checks explicitly absent |
| Caller/account/operation/cancellation boundaries | SDK request signal preserved explicitly across queue contexts; pacing timers cancel; 30-second fetch/body deadline; check before browser/provider dispatch; in-flight provider requests remain a documented limit |
| Official provider interface | Execution design prepared with route/scope checks and no fallback; adapter is not implemented or silently enabled |

## Write transaction acceptance (original section 5.3)

1. Input/schema and runtime route policy run before browser work. Disabled writes,
   changed preview hashes and unverified new-thread policy refuse locally.
2. Preview normalizes connection target, preserves exact content/audience, exposes
   route/effect and generates an operation ID plus payload hash without persistence.
3. Profile ownership is held for runtime lifetime; budget reserve/commit uses short
   account-store transactions. Guard rechecks after queue/pacing and before dispatch.
4. One dispatch callback reserves unknown before crossing into page fetch. Semantic
   response classification occurs inside the guarded transaction.
5. Outcome is persisted; repeated ID/inputs return stored result, changed inputs
   refuse, unknown remains conservative. Crash reservations survive restart.
6. Safety attempts and confirmed-success analytics are separate; old state is not
   converted into invented historical successes.

Local tests prove these cases; no claim of LinkedIn-side exactly-once behavior,
current payload compatibility, or undo after submission follows. Publishing is not
performed and callers must obtain explicit human approval.

## Privacy / abuse acceptance (original section 5.4)

| Item | Coverage / gap |
| --- | --- |
| Local private Chrome profile and safe logout | Ownership and POSIX private creation; custom recursive deletion requires explicit CLI flag; installed-package refusal/deletion check; native Windows ACL enforcement/verification remains open |
| HTTP security / serverless claims | Local-only bearer/host/origin/request containment; unsupported remote/serverless deployment documented |
| Redacted diagnostics and no hidden telemetry | Fixed tool error/log codes, no DOM keyword/slug or Voyager URL debug output; doctor tests; no network metrics added |
| Retention / deletion / migrations | PRIVACY.md lists profile, breaker, budgets/journal and locks; logout deletes profile and retains safety history; additive validated journal/warmup migration; full coordinated shared-state erasure tooling remains pending |
| Abuse boundaries | No bulk workflow, no pacing bypass in runtime config, only serial concurrency; hard challenge stop and manual resolution |
| Manual capture utilities | Explicit/opt-in and excluded from normal CI; outputs can contain content/identifiers and need redaction before sharing |

## Compatibility strategy (original section 5.5)

| Required evidence | Actual scope / remaining work |
| --- | --- |
| Per-endpoint fixtures / locales / account states | Synthetic schema-v1 fixture provenance plus checkpoint/write/account fixtures; Unicode normalized output tested; consented current endpoint snapshots and multi-locale DOM browser fixtures still missing |
| initialize/list/call for every tool | Native/text output, schema/annotation/inventory for all 22; every read registration gets auth/quota/checkpoint/internal-timeout/shape errors; explicit empty/partial list cases; real MCP queued cancellation; all five writes journal/replay/unknown/confirmation covered |
| Malformed JSON / provider errors / cancellation | Raw/classifier/checkpoint tests plus boundary shape rejection; provider fetch/body deadlines tested with real callback execution; request cancellation before queue/provider and during pacing; no claim that already-started Chrome/fetch can always be interrupted |
| Independent processes / OS / packed install | Shared state contention/owner crash/symlink/process tests locally; installed artifact stdio; OS path fixtures; all six hosted OS/Node source suites and packed/Chrome cleanup jobs pass in run 36853809883; live providers and Windows native ACL privacy remain unproven |
| Live tests only with exact consent | No live read/write sent; normal gates remain offline. Restored manual scripts must not be run merely because they exist |
| Generated compatibility with dates/scope | CAPABILITIES.md and native whoami use one catalog; every liveCheckedAt remains null; synthetic dates are not promoted to captured live dates |

## Phase exit gates (original section 6)

| Phase | Deliverables now | Exit gate status |
| --- | --- | --- |
| 0 contain risk | P0-1 through P0-4 implemented with transport, runtime and process evidence | Local and hosted offline gates pass; cumulative draft PR prepared, separate-per-item PR/human acceptance and release review remain outstanding |
| 1 truth/install | Restored files/license, truthful docs/config, generated metadata, doctor, warmup progression, packed install | Partial: hosted matrix passes; consenting real first read and client-app proof outstanding |
| 2 contract quality | Native/versioned outputs, schemas/annotations, errors, bounded pages/cursors, manifest and synthetic protocol library | Local contract gate passes; real capture/locale/client evidence outstanding |
| 3 valuable workflows | WORKFLOWS.md covers bounded job research, company research, two-profile comparison, inbox triage and one reviewed post; source URLs added where derived from known IDs | Prepared/local links tested in outputs; human completion/retry improvement unmeasured; post URL unavailable |
| 4 official pilot | Official selection unavailable; documented provider/OAuth/scope plan grounded in reviewed official docs | Not achieved: real app/grants/implementation/approved API test required |
| 5 community/distribution | README/setup/capability/issue/contributor/changelog/guides, actual synthetic offline MCP walkthrough and distribution/measurement artifacts prepared | Not achieved: review branch/PR now published, but no release/registry publication, demo capture, volunteers or monthly adoption measurement |

Changes are committed in a cumulative draft integration PR, with four initial
implementation/documentation commits and subsequent evidence/platform fixes. The
roadmap calls for separate PRs per item; this draft is a review checkpoint and does
not claim that requirement or human review is complete. Use
[REVIEW_PLAN.md](REVIEW_PLAN.md) for dependency and review boundaries. No merge,
version bump, release or recruitment message was made.

## Reach and long-term decisions (original sections 1–3 and 7–11)

The original repository/market/competitor research remains a dated baseline. Its
star counts and future hypotheses are not refreshed or treated as current facts.
The working scope is read-heavy local research; loopback HTTP and disabled-by-
default alpha writes follow its recommended safety direction. No multi-account,
evasion, SaaS, bulk harvesting or unattended write feature was added.

DISTRIBUTION_PLAN.md maps the demo, problem-led guides, client matrices, community
loop, directory validation and factual release-story experiments to real success
signals and stop/adjust gates. FIRST_USE_VALIDATION.md defines first-read/reuse and
reliability measurement without LinkedIn content or hidden telemetry. A 10k-star
outcome cannot be completed or guaranteed through repository changes alone.

Maintainer decisions still required: official app ownership/product approvals,
monthly maintenance/support/content capacity and real pilot participants. Future
saved-job/post search/media/UI/integration ideas remain demand/permission-gated;
none is claimed implemented just because it appears in the original future scope.

The next evidence actions are human review, approved first-read/locale
captures and workflow observations; then an app-backed official pilot if chosen.
Remote publishing, outreach and account writes require their own explicit scope.
See ROADMAP_PROGRESS.md for actual gate results and current local limits.
