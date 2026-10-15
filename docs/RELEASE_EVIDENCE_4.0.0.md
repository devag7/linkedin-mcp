# LinkedIn MCP 4.0.0 publication evidence

Verified 2026-10-15 against merged source commit
`29d165fac748c79e1a8ba40ae3f030ca051eb5f9` ([PR #28](https://github.com/devag7/linkedin-mcp/pull/28)). The `v4.0.0` tag resolves to that exact commit. This release contains 22 MCP tools and the exact 15-file package. The experimental `research_jobs` tool in draft PR #5 is excluded.

## Publication and recovery

The [first production run](https://github.com/devag7/linkedin-mcp/actions/runs/38702297882) passed all six OS/Node compatibility jobs. npm accepted the OIDC upload and signed its provenance, but its archive was not yet visible when the workflow's bounded readback ended with `PACKAGE_NOT_VISIBLE`. The exact server-side cause of the visibility delay is unproven. That run remains failed evidence. No tag, GitHub Packages version, Registry version or final release was created by it.

The npm archive subsequently returned HTTP 200 with the approved bytes. The [same-source resume run](https://github.com/devag7/linkedin-mcp/actions/runs/38728759860) initially failed on Windows/Node 22 with `PROCESS_SNAPSHOT_TIMEOUT` at browser preflight before Chrome launch. Its failed-job-only retry passed that gate. The timeout's cause is unproven and the failed attempt remains in the run history. The final attempt passed all **10 jobs**. It skipped a second npm upload, verified the public npm artifact, then published and verified GitHub Packages and the MCP Registry before finalizing the GitHub Release.

The merged source also passed [main CI, 12/12 jobs](https://github.com/devag7/linkedin-mcp/actions/runs/38702297852). The frozen candidate passed [PR CI, 12/12](https://github.com/devag7/linkedin-mcp/actions/runs/38700066259) and a [nonpublishing dry run, 10/10](https://github.com/devag7/linkedin-mcp/actions/runs/38700114420). Local gates passed 742 tests, lint, typecheck, metadata, build, full and production audits, and exact package checks. The dry run's publication steps were skipped.

## Exact artifacts and public readback

| Destination | Independent observation |
| --- | --- |
| [npm](https://www.npmjs.com/package/linkedin-mcp-tools/v/4.0.0) | `latest` is 4.0.0. The public 15-file archive returned HTTP 200; SHA-256 `4f08eb94eb97cdb2c2baf1a3643651397c83251f017d9bb4331cd511fd885e28` matches the reviewed and hosted tarball. Registry integrity is `sha512-WK30cDFcq2sXb+EkgO0fuUBW4YPLHnrgl4Gv5HEZ4qcIJ458GLGk+jjwblDPDhELiOXvnLgneIc7uc/VZJO8kQ==`. |
| [npm provenance](https://registry.npmjs.org/-/npm/v1/attestations/linkedin-mcp-tools@4.0.0) | Publish and SLSA attestations name `pkg:npm/linkedin-mcp-tools@4.0.0` with the same SHA-512 digest. SLSA resolves the source to the commit above and `.github/workflows/release.yml`; its invocation is the first production run. A fresh installation passed `npm audit signatures` (99 verified registry signatures; 14 verified attestations) and had zero production audit findings. |
| [GitHub Packages](https://github.com/devag7/linkedin-mcp/pkgs/npm/linkedin-mcp-tools) | Public `@devag7/linkedin-mcp-tools@4.0.0`, with `latest` at 4.0.0. Its authenticated registry archive returned HTTP 200 and matched its declared integrity `sha512-5NvJceG2n0CjQ3La85dsw4hbQMH6bSxSOUqGd4QIFLWZkJpbrDxbXsFoetIDeOttDCzt4H8+0f1TGZKakXIaVg==`. It has 15 files; the 14 payload files are byte-identical to npm, while `package.json` names the scoped package. Scoped archive SHA-256: `6ab790fff96087fd19c82ee09b6c2ba4bd77f20921225a42ff4f9a9e20c6ab2f`. GitHub still requires authentication to download Packages. |
| [MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.devag7%2Flinkedin-mcp/versions/4.0.0) | HTTP 200, active and latest; `io.github.devag7/linkedin-mcp` points to npm `linkedin-mcp-tools@4.0.0` over local stdio. |
| [GitHub Release](https://github.com/devag7/linkedin-mcp/releases/tag/v4.0.0) | Final, neither draft nor prerelease; `v4.0.0` and `main` resolve to the source commit above at verification time. |

## Product scope and remaining evidence

[Release notes](RELEASE_NOTES_4.0.0.md) describe the breaking Windows `%USERPROFILE%` state boundary and the read-only retirement preview. The hosted [native second-user probe](https://github.com/devag7/linkedin-mcp/actions/runs/38685192976) denied read and modification of 18 synthetic targets and passed nine negative cases on Windows Node 20 and 22. Those tests do not prove the state of every existing machine. Coordinated erasure remains unbuilt.

No LinkedIn request, live write, volunteer contact or real-state deletion was part of this release. Native-client first-use remains unmeasured at 0/0; broad live-provider compatibility and PR #5's useful job brief remain unproven. Publication checks do not establish those product outcomes.
