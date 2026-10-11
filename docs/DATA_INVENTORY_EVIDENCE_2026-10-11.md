# Offline data inventory evidence — October 11, 2026

This separate draft is based on main `4b9e81681b3d05ced9148199554b21c53c81d141`.
It adds a metadata-only `--data-inventory` command. It is not part of released
3.0.0 and does not alter PR #14 or PR #5. The final frozen source SHA, archive
hash and hosted job readbacks are recorded in the PR body and private evidence
receipt after the commit; no same-version publication is eligible.

## Product result and limits

Six fixed categories classify presence, absence, refusal or uncertainty without
reading contents, exposing private paths or mutating storage. The exact contract
is in [PRIVACY.md](PRIVACY.md#inventory-json-contract-development-only). Any
observed alias/type violation, inaccessible ancestry, changed or unavailable
identity, hard-linked regular file or present lock fails closed. Inventory never
authorizes deletion or certifies stopped owners, valid contents or permissions.
P8 coordinated erasure, comprehensive local-data discovery and native Windows
ACL privacy remain open. Provider behavior and native MCP client success are not
tested by this command. Mandatory maintainer cash cost: $0.

## Local verification

- 562 tests in 29 suites passed locally on macOS/Node 22.14.0, including 31
  disposable inventory regressions. The file-symlink test is explicitly skipped
  on Windows, where creating file symlinks can require privileges; directory
  junction tests run there. Types, lint, generated metadata and build pass.
- Installed CLI tests use an isolated disposable HOME/USERPROFILE, malformed
  opaque credential/state contents and lock fixtures. They verify path/content
  omission, no changed file bytes, correct exit/status, default/selected scope,
  junction/symlink refusal and incompatible-command refusal. No account or
  browser activity is initiated by the inventory tests.
- Exact 15-file tarball checks, clean-versus-dirty member-byte comparisons using
  all 60 protected fixture copies, and fresh full consumer install/audit are
  required before this draft's exact-head completion. They do not alter the
  protected workspace or released 3.0.0 artifact.
- Production and fresh consumer audits have zero findings. The isolated supported
  publisher environment also has zero findings. Full source audit retains one
  low development-only esbuild advisory, involving the development server path;
  the build tool dependency remains separate from the shipped runtime and
  publisher. It is not suppressed or counted as zero.

## Proven defects addressed during review

Independent review identified an ancestor replacement between lstat and realpath
that could incorrectly report a missing child as absent. A disposable fixture
failed before the fix. Each snapshot now revalidates recorded ancestor identity
and the first missing component after canonical/descendant observation. The
replacement-after-stat fixture passes. The red failure is retained privately.

A full-suite run also exposed false uncertainty when unrelated fixtures changed
an ancestor directory's link count. Ancestor device/inode/mode still prove the
recorded identity; unrelated child-directory counts are no longer compared.
Leaf link counts and size/time observations, regular-file hard-link refusal,
canonical/type checks and final revalidation remain. The original failed suite
receipt is preserved, and a disposable unrelated-sibling regression now passes.
This adjustment does not prove exclusive ownership or authorize erasure.

A local publisher launch initially selected a nonexistent Node 24 path; it did
not run the publisher or change source. The separate successful check uses
installed Node 26.9.0, within npm 12.2.0's supported engines. Hosted release
validation uses its workflow-selected supported runtime.

## Exact-head hosted completion

The CI source and package matrices, existing release dry run and independent
evidence readback are required on the frozen draft head. Their run URLs and
actual outcomes belong in the PR body and final receipt. A successful dry run
that refuses the immutable 3.0.0 tag is evidence of the guard and offline checks,
not release eligibility, publication or a new hosted release artifact.

PR #5's closed decision cycle and failed cleanup evidence remain unchanged.
The opt-in pilot invitation remains available, with zero attempts until a real
participant starts. No invitation, contact, account access, merge or publication
is part of this milestone. Next prioritize actual first-use evidence.
