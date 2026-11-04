# Release publisher repair — November 4, 2026

## Baseline

Main `05eb7f44b511c361009b4dfe766a89aa32502174` (PR #61) passed CI 14/14, but its
push-triggered Release run
[41787883769](https://github.com/devag7/linkedin-mcp/actions/runs/41787883769)
**failed** at "Install audited isolated trusted publisher": all six compatibility
jobs passed, the `release` job's final `npm audit --omit=dev` of the installed
publisher exited 1, and GitHub Packages, MCP Registry and finalize were skipped.
No publication step ran; the run was also ineligible to publish because tag
`v4.4.0` belongs to `87dae34`. Published 4.4.0 is unchanged. That failure stays
recorded as a failure.

The baseline real installer (npm 12.2.0, local Node 24.16.0) reproduces it:
32 moderate findings, all rooted in two advisories published 2026-10-30 in npm's
bundled modules:

| Bundled module | Version | Advisory | Fixed in |
| --- | --- | --- | --- |
| glob | 13.0.6 | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) AbortSignal cancellation bypass | 14.0.2 |
| minimatch | 10.2.5 | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) globparts amplification DoS | 11.0.1 |

The remaining findings are npm packages that depend on those two. No npm release
bundles either fix: npm 12.2.1 (latest, 2026-10-14) still requires minimatch
^10.2.5 and glob ^13.0.6, and no open npm/cli pull request updates them.

## Owner decision and change

The owner chose to use the latest versions. Changes are limited to the isolated
publisher (never part of the 15-file package):

- npm 12.2.0 → **12.2.1**. Its bundle already contains brace-expansion 5.0.12,
  http-cache-semantics 4.3.0 and postcss-selector-parser 7.1.6, so those three
  replacements are retired. Its http-cache-semantics `index.js` has the same
  reviewed SHA-256 (`ede1cc40…729ca`), so the publisher cache guard is unchanged.
- Locked bundle replacements: ip-address 10.7.2 → 10.7.5, undici 6.29.0 → 6.29.1
  (existing advisories, still unfixed in 12.2.1), minimatch 10.2.5 → **11.0.4**,
  glob 13.0.6 → **14.0.3**, path-scurry 2.0.2 → **3.0.0** (required by glob 14).
- Bundle addition: `@isaacs/nonrecursive-glob-match` 1.0.3, minimatch 11's new
  dependency. The installer refuses to overwrite it if npm ever bundles it.
- Dependency requirements of glob and minimatch must equal a reviewed table;
  every other replacement must keep identical requirements. A new post-patch
  check requires each replaced/added module's dependencies to be present and
  semver-satisfied inside npm's own bundle (lru-cache 11.5.2, minipass 7.1.3,
  brace-expansion 5.0.12).

Compatibility review: minimatch 11 removed `makeRe`, `AST`, `matchOne` and
`slashSplit`; no bundled npm code outside minimatch uses them. glob 13 checked
pattern parts with `instanceof RegExp`, which minimatch 11 no longer produces, so
minimatch cannot be replaced alone; glob 14 is minimatch 11's matching release.
npm calls glob only via `glob()` (cacache, map-workspaces, help, help-search,
package-json) and `globSync()` (npm-packlist), whose array results are unchanged
in glob 14.

## Local results (Node 24.16.0, macOS)

- Real installer on the repaired pins: exit 0, `found 0 vulnerabilities`,
  reports `12.2.1`; the cache guard installed and its behavioural check passed.
- `npm pack --dry-run` with the patched publisher lists the same 15 files as the
  runner npm, and its reported integrity equals the sha512 of the runner-packed
  4.4.0 tarball (`sha512-x+x019pe…F8AjOg==`).
- `npm publish <tarball> --dry-run` read the tarball (15 files) and was refused
  by the registry because 4.4.0 already exists. Nothing was uploaded.
- Workspace discovery (`pkg get name --workspaces`, `packages/*` with a hidden
  directory) matches stock npm 12.2.1. `help-search`, `cache verify` and
  `--version` work.
- `tests/release-publisher.test.ts`: 15 tests pass, including refusal of
  undeclared dependency changes, drift from the reviewed table, an addition npm
  already bundles, and unsatisfied bundle dependencies.

## Not established

A hosted release dry run and an actual OIDC publication with this publisher have
not run. The README requires a fresh hosted release dry run after a CLI update;
it needs separate owner authorization. These majors are a local repair, not an
npm-supported combination; remove them when an npm release bundles fixed
versions.
