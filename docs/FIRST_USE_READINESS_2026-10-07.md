# Published 3.0.0 first-use study readiness

Inspected current main `caa27376ea30bfb34e15f2a1a63a5423c3b40bee`, merged
[PR #9](https://github.com/devag7/linkedin-mcp/pull/9), its
[release evidence](LAUNCH_EVIDENCE_2026-10-07.md), original technical roadmap and
[first-use protocol](FIRST_USE_VALIDATION.md). Study preparation is separate from
the immutable released source/tag `299225871a3ff925984ca658974f334e90103c57`.
No runtime/dependency/version/release change. No recruitment, messages to volunteers,
LinkedIn requests, browser account launch or measured volunteer attempt.

## Clean published-package evidence

Ran the documented normal `npm install --prefix <fresh> linkedin-mcp-tools@3.0.0`
with fresh npm cache, empty user/global npm config, new prefix and an empty profile
path containing spaces. Lifecycle scripts were **not** suppressed. Repeated from
another fresh directory after reviewing the verifier. Node22.14.0/macOS and installed
Chrome were existing host prerequisites; this is not a fresh OS, fresh client profile,
Windows proof or isolation from all host software. The shared budget remained
byte-identical and was only read for diagnosis; no HOME substitution or safety reset.

[Redacted reproducible receipt](evidence/first-use-2026-10-07/published-offline.json):

- Public download SHA256
  `c79f78e5e77814febb3f68ab9a391ef860515bcfd2d6f97001eadd6e00f58fe5`, the original
  approved archive; exact15 regular files, every archive byte compared to the freshly
  installed package, SRI unchanged. Installed bundle SHA256
  `4aea3b185bdc2385e230d84012e0977861e7137610b4e7eaa7136cfec42ef219`.
- Fresh consumer SDK1.32.1/proxy-addr2.0.8; production audit0. Both actual installed
  versions and lock entries checked against their patched floors. No inherited lock
  or overrides. Install4.319s is an engineering check, not volunteer install-to-read time.
- All three `--setup` reports returned `local_ready`, session `not_checked`; export
  equals report configuration. Absolute Node and published bundle, same isolated
  profile, writes disabled. Each exported entry starts a real SDK stdio process,
  discovers22 tools, excludes `research_jobs`, returns cold identity, closes cleanly.
- Existing `verify-setup.mjs` ran against that public installed bundle: disposable
  broken symlink yields actionable JSON, missing Chrome/stopped safety diagnosis,
  invalid command combinations, secret exclusion, blocked reads and local preview.
  All pass without browser/provider access. These are deliberately synthetic negative
  cases, separate from the fresh empty-profile successful setup reports.

Reproduce (Node/npm already installed, network to public npm only):

```sh
node scripts/verify-published-first-use.mjs /absolute/new/private/study-directory
```

The script refuses an existing output directory, preserves private logs/configuration
locally and prints a redacted receipt. It does not edit native client configuration,
login or call a provider tool. Review outputs before sharing; raw setup exports
contain local paths. Its reviewed source lives outside the package allowlist.

## Actual client flow matrix

| Client | Published installation/export/SDK flow | Native UI actually tested | What remains |
| --- | --- | --- | --- |
| Claude Desktop | Pass;22 tools/cold whoami/close | App2.26454.0 available; no config import or tool discovery completed. Existing app session was not replaced; UI control interrupted by user activity. | Isolated native config acceptance/discovery and participant-authorized first read; no client subscription requirement inferred. |
| Cursor | Pass;22 tools/cold whoami/close | Not installed on this Mac; no UI flow tested. | Volunteer/owner device with current client; native acceptance, client/model entitlement and authorized read. |
| VS Code | Pass;22 tools/cold whoami/close |1.140.0 recognizes generated `.vscode/mcp.json` and Start control; Start fails before chat runtime exists. **No native tools-discovery success for this build.** | Participant starts their own permitted client runtime with cold `whoami` scope first, then approved read; no model message sent here. |

[Native failure receipt](evidence/first-use-2026-10-07/native-vscode.json):
`Cannot start an MCP server before the session runtime has been created. Send a message first.`
Read from the test window's specific `agentHostMcpServer` log after the visible Error
state. No repeated launch/login. A disposable persisted stop blocked provider access;
the test window was closed and no matching server process or fixture owner lock remained.
This reproduces a current native client launch prerequisite, **not a diagnosed server
defect**. The earlier source-build VS Code1.139.1 discovery receipt is historical;
do not substitute it for published3.0.0/current1.140.0 evidence. Native chat invocation
and provider compatibility remain unverified for all three clients.

Primary client instructions reviewed October7:
[Claude developer connection settings](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop),
[Cursor stdio configuration](https://cursor.com/docs/mcp),
[VS Code server configuration/management](https://code.visualstudio.com/docs/agent-customization/mcp-servers).
VS Code still accepts the native `servers` format while recommending newer portable
destinations. Cursor's examples omit `type`, although its field table calls it required;
that documentation inconsistency alone is not a reproduced offline defect. Preserve
the published export until a native repro supports any later-version code fix.
No reproducible product CLI/config defect was found in these offline checks.

## Ready-to-run study materials and criteria

[Short instruction/consent kit](FIRST_USE_VOLUNTEER_KIT.md),
[privacy and fixed scoring rules](FIRST_USE_RESULTS.md),
[blank CSV](FIRST_USE_RESULTS.csv). No private rows in GitHub. The kit fixes the
published version, starts the clock before prerequisites/install, limits tool scope,
counts every started failure/cancellation, labels useful partial reads, separates
cleanup and optional repeat-use evidence, and excludes maintainer/synthetic attempts.
Default own-profile flow permits nine explicit GET attempts including login and
identity. This envelope was derived from source, not live instrumentation or a
runtime-enforced limiter; unknown request counts stay unknown. No independent health
probe. Concurrent profile sections already dispatched cannot be undone after a stop.

All three cohorts remain0; **80% within15 minutes is not measured**. Owner may arrange
a small consented pilot only after reviewing kit and client access. No invitation has
been sent. Mandatory cash$0: private local CSV/docs, existing volunteer devices and
public repository infrastructure. No purchased client plan, hosted service, API key,
domain, placement or paid study software. Client entitlement failures count once an
attempt starts; do not pay to hide them or reduce feature/privacy criteria.

## Separate outstanding assessments

| Item | Current evidence / gap | Concrete acceptance and next action | Effort / required cash |
| --- | --- | --- | --- |
| October8 development dependency follow-up | October7 full audit exits1: **one low** esbuild0.27.7, [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr). Current latest tsup8.5.1 requires^0.27.0; patched esbuild≥0.28.1 (latest0.28.2) is outside that range. No supported parent update today. Published production consumer audit0. | Recheck October8; supported tsup update or separately reviewed build migration with source/package/publisher/consumer/hosted gates. No forced tree repair, overrides or audit suppression. Trusted one-shot tsup has no esbuild serve/servedir/watch; application consumers do not ship esbuild. Advisory concerns a Windows development server; contributor use of serve remains exposure. Full audit is **not zero**. |0.5–1day + weekly review;$0 |
| Coordinated erasure | `--logout` deletes a safely unaliased profile only; circuit/shared budgets/journal remain. POSIX private modes and alias refusal do not provide complete erasure. | Design offline inventory and destructive preview covering all profiles sharing budgets; refuse live owners/aliases; stop all runtimes/Chrome; explain uncertain outcomes and replay/cap history loss; review interruption/restart fixtures before execution. Never erase actual user data in this study. |4–7days shared with privacy work;$0 |
| Native Windows ACL proof | No native Windows second-user/NTFS proof in this task. Hosted Windows fixtures/browser cleanup are not confidentiality proof. | Disposable NTFS state fixture, record owner ACL and failed read/modify from a distinct unprivileged local user; verify descendants/new files/shared journal/locks and cleanup. Owner-provided consenting Windows environment; preserve native modes until separately reviewed ACL implementation. |1–2days + Windows access;$0 volunteer/free public runner; no VM purchase required |
| Glama generated instructions | Re-read public [listing](https://glama.ai/mcp/servers/devag7/linkedin-mcp): corrected README says released3.0.0/local stdio/22 tools; generated FAQ still instructs Deploy Server/Started/@LinkedIn MCP. Hosting label still Hybrid, old2.0.3 schema history. | Platform-generated FAQ/hosting metadata needs owner/platform correction. Draft below; **not submitted**. Do not enable builds/hosting, buy a plan or claim hosted compatibility. Existing accurate awesome-MCP submission remains awaiting upstream review. |Small platform follow-up;$0 |
| PR #5 | Still draft at `00830eae830012bf83f3635c6e5430d4552407ac`; direct SDK^1.12.1 and Vitest^3.2.1 still predate core repairs. Previous partial live result fails useful-brief acceptance. | Carry reviewed core dependency floors/lock fixes without rewriting history; fresh audits/source/package/hosted gates; offline redacted provider-shape diagnosis first. Then separate fresh bounded consent and a useful source-linked brief before merge/release. No account request authorized here. |1–3days diagnosis then consent-dependent;$0 |

Prepared owner/platform correction text (not sent):

> Please correct the generated FAQ and hosting classification for
> devag7/linkedin-mcp. Released3.0.0 is a22-tool local stdio server with manually
> authenticated local Google Chrome; it has no supported Glama hosted deployment.
> Replace Deploy Server/Started/@ instructions with the repository's pinned local
> installation and guided setup. Its owner description and synced README already
> state this. Keep the old hosted/schema2.0.3 record clearly historical; do not
> represent it as3.0.0 compatibility. research_jobs is excluded and remains draft.

## Validation and preservation

Local531 tests/28 suites, lint, typecheck, metadata, build, exact15-file package and
installed package checks pass. These establish offline safety/contracts/configuration
for the tested source/artifacts, not live LinkedIn, client chats or Windows privacy.
Hosted evidence will be recorded at the study PR's exact head; no pending run is called
passed. Source-only study files are excluded from the release tarball. Public3.0.0
bytes/tag remain fixed. All60 preserved backup files compare byte-identical to the
original workspace, including all57 sync copies and `pr_diff.txt`. PR #5 unchanged.

Next highest-impact milestone: remove the native client access/startup uncertainties
with isolated offline owner/volunteer checks, then run the consented15-attempt pilot
and fix its largest observed failure before broader distribution. Track weekly
first-use/repeat-use/GitHub traffic, monthly net stars;10,000 stars and daily Trending
are goals to measure. No Trending outcome is claimed or used as a release gate.
