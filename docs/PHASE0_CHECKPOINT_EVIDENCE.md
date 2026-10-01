# Phase 0, change 2: persistent checkpoint stops

Date: 2026-09-30. Baseline: `1b4a4c8` plus the local HTTP changes documented in
[PHASE0_HTTP_EVIDENCE.md](PHASE0_HTTP_EVIDENCE.md). Status: local implementation;
no release or live LinkedIn verification.

## Evidence and decision

Inspection found that production instantiated the breaker without storage,
Voyager classified HTTP errors before examining challenge signals, and the Guard
only soft-tripped on HTML challenges. Queue prechecks happened before enqueueing,
so queued work could proceed after a stop. Session health bypassed the guard,
DOM searches could return an empty result from a challenge page, and invitation
fallbacks could swallow the triggering exception.

Use one browser-safety observer shared by the engine, Voyager, and Guard. Inspect
HTTP status and final URL before ordinary auth parsing, and bounded response
signals before raw writes return. Trip immediately at that boundary so swallowed
errors cannot permit another request. Persist only fixed reasons and breaker
counters; never persist a raw URL, response body, cookie, or message.

## Changes

- `src/browser/safety.ts`: challenge observation, safe error codes, bounded DOM
  inspection, normal-login distinction, and request gates. URL/status inspection
  precedes DOM evaluation so a destroyed JS context cannot hide a known checkpoint.
- `src/safety/circuit-storage.ts`: validated, bounded state reads and atomic
  owner-only file replacement. State is a sibling of the profile and survives
  profile deletion. Invalid/unreadable state fails closed at startup. A write
  failure blocks the running instance and requires storage repair.
- `src/browser/engine.ts`, `voyager.ts`, and `dom.ts`: shared observation across
  browser-backed calls and DOM fallbacks. Standalone browser helpers use persisted
  safety by default; interactive login explicitly permits manual recovery.
- `src/browser/guard.ts`: recheck at queue execution and after pacing; trip inside
  the queued task before the next task can start.
- `src/tools/session.ts`, `result.ts`, and `discovery.ts`: health reports a blocked
  account without probing; errors expose `CHECKPOINT_REQUIRED`/`CIRCUIT_OPEN`;
  invitation fallbacks rethrow stop errors instead of continuing.
- `src/browser/recovery.ts` and `login.ts`: interactive recovery requires a clean
  LinkedIn feed and an identifiable `/me` response. Cookies alone cannot reset
  the stop. Soft cooldowns remain intact.
- README and SECURITY explain state location, manual recovery, and limitations.

## Test coverage

Synthetic fixtures exercise HTTP 999, checkpoint URLs, HTML and error-envelope
challenges, raw POST/DELETE/GraphQL paths, normal login expiry, and benign JSON
containing challenge-related words. MCP tests cover later reads/writes, blocked
health probes, invitation fallback propagation, and restart. Additional tests
cover a separate Node process, queued calls, corrupt state, storage failure,
owner-only state files, DOM fallbacks, and verified versus rejected recovery.

## Validation results

On macOS / Node 22.14.0, using a clean temporary verification copy:

| Check | Result |
| --- | --- |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 243 tests, 14 suites; 38 checkpoint-specific cases |
| `npm run build` | Pass, Node 20-targeted bundle |
| Built stdio artifact | Two fresh processes each list 22 tools, reject a read with `CIRCUIT_OPEN`, report blocked health, and close cleanly |

The normal workspace validation runs stalled on filesystem reads inside local
`node_modules` and were stopped. The passing runs used `/tmp/linkedin-mcp-checkpoint-vKKVaP`,
created from the archived repository baseline plus the current edited source and
tests, with a clean install of the existing lockfile. No dependency versions or
lockfile were changed. These results do not claim the original dependency-directory
problem is repaired, CI has run, or Windows/Linux and Node 20 have been tested.

The built-process test used an isolated profile and a nonexistent Chrome path,
with a synthetic persisted stop. No account content or live requests were needed.

## Boundaries and next change

This is evidence for the implemented signals, not proof of live compatibility
with every LinkedIn challenge. Opaque redirects hide their destination and remain
`AUTH_REQUIRED`; the implementation does not invent a checkpoint diagnosis.
DOM detection inspects bounded titles/challenge controls, not arbitrary profile
or feed content. Existing requests already in flight cannot be undone.

Stop all processes using the profile before interactive recovery and restart them
after verification. Cross-process profile ownership and atomic budgets remain
separate roadmap work. A failed disk write cannot prove durable persistence;
repair storage before restarting. Existing circuit files must not be deleted as
a way to bypass a checkpoint.

Next: classify write outcomes inside guarded accounting; distinguish attempted,
successful, and uncertain outcomes; apply cooldowns to returned 429/restrictions;
never automatically retry ambiguous writes. Live write endpoint changes still
require authorized capture/probe evidence rather than guessed payloads.

No live LinkedIn calls, public messages, version bump, or release were performed.
The original roadmap and `pr_diff.txt` remain untouched. Earlier HTTP changes are
preserved. Rolling back should retain the stored stop and keep automation disabled
until the account is manually resolved; do not delete the state as a rollback.
