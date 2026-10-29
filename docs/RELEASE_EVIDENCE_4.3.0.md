# 4.3.0 release evidence — October 29, 2026

The interview-preparation core is published and directly verified on all four
destinations. [Public-safe machine receipt](evidence/release-4.3.0-2026-10-29/core-public-readback.json)
records identities and scope. The complete roadmap is not finished.

## Core identity

- Reviewed source: `7f2b0c5581fb5e68992fa274208d6468b40d987d`.
- [Merged PR #53](https://github.com/devag7/linkedin-mcp/pull/53):
  `10132b3f7878a7c9255af6a55d0454301f142e6b`; merge tree matches reviewed source.
- Tag `v4.3.0` remains at that merged source.
- Exact npm archive: 15 files, SHA-256 `3896b31a25fe442fa23246dbf5e814dc1b7efde33636d81d72e858603aed20f9`.
- SRI: `sha512-zDnSSOHH9KQ7dUhGJjKAObVSL/Hcu4pphgdJFunPhwDe+sYlfNP1yTvaeiHZut9FytgaohRzO/igtne8C8EHVQ==`.

## Verified destinations

| Destination | Observed result |
| --- | --- |
| [npm](https://www.npmjs.com/package/linkedin-mcp-tools/v/4.3.0) | Public 4.3.0 bytes/SRI match reviewed archive; latest is 4.3.0. Two registry signatures and both publish/provenance attestations cryptographically verify. |
| [GitHub Packages](https://github.com/users/devag7/packages/npm/package/linkedin-mcp-tools) | Public 4.3.0; 15 file bytes/modes match npm except scoped package name. Archive SHA-256 `2547c42ce03d51eea9393e11c5c761810a5293d60fff55c7b51b392f034a4e3d`. Anonymous download returned 401; authentication is still required. |
| [MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.devag7%2Flinkedin-mcp/versions/4.3.0) | Active 4.3.0, with package/stdio metadata matching source. |
| [GitHub Release](https://github.com/devag7/linkedin-mcp/releases/tag/v4.3.0) | Finalized, not draft/prerelease; resolved tag/target matches merged source. |

Provenance binds the archive to this repository's release workflow on main,
GitHub's OIDC issuer, the exact source SHA and producer run 40863061813 attempt 1.
The audited Sigstore 5 verifier used a fresh isolated TUF cache. Verification does
not establish interview usefulness, native-client behavior or provider permission.

## Source, package and production gates

835 local tests passed with one platform fixture skipped, plus lint, types,
metadata, build and exact normal/ignore-scripts packages. Installed compiled
checks covered 24 tools, selected evidence/unused-fact isolation, interview-only
and combined inputs, cold status, three client exports and disposable retirement.
Source, fresh consumer and isolated publisher audits recorded zero findings.

The [final candidate CI](https://github.com/devag7/linkedin-mcp/actions/runs/40860448430)
passed 14 jobs; the [pinned dry run](https://github.com/devag7/linkedin-mcp/actions/runs/40860441223)
passed 10 jobs with publication steps skipped. Its definition was main at
497110a, while checkout/logs and hosted archive proved source 7f2b0c5. Hosted and
local archive bytes matched. [Merged-main CI](https://github.com/devag7/linkedin-mcp/actions/runs/40863061694)
passed 14 jobs; [production](https://github.com/devag7/linkedin-mcp/actions/runs/40863061813)
passed all 10 on its first attempt, with OIDC exchange 201 and upload 202.
No token fallback or parallel manual publishing occurred.

A disposable Mac Chrome check observed nine processes closing to zero at both
snapshots, released ownership, inactive context and zero LinkedIn requests.
This does not retroactively resolve earlier held-session/updater failures.

## Local Claude package checkpoint

The 4.3.0 Desktop MCPB and local plugin wrap this exact verified public core.
Both local builds pass production audits, staged/unpacked 24-tool cold discovery,
structural input guard, selected-evidence/interview checks and profile-absence
assertions. MCPB SHA-256 is `761b8511deed46c2b689bb9574b843df5bc24c3cc427237b0bc8f12fb7b1c650`;
plugin ZIP SHA-256 is `e514616d244270b4d2cf8e3f920815165bb416da47672b7e88cee03117b9224c`.
This records local builds. Final wrapper source review/hosted integration and
public asset availability/readback are separate: consult the version's Release
assets and distribution notes. No native 4.3.0 installation was performed.

## Preserved failures and remaining scope

Initial ENOSPC writes and an interrupted implementation were preserved. A local
publisher bootstrap selected older child Node and failed engine checks; using
the already-installed compatible Node 24 passed with engine-strict retained.
Independent review corrected three documentation references from a byte limit
to the actual 10,000-element structural guard. Superseded CI/dry runs were
cancelled and are not counted as passes. Root's separate readback helper first
stopped on GitHub's CDN redirect and then on receipt-writing code; both failures
were retained, fixed without retrying publication, and the final readbacks passed.
A second session independently verified all four current destinations and crypto.

Recorded first-use attempts remain 0/0. Interview usefulness, native clients,
live provider coverage, blocked briefs, auto-apply, saved jobs/richer search,
persistent tracking, complete erasure, official-provider grants and directory
acceptance remain open. No LinkedIn account request, application submission or
message occurred in this release work.
Required new maintainer service expense remains $0.
