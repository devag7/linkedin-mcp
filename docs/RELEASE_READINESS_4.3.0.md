# 4.3.0 release readiness — October 29, 2026

## Publication verified — October 29

The core is published and independently verified on npm, public GitHub Packages,
the active MCP Registry and the finalized GitHub Release/tag. Source/tag is
`10132b3f7878a7c9255af6a55d0454301f142e6b`, with archive SHA-256
`3896b31a25fe442fa23246dbf5e814dc1b7efde33636d81d72e858603aed20f9`.
[Release evidence](RELEASE_EVIDENCE_4.3.0.md) separates each destination and proof.
Candidate/main CI passed 14 jobs each, pinned dry run passed ten with publication
steps skipped, and production passed all ten on its first attempt using OIDC.
A separate session independently verified all four destinations and npm crypto.

Both Claude packages now build locally from that exact public archive and pass
audits, staged/unpacked cold discovery and interview checks. Static Claude Code
2.1.285 manifest validation passes in an isolated configuration. Final wrapper
review/hosted integration and public asset/readback status are recorded separately
in release distribution notes. No native 4.3.0 installation or live use is implied.

## Preparation snapshot (preserved)

Target: optional local interview preparation in the existing worksheet, retaining
24 tools and old-call compatibility. Base main is `497110a`; immutable public
4.2.0 and its independently verified Claude downloads remain unchanged.

## Source implementation checkpoint

The source-only head `077ba03` passed 835 tests with one platform skip, lint,
types, metadata, build, exact 15-file normal/ignore-scripts packaging, installed
CLI/SDK/interview smoke and three offline client exports. Source and consumer
production audits recorded zero findings. Independent read-only review found no
actionable P0–P2 defects. That source-only archive was never published as 4.2.0.

The 4.3.0 candidate changes the project/root-lock version, generated metadata,
current installation pins and release documentation. It introduces no additional
runtime behavior beyond the reviewed interview kit and no dependency resolution
changes. Candidate tests, package identity, final review and hosted results must
be checked at its exact final head before merge/publication. The draft PR records
updated gate status; this preparation snapshot does not imply those gates passed.

## Required gates and publication order

Local 4.3.0 candidate tests now pass: 835 with one platform skip, plus lint,
types, metadata and build. Its exact 15-file package passes fresh installation,
24-tool SDK discovery, compiled interview/privacy and three-client export checks.
Source and consumer production audits record zero findings. A separate disposable
Mac Chrome check observed nine processes closing to zero at both snapshots, with
ownership released, inactive context and zero LinkedIn requests. This does not
resolve historical held-session failures or establish any live/native user result.

The [4.3.0 volunteer kit](FIRST_USE_VOLUNTEER_KIT_4.3.0.md) and
[results guide](FIRST_USE_RESULTS_4.3.0.md) prepare a separate zero-attempt cohort.
Do not enroll before public verification or add interview preparation to its
one-profile-read sequence. Existing cohorts and historical protocols stay separate.

1. Tests, lint, types, metadata and build at the frozen 4.3.0 candidate; meaningful
   legacy/opt-in/reference/privacy/control/bounds regressions.
2. Exact 15-file normal and ignore-scripts packages, compiled installed interview
   flow and client exports; fresh source/consumer/publisher audits.
3. Independent final-head review, all 14 hosted CI jobs, and a source-pinned
   ten-job release dry run with mutation steps skipped. Preserve failures and
   cancellations separately; pending checks are not passes.
4. Review the final merge tree, then publish through the existing guarded main
   workflow using OIDC. No token fallback or parallel manual publication.
5. Independently verify npm bytes/SRI/signatures/provenance, public scoped GitHub
   package contents, active MCP Registry metadata, and finalized GitHub Release
   and source tag. A tag or successful upload alone is not release completion.
6. Prepare version-pinned Claude packages only after the exact public core is
   verified. Audit and check both archives; upload without clobber, then verify
   public downloaded bytes and checksums. Native use and directory acceptance
   remain separate. Existing 4.2.0 assets stay immutable.

## Current boundaries

The prototype was interrupted by disk-write failures and a separate chat usage
limit. Its partial patch was retained, then completed and checked after disk
recovery using existing dependencies. No protected backups, sync copies or
historical failures were removed or reclassified to pass a gate.

No LinkedIn request, login, application submission, participant contact, native
extension installation or real-profile deletion is part of this release. The
interview kit does not establish qualifications, interview history or receipt
proof and stores no data. Required new maintainer service spend remains $0.
