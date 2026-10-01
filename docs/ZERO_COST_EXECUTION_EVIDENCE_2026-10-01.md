# Zero-cash roadmap: implementation evidence

Verified 2026-10-01 (Asia/Calcutta). This follows
[the zero-cash audit](ZERO_COST_GAP_AUDIT_2026-10-01.md) in its priority order.
The original roadmap and audit are dated inputs, not statements that their gaps
remain unchanged. No required paid service or dependency was introduced.

## 1. Preserve and reconcile — local source gate passed

Before editing, a private, checksum-verified snapshot saved 102 files, including the modified/untracked
work and dependency lockfile, plus HEAD/origin identities and a binary tracked
patch. Its location is `~/.codex/backups/linkedin-mcp/20261001T085725Z-pre-zero-cost/`.
The permissions are private; it is outside the cloud-synchronized checkout.
`git fetch origin main` confirmed upstream `e368b61`, containing the two messaging
commits and their merge. Local HEAD remains `1b4a4c8`: this is a source reconciliation,
not a Git history merge, commit, PR or release. Review/history integration remains
necessary before pushing. Existing cumulative safety work was retained.

The imported behavior and tests now coexist with the native MCP contract:

- A full conversation URN round-trips with `%28`/`%29` inside REST-li variables.
- Inbox participants resolve names, headlines, profile URNs and supplied profile
  links, excluding the mailbox owner. Untitled threads can use participant names.
- Messages expose optional sender, senderProfileUrn and fromSelf. Known timestamps
  sort ascending; missing timestamps remain absent and stable at the end.
- Owner comparisons use exact identifiers. Substring/suffix collisions are tested;
  missing attribution is unknown rather than an invented owner identity.
- Input count limits, unsupported continuation, partial markers, native/text
  parity, output schemas, account/checkpoint guards and write gates remain intact.

Imported synthetic fixtures retain upstream authorship and historical provenance;
they are not new live captures. Eleven messaging normalization cases, 33 endpoint
cases and 62 native MCP contract cases pass. The initial reconciliation gate had
411 total tests passing before dependency/release work began. Its incremental
[review patch](evidence/zero-cost-2026-10-01/messaging-reconciliation.patch) excludes
unrelated original changes. Review the final source alongside it.

## 2. Dependencies — production gate passed; development mitigation remains

A compatible lockfile update leaves the runtime SDK at 1.29.0, Patchright at
1.60.2 and Zod at 3.25.76. No SDK v2 migration or forced audit fix was used.

| Production package | Before | After |
| --- | --- | --- |
| @hono/node-server | 1.19.14 | 1.19.17 |
| body-parser | 2.2.2 | 2.3.0 |
| fast-uri | 3.1.2 | 3.1.8 |
| hono | 4.12.25 | 4.13.12 |
| ip-address | 10.2.0 | 10.7.2 |
| qs | 6.15.2 | 6.16.0 |

`npm audit --omit=dev` changed from six affected packages (two high, three moderate,
one low) to **zero**. npm explain identified the SDK chains through Ajv/fast-uri,
express-rate-limit/ip-address and HTTP dependencies. HTTP-transport containment
still applies; a clean audit is not a universal security guarantee.

The expanded audit also led to compatible updates of brace-expansion, js-yaml,
nanoid, postcss, tsx and its esbuild copy. There are **three development-package
findings** left: Vitest and @vitest/mocker share one moderate advisory; tsup's
esbuild 0.27.7 has a low advisory. There are no remaining high/critical findings.
[Production before](evidence/zero-cost-2026-10-01/audit-before.json),
[production after](evidence/zero-cost-2026-10-01/audit-after-production.json), and
[all dependencies after](evidence/zero-cost-2026-10-01/audit-after-all.json)
are actual npm reports. Counts describe this lockfile on this date.

The [Vitest advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) fixes the
mocker issue in 4.1.11 and does not promise a v3 backport. Attempts to resolve the
controlled v4 upgrade, including isolated installation and npm 11.5.1, failed in
npm's peer resolver with `Cannot read properties of null (reading 'edgesOut')`.
The last selected peer chain involved optional browser tooling across major
versions. This is observed resolver failure, not an established upstream root
cause. No failed v4 lockfile or forced/legacy-peer workaround was installed.
The supported, tested v3 toolchain is retained.

