# LinkedIn MCP 4.1.1 — verified packages, finalization blocked

Updated October 21, 2026. **npm and GitHub Packages are verified public. The
MCP Registry step is blocked by timeouts; the GitHub Release remains a draft.**
This is partial distribution, not a completed all-destination release.

## Exact public artifact

Source/tag: `3b3e31a9673ddf291e9cb7bc76bf8539d1b8cb0d` / `v4.1.1`.

- npm SHA-256: `3aa33f9a38e2928625f9a7d24d300b644102c87121dc0168766048e1cf7368ec`.
- npm integrity: `sha512-KmiogxlA00ma6FiEGwKxHbGCPn832Ra5Y/qhZc+ONu77fo4bOmSCGws/QZaAR/xr1r5MQOvtaca6M3qQ6ntbEw==`.
- Exact inventory: 15 files; 24 tools. Clean, working-tree and hosted archives
  matched before publication. The packaged README/setup commands pin 4.1.1.
- SDK floor and source lock: 1.32.1. The runtime enables the 10,000-element
  input guard; earlier 4.1.0 native evidence does not prove this guard.

| Destination | Independent result | Boundary |
| --- | --- | --- |
| [npm 4.1.1](https://www.npmjs.com/package/linkedin-mcp-tools/v/4.1.1) | Public bytes, integrity and publish/SLSA subject match; provenance names the source SHA and `release.yml` | Upload acceptance alone was not counted as verification |
| [GitHub Packages](https://github.com/devag7/linkedin-mcp/pkgs/npm/linkedin-mcp-tools) | Public version ID `1420543751`; archive SHA-256 `31e71a7c764256fc0d0ae2a3d12985c1957f84ad855fadd53356fd3c1adbf196`; 15 files match npm except the expected scoped package name | Downloads still require authentication |
| [MCP Registry target](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.devag7%2Flinkedin-mcp/versions/4.1.1) | No successful 4.1.1 publication/readback | Known published 4.1.0 also timed out in local probes; the underlying service/network cause is unproven |
| GitHub tag / Release | Tag points to the intended source; Release remains draft | Finalization correctly failed with the Registry job; do not describe the Release as public |
| Claude Desktop bundle | Local unsigned 4.1.1 bundle built from the verified public npm archive; packed/unpacked cold discovery and guard checks passed | Hosted bundle checks and public asset upload pending; no native 4.1.1 installation or live read |

A fresh public npm installation resolved SDK 1.32.1 and had zero production
audit findings. npm cryptographic verification confirmed 99 registry signatures
and 15 attestations. Installed SDK discovery returned 24 tools, cold `whoami`
returned `not_checked`, and excessive input was rejected without browser profile
creation or LinkedIn requests. See the redacted [npm readback](evidence/release-4.1.1-2026-10-21/npm-public-readback.json),
[consumer verification](evidence/release-4.1.1-2026-10-21/public-consumer-verification.json),
and [scoped-package readback](evidence/release-4.1.1-2026-10-21/github-package-readback.json).

## Gates and failure history

- [PR #42](https://github.com/devag7/linkedin-mcp/pull/42) merged the SDK
  repair and input guard. Final source checks passed: 768 tests plus one
  platform skip locally, lint, types, metadata and build; final-head CI 14/14.
- Its runtime/package-identical earlier head passed a 10-job nonpublishing dry
  run after a failed Registry-read attempt. Both attempts remain preserved.
- [Run 39568406417](https://github.com/devag7/linkedin-mcp/actions/runs/39568406417)
  was cancelled before the publisher job started to correct stale packaged
  install guidance. Its `1a788316…e3a7b73` archive is superseded and was never
  published.
- [PR #43](https://github.com/devag7/linkedin-mcp/pull/43) fixed that guidance;
  final-head and merged-main CI passed 14/14. Its replacement dry run passed
  source, package, six compatibility and scoped-package checks; Registry-read
  timeouts prevented an overall pass. That failure is retained.
- [Production run 39572873450](https://github.com/devag7/linkedin-mcp/actions/runs/39572873450)
  attempt 1 exchanged OIDC successfully (201) and uploaded once (202), then
  failed `PACKAGE_NOT_VISIBLE`. Later independent public archive readback
  succeeded. This does not establish the cause of the initial visibility gap.
- Attempt 2 skipped npm upload, verified exact npm bytes and published/verified
  GitHub Packages. Registry planning timed out before its publisher ran;
  finalization correctly failed. No token fallback or duplicate upload occurred.

The follow-up local checks passed: 768 tests and one platform skip, lint, types,
metadata, build and exact inventory. Fresh published 4.1.1 configuration exports
for Claude Desktop, Cursor and VS Code each passed SDK discovery, cold status,
input-guard rejection and cleanup without a browser or LinkedIn request;
[receipt](evidence/release-4.1.1-2026-10-21/published-client-configurations.json).
An earlier local attempt failed with `ENOSPC` during tests/build/disposable
installation. Its failure summary and logs remain private; after storage became
available, the required checks passed. This does not prove native client UI.

## Remaining release work

Finish the reviewed 4.1.1 MCPB hosted checks and checksum asset. Once a bounded
Registry read succeeds, resume only missing jobs of the existing frozen-source
workflow, verify active Registry metadata, then finalize and independently read
back the GitHub Release/assets. Do not replace the published npm artifact or
move its tag. Retain all failed attempts.

[Release notes](RELEASE_NOTES_4.1.1.md), [security repair](SDK_SECURITY_REPAIR_2026-10-21.md)
and the [full-scope audit](COMPLETION_AUDIT_2026-10-21.md) keep product gaps separate.
There is no new live LinkedIn or native client compatibility evidence.
