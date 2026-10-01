# Packaging review — October 1, 2026

Reproduced on the PR #4 workspace at `62c32a7`: npm dry-run with scripts disabled
included 66 files, of which 23 were sync-style duplicates from docs/dist, including
`dist/index 2.js`. Those files are preserved. Previous installed-package smoke
checks proved behavior of the selected `dist/index.js`, license presence and offline
process flow. They did **not** prove exclusive contents, nor that a later dirty
workspace tarball matched the previously tested clean CI artifact. Historical
results remain valid within that narrower scope.

PR #3 now uses fourteen explicit paths plus npm's package.json, with an independently
reviewed inventory policy. Runtime build/map, user docs, metadata and safety/workflow
contracts ship; audit logs and execution evidence remain available in the repository
rather than every installed package. No directory/glob allowance is used. Normal
prepack checks reject missing/extra inventory or broadened package.files. With
`--ignore-scripts`, npm still applies exact paths and excludes preserved duplicates.
The packed verifier reads actual gzip/tar entries, rejects unexpected paths/types,
duplicates and missing files, and compares every file's bytes to the workspace.
No test relies only on dry-run output. Build no longer clears unrelated dist files.
This is an artifact gate, not a defense against a maintainer changing both policies.

Regression fixtures reject extra bundle/docs entries, missing output, duplicate
entries and widened directory allowances. Exact dirty and clean tarball inventories
and hosted results are recorded with the follow-up evidence. No version bump,
publication, account request or merge is performed.

A sync-style malformed ref named `first-run-setup 2` prevented Git fetch. Its content
was backed up, then relocated from Git's refs namespace to `.git/sync-preserved/`.
Valid branches and history were retained, and fetch succeeds. All 57 requested
workspace duplicate files, the ignored dist duplicate and pr_diff.txt are retained
and hashed in the private backup outside iCloud.

The normal lifecycle path exposed an additional defect before release: prepack's
report polluted npm pack --json stdout. Reports now go to stderr, and the packed
gate tests **both** normal packing (used by the release helper) and packing with
scripts disabled, requiring identical actual archive contents. A disposable clone
with broadened files rules fails normal prepack. No release was attempted.