**Exposure analysis / temporary mitigation:** normal tests use offline Node
fixtures; vitest.config.ts explicitly disables its API. The project does not use
standalone mocker plugins or browser-mode servers. tsup builds the CLI and does
not run an esbuild development server. The remaining
[esbuild finding](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) concerns its
Windows development server. These paths are not used by the tested source/pack
commands, and development dependencies are absent from production installs. This
is a configuration-based reachability assessment, not proof every developer
command is safe. Do not expose Vitest/mock/esbuild servers or process untrusted
projects with them. Maintainer follow-up is due **2026-10-08**, and before adding
any affected server/browser tooling: resolve/test the patched Vitest migration
and a supported patched tsup/esbuild combination, then rerun the full audit and
gates. The development dependency backlog is not marked complete.

## 3. Retryable releases — implemented/tested; hosted publication unexercised

The release workflow now waits for its Node20/22 × Linux/macOS/Windows source,
packed-install and actual Chrome lifecycle matrix before entering publication.
A concurrency group serializes releases. Each destination has its own check:

1. Pack one name/version/integrity-bound artifact. A known existing version must
   have the identical SHA-512 integrity; an unrelated existing artifact blocks.
   A tag referring to another source commit does not authorize publication.
2. Missing npm publication can be retried even when its version tag exists. Only
   a verified npm artifact permits creation/resumption of a GitHub **draft**.
3. GitHub Packages and the MCP Registry independently check/publish/verify their
   exact versions. An HTTP error is not interpreted as an absent package.
   Registry metadata must be active and identify the expected npm version.
4. Finalization requires every destination to succeed. Registry failure is a
   failed job and appears in the job summary, rather than continue-on-error.
5. Manual dispatch defaults to **dry run**. An interrupted future release can be
   retried on its original run or its `vX.Y.Z` source tag. Do not dispatch a
   different source commit under an already-published version.

37 offline release tests exercise interrupted publication, existing tags, artifact
mismatch, missing versions, 401/403/429/5xx, malformed metadata, bounded propagation,
independent destinations, Registry failures, draft resume/finalization and corrupt
publisher downloads. No test publishes anything. The current changed 2.0.3 pack
was also checked against public npm: the actual read-only plan refused with
PUBLISHED_ARTIFACT_MISMATCH. Reusing the published version is not an escape hatch.

