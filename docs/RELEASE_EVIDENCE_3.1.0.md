# LinkedIn MCP 3.1.0 publication evidence

Verified 2026-10-11 against source commit
`ac8fb5b8033ffc480325469c14eb931d65b58f04` (merged
[PR #17](https://github.com/devag7/linkedin-mcp/pull/17)). The reviewed
candidate and merged main have the same Git tree. This release contains 22
registered tools and the exact 15-file package; the experimental job brief in
draft PR #5 is excluded.

## Exact npm artifact

The [initial production run](https://github.com/devag7/linkedin-mcp/actions/runs/38151630934)
passed all six compatibility jobs and published to npm via GitHub OIDC. npm
accepted the upload, but its archive was still being processed when the
workflow's ten-second readback ended. The `PACKAGE_NOT_VISIBLE` failure remains
recorded. The later public archive returned HTTP 200 and matched the reviewed
artifact byte for byte:

| Check | Verified value |
| --- | --- |
| Package | `linkedin-mcp-tools@3.1.0` |
| Files | 15 |
| Tarball SHA-256 | `8b88302b04523e66f481072f91107716fe52ebadb2e9d3af8c66f4860fd7838e` |
| npm integrity | `sha512-HQ1NG3DoGO3KpulC7LANN0+uYLXLILxNeEz9UeQAI+8+hc1VZyMqZZ2xew0pETElSPypBNnVm+IlQhWSk8j5Xg==` |
| Provenance | npm publish and SLSA attestations reference the package digest; SLSA source is the main commit above and `.github/workflows/release.yml` |

The [resumed release run](https://github.com/devag7/linkedin-mcp/actions/runs/38152242074)
used OIDC mode and the same main commit. Its npm destination check found the
exact package, so npm publication was skipped. All ten resumed jobs passed,
including six OS/Node compatibility jobs and all destination checks.

## Destination readback

| Destination | Verification |
| --- | --- |
| [npm](https://www.npmjs.com/package/linkedin-mcp-tools/v/3.1.0) | Public archive, digest, file count and provenance verified as above |
| [GitHub Packages](https://github.com/devag7/linkedin-mcp/pkgs/npm/linkedin-mcp-tools) | Public package metadata lists scoped 3.1.0 with its exact scoped-package integrity; workflow independently verified it |
| [MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.devag7%2Flinkedin-mcp/versions/3.1.0) | HTTP 200, active and latest, npm stdio package at 3.1.0 |
| [GitHub Release](https://github.com/devag7/linkedin-mcp/releases/tag/v3.1.0) | Final, not draft/prerelease; `v3.1.0` tag resolves to source commit above |

The frozen candidate passed
[12 hosted checks](https://github.com/devag7/linkedin-mcp/actions/runs/38151152446)
and the [10-job dry run](https://github.com/devag7/linkedin-mcp/actions/runs/38151160854).
The dry run skipped all publication steps. Full dependency audit had zero
findings. Hosted tests and disposable browser cleanup do not prove current
LinkedIn responses, native-client first use or private Windows ACLs.
The GitHub documentation update after publication does not change the tagged
source or the already published npm archive.

## Scope still open

The first-use pilot remains at zero started attempts, so its 80% target is
unmeasured. Coordinated erasure, native Windows privacy verification, the
official-provider integration and PR #5's useful job brief remain open.
No new LinkedIn account request or volunteer contact was part of this release.
