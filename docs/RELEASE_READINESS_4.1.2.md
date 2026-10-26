# 4.1.2 security candidate readiness — October 26, 2026

**Unreleased preparation; no release mutation.** This candidate is stacked on
PR #48 at 9befcc393d39b610d1346fd6289247c098ea8a73. Main/public 4.1.1 and
its tag/assets are not changed. PR #48's merge, hosted checks, dry run and
independent reviews must pass separately; this version candidate assumes none.

Scope: single-source package version 4.1.2, root lock versions, generated
metadata/config, truthful current-public/candidate guidance and concise notes.
Runtime, dependency resolution and publisher security code are inherited
unchanged from the frozen repair. 24 core tools; research_jobs is excluded.

Required candidate gates: lint, types, metadata, full tests, build, exact 15-file
normal/ignore-scripts archive verification, installed CLI/SDK/client exports,
fresh full-source/production/consumer audits and explicitly unreleased MCPB
`--from-source` staged/unpacked cold/input-guard checks. Record full commit,
archive inventory/hash and MCPB receipt privately; exact results belong to the
PR body/evidence ledger after execution, never predeclared green here.

Hosted CI and, if dispatched, one SHA-pinned nonpublishing release dry run must
validate this exact candidate. No production dispatch, upload, tag, Release
asset, destination mutation or main merge is part of preparation. Destination
planning/publisher-installation validation in a dry run is not publication
acceptance. Preserve failures and skips; do not infer their cause from retries.

The default public MCPB builder remains pinned to exact 4.1.1 bytes and keeps
its zero-audit gate. Candidate mode packages current source as **unreleased**,
with archive/bundle hashes, 24 tools and zero production findings required.
A new default public pin requires an independently verified new npm archive.

Remaining after preparation: independent candidate review, approved ordered
integration of the repair and version PR, exact final-main/package equality,
automated trusted-publisher publication and independent npm provenance/integrity,
public GitHub Packages, active MCP Registry metadata and finalized tag/Release
readback at the intended source. Bundle publication/readback is separate.
No current-public wording may call 4.1.2 shipped before these complete.

No LinkedIn/account/profile/native-client access, login, application submission,
real-state deletion or outreach occurs. Existing source/package fixtures use
disposable data only. Native/live/cohort/privacy/directory acceptance and the
blocked research brief remain open. No cohort rate or broad compatibility is
inferred from fixtures; required maintainer service spend remains $0.

## Completed core publication — October 26

[Public evidence](RELEASE_EVIDENCE_4.1.2.md) supersedes the preparation-only status
above: PR #49 merged at `436754e8a7de85013418aaf0a55ccd900f59380d`, core 4.1.2
is independently verified at all four destinations, and the same-SHA production
resume passed all ten jobs while skipping npm upload. The first visibility
failure remains failed and its cause unproven. Claude wrapper assets, native/live
validation and first-use are separate gates; none follows from core publication.
