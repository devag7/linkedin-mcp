# 3.0.0 release readiness — October 1, 2026

Status: **candidate preparation; not published or merged**. The maintainer now
explicitly authorizes ordered merging and automated publishing after the existing
gates and separately consented validation pass. Earlier no-publication instructions
are superseded. That authorization is not consent to access LinkedIn.

## Version and migration decision

Use **3.0.0**, not a 2.0.4 patch: default-disabled writes with mandatory issued
preview proof, loopback-only authenticated HTTP, persisted fail-closed state and
native result contracts change existing client behavior. The research/setup tools
are additive, but do not erase these breaking requirements. The final bump belongs
on main after merging #3 → #4 → #5. A SHA-pinned 3.0.0 branch artifact may be built
for a **dry run only**; it is not a published version or release tag.

Stop old owners before upgrade; back up profile/circuit/budgets/journals privately;
regenerate installed client entries; preserve operation IDs and unknown outcomes;
never reset checkpoints/caps to migrate. Old runtimes that discard new fields
must not share the new state. Details: [migration](../SETUP_GUIDE.md#migrating-from-203-to-300),
[privacy](PRIVACY.md), [release notes](RELEASE_NOTES_3.0.0.md).

## Final-diff review and independent release corrections

Reviewed stack domains: HTTP boundary; logout aliases/junctions; issued preview
proof and human-approval separation; durable replay/account/state migration;
bounded pagination/job identity; setup exports/diagnosis; brief identity/freshness,
partial/empty status and three-attempt ceiling; archive allowlist; release identity,
resume source, destination integrity and public visibility. Source/fixture evidence
is not an exhaustive security proof or a current-provider observation.

Three additional workflow defects were corrected without changing LinkedIn runtime
code or dependencies: (1) feature-branch dry runs previously skipped all release
jobs; a manual dry run can now check a full source SHA, while feature publication
remains disabled; (2) over-escaped resume-tag validation rejected valid semantic
tags; actual guard tests exercise main/tag/dry-run SHA and reject invalid refs;
(3) authenticated scoped-registry verification did not establish public visibility;
final scoped verification now separately reads authenticated GitHub package metadata (the public-package API also requires authentication) and
requires the exact public npm package linked to this repository. npm defaults to
trusted publishing/OIDC; explicit token fallback requires repository configuration.

No confirmed new P0/P1 runtime defect arose in this review. Known evidence and
product gaps below remain open; do not describe them as completed by this release.
The frozen consent build remains unchanged at `5ef228a1ee973b51e732e01f56f4f6accdfa25da`,
package SHA256 `d53ef6669ea52f8c2d2ab0839331908f7c36253ceeda45adbe46e580c94aed98`.
Release-preparation changes affect workflow/helpers/tests/docs, not its account
runtime. A main version/metadata bump changes the final artifact identity; any live
observation must cite its actual validation build rather than mislabel it as the
final published tarball.

## Required gates and truthful scope

| Requirement | State and what it proves |
| --- | --- |
| Reviewed ordered heads and ancestor preservation | Initial #3 `5e6f25b`, #4 `1ee61b6`, #5 `5ef228a`; resulting heads/checks appended below. Merge commits preserve upstream and stack history. |
| Source gates on each resulting head | Lint/typecheck/tests/metadata/build; local results retained privately and hosted results recorded below. Synthetic safety/provider scenarios only. |
| Exact normal/scripts-disabled 15-file archive, dirty and clean | All names, types and bytes checked against independent allowlist; duplicate copies remain on disk. New source candidates require their own inventories. |
| Installed client and browser gates | Real SDK stdio and three exported configs; offline Chrome lifecycle across hosted Node20/22 Linux/macOS/Windows. No provider or native-chat proof. |
| Production dependencies | Fresh `npm audit --omit=dev`; development advisories separately tracked for October8. |
| Hosted release dry run | Pending exact candidate execution; validates workflow jobs and read-only destination states. Does not prove publish permission/OIDC or missing-version visibility. |
| npm trusted-publisher configuration | Maintainer confirmed the exact trusted-publisher fields/direct-publish permission in this session; actual OIDC publish authentication remains untested. Existing NPM_TOKEN secret exists but its contents/validity were not inspected. No secret is requested. |
| Fresh bounded account validation | Pending separate answer; frozen installed build/protocol ready. No new LinkedIn call made. Useful linked job evidence needed; empty/partial/error states retain their limits. |
| Final destinations | Pending publication: independently verify npm bytes/integrity/provenance, public scoped artifact, active Registry metadata and final GitHub tag/release SHA. |
| Broad promotion / Windows privacy / first-use claims | Open P7/P8 gates: desktop first-read cohort, coordinated erasure and NTFS deny-other-user proof. Do not advertise those as solved. Keep Windows live/privacy claims and Docker/cloud deployment unverified. |

## Publishing and recovery

Configure npm package Settings → Trusted Publisher → GitHub Actions with user
`devag7`, repository `linkedin-mcp`, workflow `release.yml`, environment blank and
**direct npm publish allowed**. [Current npm requirements](https://docs.npmjs.com/trusted-publishers/)
require npm≥11.5.1/Node≥22.14.0; the release job pins a compatible npm and Node22.
No token should be shared here. This is the one required account setup action if
not already configured. GitHub repository variables currently have no auth override.

After validation/gates, mark each draft ready immediately before its guarded merge;
merge #3 first, retarget #4 to main and verify its final tree/head/checks, then #5.
Keep base branches until the stack is integrated. Bump package.json/lock and run
metadata sync on main once; let the existing workflow publish. Never manually
publish the same version alongside it. Record the intended commit and workflow ID.

For interrupted publication use that workflow's dispatch with `release_ref:v3.0.0`
and `dry_run:false` on main, or rerun only failed jobs when the retained artifact
and source are unchanged. Each present destination must match exact identity/
integrity; never overwrite an immutable version or accept a different tag target.
Do not finalize from a green tag: require all four destination checks. A dry run
with `dry_run:true` makes no remote publication/tag/release mutation.

## Distribution and remaining limits

See [directory ledger](DISTRIBUTION_SUBMISSIONS_2026-10-01.md) for current rules,
accurate local-stdio text, live URLs and pending submissions. No mandatory hosting,
domain or paid placement. [Reproducible demo](RELEASE_DEMO_3.0.0.md) uses only synthetic
content. The existing Glama listing needs owner login/re-sync after main changes;
its schema supports maintainers only, so inventing hosting/tool-count keys in
`glama.json` would not fix its cached claims.

10,000 stars and daily Trending remain measured outcomes. Retain monthly first-read,
repeat-use, traffic/net-star and dated Trending observations in the execution plan.
Release/directory work is not permission to message people or share account data.

## Resulting review heads and evidence location

PR #3: `f7e9e2b1632952ee02390dbb129b2c64c0aa9923`;
PR #4: `40935545b36506509c2cb2944e91cdd453672c8b`.
Both resulting source/package gates pass locally (514/519 tests). PR #4 has a
merge commit carrying the exact reviewed PR #3 ancestry; conflicts were limited
to shared release-helper/test versions and resolved to the reviewed PR #3 bytes.
PR #5 integrates that setup head and retains all original research runtime source.
Its final SHA, final-head hosted matrices, clean/dirty inventories and rehearsal
result are recorded in the PR body/checks and private release-preparation backup
after push, rather than predeclared successful in this candidate document.

A fresh rolling GitHub traffic snapshot at2026-10-01T18:09:38Z observes10 stars,
58 views/26 uniques and128 clones/72 uniques in GitHub's rolling window. This is
not a monthly total, a successful-read cohort or repeat use. Net-star change requires
a future boundary sample; Trending was not observed. Raw daily aggregates are
retained privately for deduplicated monthly measurement; no personal/account data
is collected.
