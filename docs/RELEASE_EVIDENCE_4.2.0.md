# 4.2.0 public release evidence — October 27, 2026

## Core source and archive

Release/tag source: `bf729d63a72bdced8bda09407520dc2aea3d31f6`.
Its tree equals reviewed candidate `837d572a111bf7079c275631f2f2e08a67421d75`.
All 14 candidate checks, 14 merged-main checks and 10 final dry-run jobs passed.
The dry run used workflow definition `ef56b65`, explicitly checked out `837d572`,
and skipped publishing. Its saved archive independently matches the local candidate.

Npm archive SHA-256:
`cd6ab6df8df54236e953de6a6f8cf7cf095746da5d92fbe1727e7228d2d44b0a`.
Exact 15 regular files, SRI and SHA1 match. Two registry signatures and two
publish/SLSA attestations cryptographically verify the exact source and run
40495398802, producer attempt 1. Local feature verification passed 808 tests
with one platform fixture skipped, lint/types/metadata/build, installed SDK/client
flows and zero source/fresh-consumer audits. These are offline/package results,
not native, live-provider or participant usefulness proof.

## Independent public destinations

| Destination | Readback |
| --- | --- |
| [npm 4.2.0](https://www.npmjs.com/package/linkedin-mcp-tools/v/4.2.0) | Exact archive, integrity, signatures and signed source/provenance verified |
| [GitHub Packages 4.2.0](https://github.com/users/devag7/packages/npm/linkedin-mcp-tools/1453956841) | Public; 15 files/modes match npm except expected scoped package name. SHA-256 `6c7d4451743ae37248f76e71a0cbc2e03afc2b3e17b60852e8155a58c859db64`. Downloads require authentication despite public visibility. |
| [MCP Registry 4.2.0](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.devag7%2Flinkedin-mcp/versions/4.2.0) | Active/latest; reviewed npm identifier/version and stdio metadata match exactly |
| [GitHub Release/tag](https://github.com/devag7/linkedin-mcp/releases/tag/v4.2.0) | Finalized, not draft/prerelease; exact source SHA above |

Readback completed October 27 at 11:50 UTC; [public-safe receipt](evidence/release-4.2.0-2026-10-27/core-public-readback.json).
Raw records remain private. The 24-tool release adds optional evidence reuse and
draft materials to the existing worksheet; it contains no `research_jobs`.

## Original failure and guarded resume

[Production run 40495398802](https://github.com/devag7/linkedin-mcp/actions/runs/40495398802)
attempt 1 exchanged OIDC successfully (201), uploaded successfully (202), then
failed `PACKAGE_NOT_VISIBLE`. The original failure remains preserved. A later
public HTTP200 archive read matched the reviewed bytes. That does not explain
the original failure. Failed/dependent jobs resumed at the same source; attempt 2
passed all 10 jobs and **skipped npm upload**. There was one upload, no token
fallback, manual parallel publish or version replacement. The separate future
[read-only propagation tolerance](RELEASE_PROPAGATION_TOLERANCE_2026-10-27.md)
does not change this completed frozen run or retroactively pass its first attempt.

The superseded `84a2b3c` archive and its cancelled runs remain separate, following
one historical README evidence-link correction. Only README bytes changed in the
candidate archive; the final runtime/test review remained clean.

## Claude packages: separate distribution proof

Default builders now target this verified public 4.2.0 archive. Local production
audits, staged/unpacked 24-tool discovery, cold status, 10,000-element input guard,
selected-evidence/draft checks and unused-fact isolation passed. No browser profile
was created and no LinkedIn request occurred. Four private-template refusal/copy
fixtures passed. [Local build receipt](evidence/release-4.2.0-2026-10-27/wrapper-local-builds.json).

| Artifact | Local SHA-256 |
| --- | --- |
| Unsigned Desktop MCPB | `d53f67ef5a226b96003baf9b157f8e5efa8449ec65eed1813d911296c6887109` |
| Local plugin ZIP | `17980a241c2bac77a8296b4ac8e8f3e001368c9baa6a9ede681c740aca64605e` |

At this preparation checkpoint the wrappers are local builds; final hosted checks,
source integration and public asset/checksum readback are separate gates. Consult
[the 4.2.0 Release assets and distribution notes](https://github.com/devag7/linkedin-mcp/releases/tag/v4.2.0)
for the later public distribution record. A hash or SDK check does not establish
native Desktop/Code/Cowork use, live LinkedIn compatibility or directory acceptance.
Historical 4.1.2 wrappers and hashes remain unchanged.

## Remaining scope

Native/live usefulness and the separate first-use cohort remain unmeasured. No
application form is filled, resume uploaded or application submitted. Blocked
research briefs, Easy Apply/ATS integration, saved jobs/filters/search, persistent
tracking, coordinated erasure, official grants and Claude directory acceptance
remain open. Required new maintainer service spend: $0. Stars and Trending are
outcomes to observe, not release guarantees.
