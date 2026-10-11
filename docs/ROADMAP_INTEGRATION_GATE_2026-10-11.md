# Offline roadmap integration gate — 2026-10-11

This draft combines three separately reviewable changes based on main
`4b9e81681b3d05ced9148199554b21c53c81d141`:

| Source | Exact head | Scope |
| --- | --- | --- |
| PR #14 | `3ea150dceed0fdfd7502b6727ca21f3e6ecd843c` | Read-only JSON/JSONC client configuration merge preview |
| PR #15 | `7ac3cb2c30e99ec7649c56d184360bb7227a1c94` | Read-only, path-free local data inventory |
| PR #16 | `1e28ab09c21724fe1e4c77aa903f69b12d8e919c` | Direct patched esbuild and build-contract verification |

The only merge conflicts were adjacent CLI options and overlapping changelog
entries. Both options are retained, as are all three source histories. The
Docker builder copies the direct build script.

## Local integration verification

- Clean `npm ci --no-audit --no-fund` installed 242 packages.
- 598 tests in 30 files, lint, typecheck, metadata check and build passed.
- Full `npm audit --json` reported zero findings, including development tools.
- `npm run verify:package` passed: exact 15-file inventory, fresh consumer
  dependencies, three installed-client SDK flows with 22 tools, read-only merge
  previews and offline data inventory. It observed zero LinkedIn requests and
  browser launches.
- The disposable build contract preserved the executable shebang, sourcemap,
  unrelated outputs and executable mode.

Hosted checks and an exact-head dry run must be recorded against this combined
head before it is considered ready for release review. The package version
remains `3.0.0`; this branch is **not a publishable new version** and must not be
merged into main while the push-triggered release workflow is enabled. A later
release candidate needs a version bump, updated user-facing version references,
fresh gates and destination verification.

This work does not establish native-client first-use, live LinkedIn provider
compatibility, coordinated erasure, Windows NTFS ACL privacy, an official
provider, a useful job brief or a measured participant cohort. PR #5 remains
separate and blocked. The published 3.0.0 artifact is unchanged.
