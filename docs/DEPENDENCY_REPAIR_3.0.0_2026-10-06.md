# Core3.0.0 dependency repair — October6, 2026

This separate repair starts at frozen main
`5640dfaa6a05533143f3130b0663806378ac0afa`. Its original22-tool/15-file artifact,
SHA256 `bba2d6b40d1ea18944588347dcd11490641fc3190e7a084988f81fa17ea74239`,
previous receipts and evidence branch are preserved. No version bump, provider
endpoint, runtime source or LinkedIn account request is part of this change.

## Trace of all six application findings

The October6 baseline full audit reports six package-level findings: three
critical, one high, one moderate and one low. Two of those package entries share
the mocker advisory; Vitest's critical status also includes its Tinypool chain.
The production subset contains only proxy-addr. Advisory conditions do not prove
an exploit of this application or CI. The required audit gates still apply.

| Baseline finding | Actual dependency path / supported repair | Result |
| --- | --- | --- |
| proxy-addr2.0.7, critical [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | MCP SDK1.29.0 → Express5.2.1 → proxy-addr ^2.0.7; lock update to2.0.8 within the existing upstream range. | Application production audit0; separately installed consumer resolves2.0.8. |
| tinypool1.1.1, critical [worker-option gadget](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) / [run-option gadget](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) | Vitest3.2.6 → Tinypool; supported Vitest4.1.11 removes Tinypool entirely. | Absent from repaired lock/tree; no major Tinypool override. |
| vitest3.2.6, critical aggregate | Direct dev dependency; includes Tinypool and the mocker advisory below. | Upgrade to4.1.11, smallest released patched line retaining Node20 support. |
| @vitest/mocker3.2.6, moderate [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) | Vitest3.2.6 → mocker; patched4.1.11 follows the runner upgrade. | Resolved; no unauthenticated mock/browser API enabled. |
| source-map-js1.2.1, high [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | tsup8.5.1 → peer PostCSS8.5.28 → source-map-js; update leaf to1.2.2 within upstream range. | Resolved without a tsup/PostCSS major migration. |
| esbuild0.27.7, low [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) | tsup8.5.1 and bundle-require → esbuild ^0.27.0; available patch0.28.1 is outside the supported range. | One low development finding remains, explicitly assessed below. |

Vitest4 [migration guidance](https://v4.vitest.dev/guide/migration) confirms its
pool rewrite removes Tinypool. Its released manifest supports Node20/22/24.
Explicit Vite ^6.4.4 retains the supported existing6.x toolchain and avoids
npm selecting Vite8/rolldown and its higher Node floor. The lock contains Vite6.4.4,
Vitest/mocker4.1.11 and their required dependency closure. Vitest5 would remove
Node20 support; it is deliberately not substituted. All531 existing tests run
unchanged under the supported4.x runner. No test was deleted or weakened.

Only production lock change is proxy-addr2.0.7 →2.0.8. Application dependency
ranges remain unchanged. No npm override, ignored downstream pin, audit
suppression, advisory exclusion or `npm audit fix --force` was used.

## Fresh consumer and maintenance boundaries

`verify:package` installs the actual tarball into a disposable project with no
repository lockfile/overrides, then examines every root/nested proxy-addr lock
entry and rejects versions below2.0.8 or unreviewed prerelease syntax. It runs
that consumer's production audit and requires zero findings, followed by existing
SDK22-tool discovery, offline setup/doctor/client configuration checks. October6
actual consumer resolves SDK1.32.1, proxy-addr2.0.8 and production audit0. Root
source tests use locked SDK1.29.0. These are distinct recorded resolutions; neither
establishes live LinkedIn compatibility or a native desktop conversation.

Fresh registry resolution is observed evidence, not a promise about older
consumer locks, custom registries or later dependency releases. Consumers with
pre-existing vulnerable dependency locks need their own supported dependency
update and production audit; this repository lockfile is not shipped to them.
The recurring consumer assertion detects regression on each package gate.

Remaining esbuild finding requires its Windows development HTTP server serving
an attacker-requested backslash path. This project uses tsup build APIs on trusted
local source; tsup.config.ts has no serve/servedir or watch configuration, npm
build calls tsup once, Vitest runs offline Node fixtures with api:false, and
release/CI do not start an esbuild file server. No esbuild development server is
part of the22-tool runtime; dev dependencies do not enter a production consumer
installation. This is a documented build exposure assessment, not an upstream
fix or proof about arbitrary future contributor server configurations. Do not
use esbuild0.27.7 to serve files on Windows. Follow up October8 on a supported
tsup release or separately reviewed builder migration; do not force an unsupported
minor override merely to make the audit green. Full audit remains one low finding.

## Publisher gate and failed checks

A fresh actual publisher installer initially failed its zero-findings audit:
bundled postcss-selector-parser7.1.4 reports moderate
[GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
Add separately locked official7.1.6 through the existing bundle replacement
mechanism. Old/new cssesc/util-deprecate requirements are identical; exact versions,
identity, integrity and aliases are checked before any mutation. The actual
installed tree is recorded in its disposable audit lock. Cache guard/real cache
assertions are retained. Fresh repaired npm12.2.0 publisher installation on
supported Node24.19.0 reports zero production findings. No npm auth code changes.

The initial global-npm lock-generation command failed before file changes with
`Cannot read properties of null (reading edgesOut)`. The already reviewed isolated
npm12.2.0 generated the lock instead, then all changes were inspected. Exact failed
logs remain private: `vitest-update.log` and `publisher-install-audit.log`; original
and repaired publisher audit reports are retained. These failures are not counted
as passing gates. No failed source test is hidden.

## Local acceptance and next gates

Local:531 tests/28 suites, metadata, lint, typecheck, build, installed package/setup,
consumer audit and synthetic demo pass. Application production audit0; publisher
production audit0; full audit one low development finding, zero moderate/high/critical.
Normal and scripts-bypassed exact packing verify15 regular files. Local repaired
tarball SHA256 is `585ab2be9e3b20c4b872d424a622fac2ea81b752d6c4955d66e0ee086365c551`.
Only shipped package.json changes (dev manifest); all other14 shipped files,
including runtime bundle/source map, match the preserved frozen artifact bytes.

Required before merge: review complete dependency/migration/package diff;12 hosted
PR checks across Linux/macOS/Windows Node20/22; existing10-job release dry run on
exact PR SHA; independently verify downloaded artifact equality and consumer/
publisher audit results. Save run IDs/results as actual evidence, not predeclared
success. Keep PR #5 draft and original57 sync copies/pr_diff/backup manifest intact.
After gated merge, record the new main/release SHA and matching artifact hash.

Required cash$0; maintenance about1h/month for runtime/build dependency reviews,
existing publisher review about2h/month, audits/fresh consumer checks every release.
No hosting, account requests, paid services or feature reduction. P7 first-use,
P8 erasure/Windows privacy,10,000-star and daily-Trending measured outcomes remain
separate open work.

Publication is paused until the owner confirms npm's saved Trusted Publisher has
`release.yml` only. `NPM_PUBLISH_AUTH=oidc` is verified; no npm token/OTP/fallback.
Because the existing workflow publishes on main pushes before the first version
tag exists, temporarily disable that workflow after its passing dry run and
before merge if confirmation is still pending. CI stays available. Restore the
existing workflow only after confirmation and dispatch its reviewed main candidate;
never publish manually. Independently verify npm bytes/integrity/provenance,
public GitHub Packages, active official Registry stdio metadata and final tag/
GitHub release at the new SHA. Stop and report exact OIDC failure if it recurs.
