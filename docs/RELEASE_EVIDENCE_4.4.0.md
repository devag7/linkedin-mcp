# 4.4.0 release evidence — October 30, 2026

The local follow-up planning core is published and independently read back on all
four destinations. [Public-safe receipt](evidence/release-4.4.0-2026-10-30/core-public-readback.json)
records source, archive and scope. The full roadmap is not complete.

## Core identity

- Reviewed source: `f3c0643428e5710bfba925ff297419e0136d5f44`.
- [Merged PR #56](https://github.com/devag7/linkedin-mcp/pull/56): `87dae34902cc6f14d5c60a11a901808782a95555`;
  reviewed and merged trees match. Tag `v4.4.0` remains at this source.
- Exact 15-file npm archive SHA-256: `df8ecf6fa8d4143bbc8625b1f8b494e5a3445667b9134f8a94e9db614e2cc1a8`.
- SRI: `sha512-o1gw/RBPp+/6R0V2smtwcb5PId7C/79WuP5c/aI54LJCAC6ez0rFkVlWjK75wtiAhNAnVCo9I9mizeoFlcu5Ng==`. Clean and working archives are byte-identical.

## Verified destinations

| Destination | Observed result |
| --- | --- |
| [npm](https://www.npmjs.com/package/linkedin-mcp-tools/v/4.4.0) | Public bytes/SRI match; latest is 4.4.0. Registry signatures and both publish/provenance attestations cryptographically verify. |
| [GitHub Packages](https://github.com/users/devag7/packages/npm/package/linkedin-mcp-tools) | Public 4.4.0; 15 file bytes/modes match except scoped name. Archive SHA-256 `0b6751367044bca1294968fab78b5f944f6c3b0eba4772e1c92ea4ea5d1061d2`. Downloads require authentication; anonymous HTTP 401. |
| [MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.devag7%2Flinkedin-mcp/versions/4.4.0) | Active 4.4.0 with source-matching package/stdio metadata. |
| [GitHub Release](https://github.com/devag7/linkedin-mcp/releases/tag/v4.4.0) | Finalized, not draft/prerelease; resolved tag/target matches core source. |

Provenance binds this archive to the main release workflow, GitHub OIDC issuer,
exact merged source and producer 40933053202. The audited Sigstore 5 verifier used
an isolated TUF cache. This proves package identity; native/provider acceptance
requires separate evidence.

## Gates and preserved failure

843 local tests passed with one platform fixture skipped, plus lint, types,
metadata, build and exact normal/ignore-scripts 15-file checks. Fresh installed
compiled tracker/legacy and three client-config flows passed. Candidate source
audit recorded zero findings before a new Vite6.4.4 development advisory appeared
and stopped six post-merge source jobs. The [source lock repair](SECURITY_VITE_2026-10-30.md)
pins patched Vite6.4.5; the original failed audits remain preserved. Consumer and
isolated publisher audits recorded zero findings. Dependency resolutions and
runtime/test source were unchanged in the version candidate.

[Candidate CI](https://github.com/devag7/linkedin-mcp/actions/runs/40928205284)
passed all 14 jobs. The [pinned dry run](https://github.com/devag7/linkedin-mcp/actions/runs/40928200140)
passed all ten on a same-source failed-job-only retry, with actual checkout,
hosted/local bytes and skipped publication/authentication/finalization mutation
steps verified. Attempt 1 failed Windows/Node 20 process preflight with
PROCESS_SNAPSHOT_TIMEOUT before Chrome launch. Its cause remains unproven and
its failed receipt is preserved. No timeout or cleanup rule was changed. The
passing retry does not explain the earlier failure.

The original [production run](https://github.com/devag7/linkedin-mcp/actions/runs/40933053202)
remains failed with nine successful jobs. Attempt 1 exchanged OIDC (201) and
uploaded (202), then failed its bounded PACKAGE_NOT_VISIBLE gate. Later anonymous
readback verified exact bytes/SRI/signatures/provenance. Attempt 2 skipped another
npm upload; provenance remains bound to the actual upload in attempt 1.
Attempts 2 and 3 stopped in finalization with generic RELEASE_CHECK_FAILED after
roughly 15 seconds. Their precise hosted causes remain unproven. All failed
attempts are preserved; no token fallback or parallel manual upload occurred.

The [reviewed recovery](RELEASE_RECOVERY_4.4.0_2026-10-30.md) was merged separately
in [PR #57](https://github.com/devag7/linkedin-mcp/pull/57), with 867 local tests,
one platform skip, clean corrected-head review and all 14 hosted checks. It
retains the existing 15-second deadline, response/redirect bounds and identity
checks, declares its client identity and verifies the fresh scoped version/SRI.
Its main-only, one-incident workflow binds the original source, producer, artifact
and existing release ID and refuses uploads, tag moves and altered targets.

[Finalization recovery](https://github.com/devag7/linkedin-mcp/actions/runs/40995717682)
passed its one job at helper source `18879f09eed9f84f512c693bb511d8b8ad98aa70`. It rechecked all
prerequisites and finalized only the existing draft; the core tag stayed at
`87dae34902cc6f14d5c60a11a901808782a95555`. This separate passing recovery does not change the failed original
production result. Final public readback independently verified all four
destinations. Merged-main CI remains a separate observation; pending/cancelled
jobs are not counted as passes.

## Claude distribution and remaining boundaries

Matching 4.4.0 Claude packages have separate build/review/hosted/public-download
gates. Consult the Release distribution notes for their current state. Existing
4.3.0 archives and assets remain unchanged; a source template does not establish
public availability or native acceptance.

The new option returns record-index timing groups at an explicit reference time.
Existing records/CSV remain unchanged; no action, notification, browser, provider
request or server-owned application storage is added. Native 4.4.0 usefulness and
all versioned first-use cohorts remain unmeasured at 0/0. The account-read pilot
excludes both offline application tools. No LinkedIn request, native install,
application submission or participant contact occurred during this release work.
Required new maintainer service expense remains $0.

Blocked briefs, saved jobs/richer provider search, persistent tracking, complete
coordinated erasure, Easy Apply/ATS submission, official-provider grants and
Claude directory approval remain open. Historical failures remain failed.
