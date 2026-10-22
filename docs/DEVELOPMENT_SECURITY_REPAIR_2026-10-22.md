# Development dependency repair — October 22, 2026

## Finding and scope

A fresh full-source npm audit after PR #44 merged exited 1. It reported two
moderate affected packages: `@vitest/mocker@4.1.11` and its parent `vitest`.
Two vendor advisories cover the helper:

- [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8):
  unsafe manual mock registration through a reachable development WebSocket;
  patched in the 4.x line at 4.1.12.
- [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp):
  Windows separator handling can bypass the mock redirect allowlist in 4.1.11;
  patched at 4.1.12.

The vendor describes specific development-plugin reachability prerequisites.
An audit finding is not proof those handlers were exposed by this project.
Vitest is a development dependency and is absent from the shipped runtime
installation. Production audit findings remain zero.

## Repair and invariant

Require `vitest:^4.1.12`, lock 4.1.12 and its matching helper packages, and update
the related development source-map dependency selected by the resolver. All
**97 production lock entries remain byte-for-byte equivalent as parsed JSON**.
No runtime source, provider route, safety limit or test deadline changed.

After building, both `dist/index.js` and its source map match their exact
published 4.1.1 archive members byte-for-byte. The source version remains
4.1.1; this repair does not need a new runtime release. npm archive SHA-256 stays
`3aa33f9a38e2928625f9a7d24d300b644102c87121dc0168766048e1cf7368ec`;
the public unsigned desktop bundle/checksum and release tag remain frozen.

## Verification

- Clean installation with the existing npm 10 CLI passed after lock generation.
- Local suite: 768 passed, one platform skip; lint, types, generated metadata,
  build and exact 15-file inventory passed.
- Fresh full-source and production audits: zero findings.
- The unchanged compiled runtime and all production lock entries were compared
  against the prior source/published artifact; exact receipts stay private.
- Final hosted/source acceptance is tracked in the repair pull request and its
  CI run. A passing local suite does not establish hosted or native behavior.

The original npm updater failed before modifying source. A clean-folder attempt
also failed with the same `edgesOut` error. The repository's locked, audited npm
12.2.0 tooling, running under available Node 24.19.0, resolved the update; its
installation audit had zero findings. This successful workaround does not prove
the cause of the old resolver failure. Failure output and the original audit are
preserved outside the checkout. No global npm installation was changed.

## Separate post-merge validation failure

PR #44's final head and merged main both passed all 14 CI jobs. Its automatic
release-validation run 39725630984 separately failed the Windows/Node 22
combined-write-cap test after 60 seconds while recording 150 writes. The other
five platform compatibility jobs passed. The original failed log remains saved;
the actual timeout cause is unproven. One failed-job-only same-SHA retry is
requested, keeping the test, persistence and 60-second deadline unchanged.

The release source/tag guard marks this post-release main commit ineligible to
publish the existing version. No production upload, tag movement or fresh
LinkedIn validation is needed for this development repair. Native 4.1.1 and the
separate first-use cohort remain unmeasured; see the
[current completion index](CURRENT_COMPLETION_STATUS_2026-10-18.md).