The publisher download is pinned to **v1.8.1**, with the official GitHub asset
SHA-256/size in scripts/mcp-publisher-lock.json. The archive is verified before
extracting only the expected executable; no latest-download curl pipe remains.
Its checksum-verified Darwin arm64 counterpart was actually run: `validate
server.json` passed against the Registry. This validates metadata; it neither
submits a listing nor establishes that a package/version is listed.
Sources: [pinned publisher release](https://github.com/modelcontextprotocol/registry/releases/tag/v1.8.1),
[API reference](https://github.com/modelcontextprotocol/registry/blob/v1.8.1/docs/reference/api/official-registry-api.md).

The publishing job uses Node22/npm11.5.1 and supports an explicit
`NPM_PUBLISH_AUTH=oidc` repository variable. Configure the package's trusted
publisher for this exact repository/workflow before selecting it. OIDC mode
supplies no legacy npm token. Default token mode is retained until that setup is
proven; no publishing credential was displayed, changed or revoked. npm publication requests
provenance, but no provenance/publication success is claimed without a real run.
[Trusted-publisher requirements](https://docs.npmjs.com/trusted-publishers/).

## 4. Actual local Chrome proof and final gates

`npm run verify:browser` uses the production BrowserEngine with a new temporary
profile, a headless window, synthetic local content and blocked page-network
requests. It checks concurrent launch identity, ownership, context closure,
profile-associated processes and observed descendants, and lock release. It does
not call login/feed/provider tools or reuse the user's authenticated profile.

Actual result: macOS, Node v22.14.0, Chrome major 154 (reduced user agent
154.0.0.0), nine observed processes, zero remaining observed processes, context
closed and ownership released. This is real local browser lifecycle evidence;
Linux/Windows, account login and client-app behavior still need separate evidence.

| Gate | Final local result |
| --- | --- |
| Clean npm ci --no-audit --no-fund | Pass; 279 packages installed |
| lint / typecheck / metadata:check | Pass |
| npm test | **449 tests / 22 suites pass** |
| Build / fresh packed install / included license | Pass |
| Real local Chrome lifecycle | Pass; no LinkedIn URL opened |
| Script syntax + strict browser-script typecheck | Pass |
| CI/release workflow actionlint | Pass, checksum-verified actionlint v1.7.12; shellcheck integration was disabled |
| Official mcp-publisher v1.8.1 validate | Pass; no publication |
| Production npm audit | Zero findings |
| Full dependency npm audit | Three development-package findings; mitigation/follow-up above |
| Hosted workflow / authenticated destinations | Configured; not executed |

## Remaining zero-cash work

Source integration is preserved and reviewable, but Git history/PR review and
hosted runs remain outstanding. Do not publish or bump a version during this
local implementation pass. Later publication needs independently verified npm,
GitHub and Registry results. The no-LinkedIn Chrome check is not a volunteer
first read, current endpoint capture or real client-app compatibility test.

Consented first-use/workflow measurements and route/locale captures remain
unmeasured; coordinated shared-state erasure tooling remains unimplemented;
official adapter work remains optional/app-and-grant dependent. Reviewable
community artifacts and truthful distribution measurements follow release.
No live LinkedIn action, push, commit, version bump, publication, outreach,
telemetry or required cash expenditure was performed in this pass.

The final verified work is also saved privately outside iCloud at
`~/.codex/backups/linkedin-mcp/20261001T095601Z-zero-cost-verified/`, with a checksum manifest
and tracked binary patch. Neither snapshot is part of the npm package.

## 5. Git integration follow-through (2026-10-01)

The preceding sections record the earlier, uncommitted local implementation pass.
Git integration now preserves all three upstream commits through `e368b61` and
assembles four review commits on `codex/roadmap-zero-cost-integration`. The four
messaging conflicts were resolved to the already reconciled snapshot; all 115
snapshot files matched after integration except the deliberate CI expansion.
`pr_diff.txt` remains untracked and excluded. Both private snapshots are intact.

CI now runs the complete source gates on Node20/22 × Linux/macOS/Windows, as well
as the six packed-install/real-Chrome checks. This closes the earlier gap in which
source tests ran only on Linux. Local post-integration lint, typecheck, metadata,
449 tests, build, packed install and actual Chrome cleanup all passed again.
There is no version bump, main push, publication or live LinkedIn action.

Hosted results and the review PR will be recorded here once actually observed;
configuration and local results alone do not prove hosted success. The three
development findings still have the October 8 follow-up deadline. First-use/live
reads still require a volunteer's consent; shared-state erasure and the optional
official provider remain open.

The [first hosted run](https://github.com/devag7/linkedin-mcp/actions/runs/36853311468)
failed at Windows metadata checks and macOS browser installation. Windows checkout
converted generated LF files to CRLF; `.gitattributes` now preserves LF. macOS
installer logs showed Patchright removing preinstalled Chrome and downloading only
138 bytes before failing to mount the disk image. Hosted macOS now verifies and
uses the preinstalled Chrome; the lifecycle gate still requires a real launch and
cleanup. Linux and Windows continue installing Chrome for this check.

Platform review also corrected directory-alias fixtures to use Windows junctions
and scoped numeric permission assertions to POSIX. Behavioral locks, corrupt
state, transactions and alias contention remain tested on Windows; tests do not
pretend mode bits prove NTFS ACL privacy. Native ACL enforcement/verification is
tracked explicitly in PRIVACY.md and remains open before any Windows live-use
privacy claim. This follows Node's documented file-mode limitation, not a waived
POSIX assertion. The original dated files remain byte-identical.
