# Phase 0, change 3: write transactions and honest accounting

Date: 2026-10-01 (Asia/Kolkata). Checked-out baseline: `1b4a4c8`, package 2.0.3,
plus the prior local HTTP/checkpoint changes. Status: implemented and verified
locally; no PR, version bump, release, or live LinkedIn action.

## Problem and decision

The original write tools returned raw POST results through `Guard.run()`, which
recorded success before the tools classified the response. Returned HTTP 403/429
therefore consumed connection-success counters without triggering the error-only
breaker feedback. The old classifier also trusted arbitrary JSON/empty bodies,
assumed bare conflicts meant an existing relationship, and missed empty GraphQL
error objects. Alternating likes/comments incorrectly incremented each bucket
using the combined pool count.

Use a write transaction inside the guard. Validate and prepare the request first;
reserve an attempt immediately before page evaluation; persist its uncertain
outcome and safety debit together; submit once; classify and settle inside the
queue. Unknown is an explicit result, never a reason to automatically resubmit.

| Outcome | Safety debit | Confirmed connection analytics | Next action |
| --- | --- | --- | --- |
| Recognized success | One attempt | Increment sent and pending once | Return `ok` |
| Explicit duplicate/already-connected/other rejection | One attempt | No increment | Return the classified rejection |
| Quota/restriction | One attempt | No increment | Apply the action cooldown before advancing the queue |
| Timeout/disconnect/server error/ambiguous response | One attempt | No increment | Return `unknown`; inspect manually |
| Browser/mailbox preflight failure | None | No increment | Return the original failure; nothing submitted |
| Repeated operation ID and inputs | No additional debit | No additional increment | Return stored status/code without a browser call |

## Implementation

- `src/browser/guard.ts`: `runWrite()` owns fingerprinting, queue rechecks,
  reservation, classification, accounting, and breaker feedback. All guarded
  reads/writes stop after budget persistence failure, including unmetered reads.
- `src/browser/voyager.ts`: a dispatch callback runs after browser/safety
  preflight and before page evaluation. Body-read failures remain distinguishable
  from demonstrated empty-body reaction success responses. Endpoint/payload
  shapes were not changed.
- `src/browser/write-status.ts`: models `unknown`; rejects unrecognized success
  bodies; handles GraphQL errors, numeric quota/restriction envelopes, explicit
  duplicate signals, and conflicting result/error envelopes conservatively.
  Bare 409 no longer invents connection/duplicate state.
- `src/safety/budgets.ts`: reservations and outcomes share the existing budget
  file. Attempts consume safety limits; confirmed connections alone feed success
  analytics. Unknown invitations remain conservative inputs to invitation gates
  across days. Likes/comments increment their own counters once.
- `src/safety/write-operation.ts`: content-free journal contract.
- `src/tools/write.ts`: all five tools expose optional `operation_id` and return
  `operationId`/`replayed`. Confirmation remains required. Fingerprints exclude
  random messaging tokens and rotating query IDs where applicable.
- `src/tools/session.ts`: budget persistence failure produces blocked health
  without a live probe, with a storage-repair explanation.
- README and SECURITY document outcomes, ID usage, storage, and limits.

Journal entries retain only IDs, hashes, action buckets, dates, and status codes.
Response details and user content are not persisted. Replays preserve status/code
with a generic explanation. Existing version-1 counters are retained; historical
success statistics are not invented. Invalid/unreadable state fails startup;
failed saves latch a running stop. Replacement uses a unique `0600` temporary
file, file sync, and atomic rename. New writes stop at 10,000 journal entries or
an 8 MiB state file; IDs are never automatically evicted.

## Verification

All checks ran successfully in the actual workspace, macOS / Node 22.14.0:

| Command | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 268 tests, 15 suites |
| `npm run build` | Pass: Node 20-targeted ESM bundle |
| `node tests/built-artifact-smoke.mjs` | Pass: two fresh compiled stdio processes, 22 tools, operation-ID schemas, confirmation refusal, persisted stop, blocked health, clean close |
| `git diff --check` | Pass |

The write transaction and classifier suites each contain 42 cases. They cover
200 GraphQL/semantic errors, bare and explicit 409 outcomes, returned 429/403,
post-submission timeout, unreadable body through the actual fetch callback,
concurrent identical IDs, payload conflicts, capped unknown attempts, historical
unknown invitation gates, and real reservation/result storage failures. Protocol
fixtures exercise all five tool registrations and shared production-server
registrations. An interrupted reservation is also loaded in a separate Node
process. No real browser, account content, or LinkedIn request was used.

The first focused run exposed an incorrect `/me` fixture; it was corrected to the
existing normalizer contract. A full run then exposed a changed pending-invite
message; the compatible wording was retained. Later final checks all passed.

## Workspace recovery and evidence limits

The temporary verification copy from the previous run was gone. Several tracked
baseline files, untracked checkpoint modules/regression suites, dependency files,
and Git objects were also missing. Required baseline sources/config/tests were
recovered from Git. The three checkpoint modules were recovered byte-for-byte
from the previous build's `sourcesContent`. Missing Git objects were downloaded
with a refetch from the already configured origin; HEAD stayed `1b4a4c8` and no
remote changes were merged. `npm ci --ignore-scripts --no-fund --no-audit`
reinstalled the existing lockfile dependencies; package and lockfile have no diff.

Missing HTTP/checkpoint/lifecycle regression files were rebuilt with current
fixtures. The present suites have 12 HTTP, 19 checkpoint, and 2 lifecycle cases;
these are not claimed to be the identical suites from the previous temporary
run. This document reports the current test inventory. Earlier checkpoint
results remain a dated historical record. Unrelated missing documentation and
manual smoke scripts were left outside this change. The roadmap and `pr_diff.txt`
were not edited.

## Remaining work and rollback

Production still uses the existing `default` budget identity. Atomic replacement
alone does not coordinate separate processes; run one process per profile. The
next milestone must add profile ownership, stable account identity, and shared
reserve/commit locking with simultaneous-process tests. This change does not
claim LinkedIn-side idempotency, current live endpoint verification, or durability
through every filesystem/power-loss failure. New-thread messaging remains
experimental. Automatic reconciliation, a review/preview workflow, journal
retention management, and broad platform/package CI remain separate work.

Keep safety state intact during rollback. Older code may discard journal fields
or bypass these semantics; keep writes disabled until protection is restored.
Deleting state would erase counters and replay protection. HTTP deadlines can
still expire while a queued tool is running; caller-supplied IDs permit later
lookup without another submission.


## Superseding milestone

The `default`-identity and missing cross-process protections described above are
historical boundaries of this write milestone. They are superseded locally by
[account identity and ownership evidence](PHASE0_ACCOUNT_EVIDENCE.md). The latest
complete gate results and remaining release work are in
[execution progress](ROADMAP_PROGRESS.md). Retain this document's original test
counts as dated evidence rather than presenting them as the current inventory.
