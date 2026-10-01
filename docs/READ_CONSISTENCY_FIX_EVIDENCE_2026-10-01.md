# Read consistency fixes — October 1, 2026

R1/R2 were reproduced in draft PR #3 at `62fcda8` and fixed in the shared read
track. This document accompanies that source change; resulting heads and exact
hosted run results are recorded in each draft's description and private backup
after push. No hosted pass is assumed before the run completes.

## Behavior and acceptance

Pagination uses matching provider start/count only when the observed row count
agrees with the remaining total: min(requested count, max(0, total - offset)).
Contradictory zero/short/oversized pages retain bounded useful observations with
partial status, unknown continuation and no next cursor. Valid full continuing,
full final, coherent short final and coherent zero-total pages retain their
existing semantics. Explicit requests beyond the reported end can be empty;
that does not assert the entire query is empty. There is no implicit follow-up.

Job details accept only a supported numeric jobPosting/fsd_jobPosting URN whose
ID exactly matches the requested ID. Missing, malformed or mismatched identity
returns RESPONSE_SHAPE_CHANGED/null data before source attribution, without
retry. Numeric IDs are compared as strings, preserving precision and the exact
requested identity. Both supported forms still yield the canonical job URL.

## Source review and deterministic proof

The separate SDK suite runs real registration, schema validation, Guard, account
binding and Voyager with a synthetic page boundary and disposable state. It adds
23 cases covering contradictory empty/final/continuing pages, coherent empty,
continuing/full final/short final pages, rows exceeding totals, oversized pages,
explicit cursor continuation and both valid/invalid job identity forms. JSON
text equals structured content. Each isolated read observes exactly one identity
GET and one requested read; a next cursor causes work only when explicitly used.
No real browser, account or provider is used in these tests.

Before the fix, 13 assertions failed and10 passed. All23 now pass. Source review
confirms contradictory evidence cannot reach either the end or cursor path;
source URLs are assigned only after exact identity validation. The client-facing
error and partial-result contracts remain stable; no endpoint or dependency was
added. The separate research_jobs identity check must remain in PR #5 as an
additional defense, with its three-attempt ceiling and partial search facts.

PR #3 local gates pass with499 tests/26 suites, lint, typecheck, metadata check,
build and exact15-file normal/scripts-disabled package verification plus installed
stdio smoke checks. These establish fixture contracts and offline package
execution, not current LinkedIn compatibility. Each propagated draft requires
its own source/package gates and resulting-head hosted matrix; inheriting this
evidence alone is insufficient.

## Integration and preservation

Carry the reviewed shared commit with cherry-pick and an origin-commit trailer
into draft PR #4 and draft PR #5. Preserve each existing head as an ancestor;
do not force-push, rebase or merge any pull request. Keep all three drafts.
Track-specific tests/documentation stay in their own branch. Run the resulting
head matrices for Linux/macOS/Windows Node20/22, including installed artifact
and actual offline Chrome lifecycle checks.

A private pre-edit backup preserves59 workspace files (57 sync copies,
pr_diff.txt and the ignored dist copy), source-head bundle and the existing
review/protocol documents. Older backups and the relocated malformed Git ref
remain intact. Builds preserve the dist duplicate; exact packaging excludes
duplicates. No version bump, publication, paid service or LinkedIn request is
part of this milestone. Required maintainer cash remains $0 without relaxed
quality or convenience criteria.

After all fixes pass review and gates, prepare a stable private installation of
the exact PR #5 tarball, record source SHA/package SHA256 and verify it offline.
Seek fresh consent against that exact build and the existing read-only job-brief
protocol before any account request. Do not reuse prior consent. The10,000-star
and GitHub Trending daily ambitions remain measured outcomes, not achieved
results inferred from tests or code.
