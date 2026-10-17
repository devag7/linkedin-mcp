# LinkedIn MCP 4.1.0 publication evidence

Verified October 18, 2026 against source commit
`76763a605496ca6d8634be13e973bfeb72c4ba95` ([PR #36](https://github.com/devag7/linkedin-mcp/pull/36)).
The `v4.1.0` tag resolves to that exact commit. This release contains 24 MCP
tools and an exact 15-file npm package. The experimental `research_jobs` tool
in draft [PR #5](https://github.com/devag7/linkedin-mcp/pull/5) is excluded.

## Publication and recovery

The [first production run](https://github.com/devag7/linkedin-mcp/actions/runs/39037952820)
passed its six compatibility jobs. npm accepted the OIDC exchange (HTTP 201),
archive upload and signed provenance, but the bounded public readback ended
with `PACKAGE_NOT_VISIBLE`. The exact cause of the visibility delay is
unproven. This run remains failed evidence; it did not create the tag, GitHub
Packages version, MCP Registry version or final GitHub Release.

The npm archive subsequently returned HTTP 200 with the approved bytes. The
[same-source resume](https://github.com/devag7/linkedin-mcp/actions/runs/39039192944)
passed all 10 jobs. It skipped a second npm upload, verified the public npm
archive, published and verified the scoped GitHub package and MCP Registry
entry, then finalized the GitHub Release. The source had already passed
[14/14 main CI jobs](https://github.com/devag7/linkedin-mcp/actions/runs/39037952949)
and a [10/10 nonpublishing dry run](https://github.com/devag7/linkedin-mcp/actions/runs/39036861698).
The dry run skipped publication steps.

## Exact artifacts and independent readback

| Destination | Observation |
| --- | --- |
| [npm](https://www.npmjs.com/package/linkedin-mcp-tools/v/4.1.0) | Public 15-file archive returned HTTP 200. SHA-256 `477c0cbfffe1901c9dea926dd8b9b4be6c9ff223154ff111854be949e798d8f9` matches the reviewed and hosted candidate. Registry integrity: `sha512-Hd7x3QZkMgXXIOCGQL9jT3+7OdI2RZQJtsaijHqE15FZFQVQRRRBByy602WuVhEb4XBWx0gaUNVesujcPmUz/Q==`. |
| [npm provenance](https://registry.npmjs.org/-/npm/v1/attestations/linkedin-mcp-tools@4.1.0) | Publish and SLSA attestations name `pkg:npm/linkedin-mcp-tools@4.1.0` with the same SHA-512 digest. SLSA resolves source commit `76763a6` and `.github/workflows/release.yml`, with the first production run as invocation. A fresh consumer installed 4.1.0; `npm audit signatures` verified 99 registry signatures and 14 attestations, and its production audit had zero findings. |
| [GitHub Packages](https://github.com/devag7/linkedin-mcp/pkgs/npm/linkedin-mcp-tools) | Public version `@devag7/linkedin-mcp-tools@4.1.0` is present in GitHub's package API. Its authenticated archive had 15 entries and matched its declared SHA-512 integrity; archive SHA-256 `661e47528c08b596a86b0d8146d54b64c4925267d18c2de54dd5c5cf2b545afc`. It is separately scoped, so its `package.json` name differs from npm's. GitHub still requires authentication for archive download. |
| [MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.devag7%2Flinkedin-mcp/versions/4.1.0) | HTTP 200; version 4.1.0 is active and latest, pointing to `linkedin-mcp-tools@4.1.0` over local stdio. |
| [GitHub Release](https://github.com/devag7/linkedin-mcp/releases/tag/v4.1.0) | Final, neither draft nor prerelease. The tag resolves to `76763a6`. |

## Product scope

The [release notes](RELEASE_NOTES_4.1.0.md) describe the new offline job
application worksheet and user-entered tracker CSV. They do not fill, upload
or submit applications. `research_jobs` remains draft. Publication checks do
not establish current LinkedIn behavior, job submission or native client
compatibility. The separate first-use cohort remains unmeasured at 0/0. No
LinkedIn request, live write or volunteer contact was part of this release.
