# 4.1.2 public release evidence — October 26, 2026

## Core identity

Final release source and tag: `436754e8a7de85013418aaf0a55ccd900f59380d`.
The final main tree equals independently reviewed candidate `7af3dbb`;
all 14 candidate/main CI jobs and all 10 final dry-run jobs passed. The prior
security repair independently passed 16 checks, including two second-user
Windows ACL jobs. Local core suite: 768 passed, one platform fixture skipped.
None of these checks establishes native-client or live-provider compatibility.

Npm archive SHA-256:
`6a03ee1a415d064fb573455689e142c5cbec1f140040b66f5674dcab23370947`.
Exact 15 regular files and registry integrity match the reviewed hosted tarball.
The source lock retains SDK 1.32.1 and uses Zod 4.6.7; a fresh public consumer
has zero production findings. Its dependency tree passed 99 registry signature
and 17 attestation verifications. Separate package-specific cryptographic
readback verified the release's signatures/attestations and bound SLSA provenance
to the final source and `release.yml` on main, producer run attempt 1.

## Four independent destinations

| Destination | Verified result |
| --- | --- |
| [npm 4.1.2](https://www.npmjs.com/package/linkedin-mcp-tools/v/4.1.2) | Exact reviewed archive, SRI, signatures and provenance |
| [GitHub Packages 4.1.2](https://github.com/users/devag7/packages/npm/linkedin-mcp-tools/1447088525) | Public version; 15 files match npm except the scoped package name. Archive SHA-256 `b179a6c9b33bc836a61ead1e227d422bb6e3fdb14f6810abb01660b829d10287`. Downloads require authentication despite public visibility. |
| [MCP Registry 4.1.2](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.devag7%2Flinkedin-mcp/versions/4.1.2) | Active/latest; correct `linkedin-mcp-tools@4.1.2` npm identifier and stdio transport; metadata matches reviewed server.json |
| [GitHub Release/tag](https://github.com/devag7/linkedin-mcp/releases/tag/v4.1.2) | Finalized, not draft/prerelease; tag and target are the exact final source SHA |

Independent readback completed October 26 at 10:50 UTC. The [redacted public receipt](evidence/release-4.1.2-2026-10-26/core-public-readback.json)
contains public metadata only; raw private logs remain with the coordinator.

## Workflow history and failure preservation

[Production run 40283329312](https://github.com/devag7/linkedin-mcp/actions/runs/40283329312)
attempt 1 authenticated through OIDC (201), uploaded npm successfully, then failed
`PACKAGE_NOT_VISIBLE` before creating the tag or completing the other destinations.
The initial failure and finalization failure remain preserved. Later independent
HTTP 200 archive readback matched the reviewed bytes; it does not explain the
original visibility failure. Only failed/dependent jobs were resumed at the same
source. Attempt 2 passed all 10 jobs and **skipped npm upload**; one upload occurred.
No token fallback, manual parallel publication or version replacement was used.

Both superseded candidate runs were canceled after correcting immutable packaged
release copy, and are not counted as passes. The redundant source-only post-merge
release run was canceled before its release job; exact-tree source validation and
its dry run had already passed. Final 4.1.2 production ran separately and passed.
Original 4.1.1 artifacts, tag and historical failure receipts remain unchanged.

## Claude distribution artifacts

The default public builders now pin the independently verified npm 4.1.2 archive.
Local production audits, packed/unpacked 24-tool discovery, cold `whoami` and
10,000-element input-bound checks pass for both formats. No profile was created
and no LinkedIn request was made. The source-candidate mode remains explicitly
unreleased and separate from default verified-public mode.

| Artifact | Local SHA-256 | Distribution boundary |
| --- | --- | --- |
| Unsigned Desktop MCPB | `526b183e36f40139c8a351335859268ca680bd3d309f5980fcc92f3e27d81ba7` | Public asset and checksum downloaded independently; exact bytes match. Native 4.1.2 install untested |
| Local Claude plugin ZIP | `cd0417c9dda049792b7095432690de1a065af9e04fd1ca458b3f9d1d1524de62` | Public asset and checksum downloaded independently; exact bytes match. Native Code/Cowork loading untested |

Claude Code 2.1.308 static strict validation passed with directory-only missing-icon
warning and marketplace advice. Four template privacy fixtures pass. All 14 hosted wrapper checks passed at `c43733f`; runtime/pin/template review
was clean, with the separate documentation consistency correction recorded in
PR #47. Both public wrapper files and checksum companions were independently
downloaded and matched their local bytes. Directory acceptance is not implied: local command plugins differ
from a remote HTTPS/OAuth connector, and provider/Directory Policy eligibility
still needs clarification. The [wrapper download receipt](evidence/release-4.1.2-2026-10-26/claude-public-readback.json)
and [14-job hosted record](evidence/release-4.1.2-2026-10-26/wrapper-hosted-checks.json)
keep public bytes, platform checks and native acceptance separate.

## Remaining acceptance

The 24-tool core excludes blocked research briefs, Easy Apply/ATS submission,
form filling, resume upload, saved jobs and server-owned tracker persistence.
Selected-profile retirement is not complete coordinated erasure. Native/live
first-use and broad provider/locale coverage remain unproven; recorded cohorts
remain 0/0, unmeasured. The separately pinned 4.1.2 kit requires personal consent.
No LinkedIn account access, native installation or individual contact occurred
in this release work. Mandatory maintainer cash added: $0. Stars/Trending are
outcomes to measure, not release guarantees.
