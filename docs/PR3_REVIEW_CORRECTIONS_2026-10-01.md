# PR #3 review corrections — 2026-10-01

Refreshed draft PR #3 at `2562ff0bb8e19664bfb88bc0ea62620862bb4b7d`, based on
upstream `e368b61a2b715d6793831fb18f52ff982ccf12b0`. Its existing twelve hosted
checks passed before these changes; that result does not prove the corrections.
A new private backup outside iCloud is at
`~/.codex/backups/linkedin-mcp/20261001T114616Z-pre-pr3-review/`.

## Corrections

| Finding | Result | Regression evidence |
| --- | --- | --- |
| Logout follows profile aliases | Reject leaf/ancestor links, Windows junctions, aliased paths and dangerous ancestors; lock/recheck/rename/check identity before erasure | Seven disposable fixture tests plus installed CLI default-profile alias test with disposable HOME/USERPROFILE; nested targets and safety history retained |
| Confirmation bypasses preview | New submissions require process-issued opaque 256-bit token, operation ID and exact semantic inputs; five-minute expiry, bounded outstanding tokens, checks after pacing and before durable reservation | Five-tool protocol tests, forged/missing/action/target/content/ID/expiry checks; restart journal lookup without proof; no token persisted |
| Draft tag matches but commit differs | Resolve target commitish and peel tag to expected source SHA before reuse/finalization; validate finalization response | Synthetic mismatched target/tag/missing tag, annotated tag, branch target, duplicate draft and pagination exhaustion tests; no real release mutations |

Two additional release defects were found in surrounding review: the by-tag API
returns published releases only, so recovery must search authenticated draft lists;
and a post-download size check did not bound buffering. Discovery now stops after
five 100-item pages, refuses ambiguous matches, and response streaming stops and
cancels above 2 MiB. New releases explicitly create and read back a source-bound
tag only after the caller verifies the npm artifact. Existing drafts with absent
or mismatched tags fail closed. These helpers were exercised only with synthetic
destinations. GitHub API behavior references:
[releases](https://docs.github.com/en/rest/releases/releases),
[refs](https://docs.github.com/en/rest/git/refs),
[annotated tags](https://docs.github.com/en/rest/git/tags).

## Review scope and limits

Reviewed the cumulative PR's authenticated loopback transport, bounded request
handling, shared runtime, cancellation, account binding, state locks, circuit
persistence, reservation/outcome sequence, CLI deletion and release workflow.
Existing regression suites cover their principal failure paths. This is not an
independent security audit or proof of all possible defects. Windows ACL enforcement,
adversarial local ancestor-directory races and rotating provider compatibility
remain explicit limits. No endpoint shape was invented or refreshed here.

A token proves server preview issuance, never human consent. The client must show
the exact action and obtain explicit human approval. Retained operation outcomes
remain lookup-only, including unknown outcomes, after expiry/restart or write
opt-out. Unsubmitted previews must be reissued after restart. Never retry an
unknown write as a fresh action.

## Local evidence

- 470 tests / 24 suites pass; tests use fixtures, not LinkedIn.
- Lint, strict typecheck, metadata drift check and build pass.
- Installed package CLI/MCP checks include an aliased default profile regression;
  the fixture root is canonicalized on macOS because `/var` itself is an alias.
- Actual local Chrome lifecycle: Chrome 154, nine observed processes, zero remaining,
  closed context, released ownership, zero LinkedIn requests.
- Existing production audit zero / three development findings is unchanged;
  dependency follow-up remains October 8, 2026.

Hosted checks for this correction head must be recorded separately after push.
CI now accepts stacked feature PRs against a review branch, enabling a separate
feature track; release triggers and version are unchanged. PR #3 remains draft.
No merge, version bump, publication or new LinkedIn account request is authorized.
Original roadmap, `pr_diff.txt`, upstream history and previous evidence are retained.
