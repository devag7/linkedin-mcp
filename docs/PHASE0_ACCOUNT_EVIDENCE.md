# Phase 0, change 4: account identity and shared state

Implemented locally on 2026-10-01 (Asia/Kolkata), on unreleased baseline `1b4a4c8`.
This completes the fourth local Phase 0 implementation. It does not claim live
LinkedIn compatibility, permission to automate, or completion of the growth roadmap.

## Findings and decisions

Production previously constructed `BudgetTracker('default')`. Two trackers could
load stale copies of a file and overwrite each other's counters. Atomic rename
protected an individual replacement, but did not make check/reserve/commit a
transaction. Browser contexts also lacked application-level profile ownership.

The implementation uses existing `/me` member URN normalization rather than
inventing a new identity endpoint. The explicit own mini-profile reference must
resolve; a fallback accepts exactly one recognized member ID and rejects ambiguity.
Only SHA-256(`linkedin-voyager:<opaque-member-id>`) is used as the account key.
Cookies, mutable usernames and profile paths are not account keys. Unresolved
identity refuses submission. New launches reverify identity, writes verify again
immediately before reservation, and a changed account stops the running binding.
The verification itself is a read, so a write cooldown does not prevent retrieving
an already stored result after identity is verified. A hard checkpoint prevents
fresh identity resolution and therefore fresh-runtime journal lookup.

An exclusive directory lock owns each canonical profile, including path aliases.
The owner token, PID, host and creation time are private diagnostic metadata;
none authorizes automatic lock stealing. Ownership lasts through idle close and
`close_session`, until final disposal verifies browser shutdown. Failed initial
launch/preflight releases ownership; unverified shutdown retains a hard refusal.
CLI login/probes/status dispose their engine, logout takes ownership before deleting
a profile, and stdio final cleanup closes the process runtime as well as MCP.

Budget mutation acquires a short directory lock, reloads validated state, checks,
reserves or commits, saves by atomic replacement, and releases. No lock spans a
browser request or pacing wait. Account updates and journal settlements preserve
other processes' state. Contention refuses before submission; contention/failure
at result settlement leaves the durable reservation unknown. Identical operation
IDs are looked up inside the reservation transaction as well as before it.

Metered reads now reserve an attempt before provider work, so failures cannot
produce unlimited retries. An existing tracker also stops if its previously seen
state disappears or becomes invalid. Diagnostics expose a storage failure rather
than accepting a fresh counter reset.

Existing `default` records remain untouched and unattributed. Their current-day
and current-month counts reduce allowance for resolved accounts; outstanding and
uncertain invites remain conservative gates across days. Unattributed successes
cannot improve a member's acceptance rate, and legacy operation IDs return unknown
rather than claiming account-specific success. No history is guessed or discarded.

## Proof

`tests/shared-state.test.ts` exercises 26 cases, including actual independent Node
workers using the production Guard and BudgetTracker. Simultaneous workers submit
exactly five fixture actions at a shared five-action cap. With one repeated ID,
only one worker dispatches and only one attempt is stored. Workers also exercise
exclusive idle profile ownership through a symlink alias, disposal/reacquisition,
and SIGKILL leaving an orphaned lock that is never automatically stolen.

`tests/account-protocol.test.ts` uses production runtime creation and registered MCP
tools with only Chrome/page responses replaced. It proves identity precedes POST,
only the hashed member bucket is debited, repeat lookup sends no second POST,
account changes/unresolved identity stop before submission, separate profiles of
the same member share one journal, cold health verifies a session, and a restarted
runtime retrieves a quota outcome through a write cooldown. No fixture sends a
LinkedIn request.

`tests/engine-lifecycle.test.ts` covers final disposal, launch/dispose overlap,
retained idle ownership, failed launch cleanup, concurrent shutdown, unverifiable
shutdown and a checkpoint persisted after runtime construction.

The current complete gates and installation checks are recorded in
[ROADMAP_PROGRESS.md](ROADMAP_PROGRESS.md). Earlier write/checkpoint evidence is
preserved as dated evidence, with superseding boundaries documented here.

## Recovery and remaining limits

Locks deliberately fail closed after a crash. Stop all owners and related Chrome
processes before removing only a confirmed orphan lock directory. Preserve budget,
operation journal and circuit files. A lock age or dead PID alone is not proof
that Chrome or another owner is gone. Wrong/invalid owner metadata is never
silently deleted. `STATE_BUSY` before dispatch can be retried later with the same
operation ID; `unknown` is a lookup requiring manual inspection of the remote effect.

The guarantee assumes cooperating versions and local filesystem atomic operations.
It cannot defend against state deletion/rollback, older versions that ignore locks,
or an account switch in the interval between identity verification and a request.
No network-filesystem or power-loss durability certification is claimed. Breaker
state remains profile-scoped; same-member profiles share budgets but do not yet
broadcast checkpoint/cooldown events across profiles.

The original P0 implementation kept new bound records at conservative week 0.
This has been superseded by Phase 1: first verified use persists a warmup start
under the account-store lock, and elapsed completed local weeks drive the ramp.
Week 1 still blocks messages; no LinkedIn account age or legacy age is inferred.
Counters and journals survive this additive migration. Shared-state tests cover
restart/progression/backwards-clock refusal; current gates are in ROADMAP_PROGRESS.md.
