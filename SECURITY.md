# Security Policy

## Supported versions

The current code line is 2.x. This document describes the source checkout;
installing an older published version does not include unreleased fixes.

## Reporting a vulnerability

Do not put credentials, browser profiles, private messages, or exploit details in
public issues. Use GitHub private vulnerability reporting if enabled, or contact
the maintainer privately using the repository profile. Include the version,
transport, reproduction steps, and impact with synthetic or redacted data.

## Local HTTP boundary

Stdio is the default. HTTP must be explicitly selected with `--transport http`
or `TRANSPORT=http`. It binds only to `127.0.0.1`; there is no remote-bind option.

All endpoints require a local bearer secret from `LINKEDIN_HTTP_TOKEN`, including
health and protocol initialization. Startup rejects missing or malformed tokens.
Use a cryptographically random secret, store it in protected local client
configuration, and rotate it by restarting the server with a new value. The token
is a local access control, not an OAuth implementation or a remote authentication
service. It is never forwarded to LinkedIn.

Host is restricted to `127.0.0.1:<bound-port>` and `localhost:<bound-port>`.
An Origin, when present, must exactly match the HTTP origin for that Host.
Duplicate security headers are rejected. Forwarding headers do not authorize
requests. No wildcard or other CORS access is granted. Browser CORS clients,
reverse proxies, tunnels, LAN exposure, and serverless deployments are unsupported.
Do not publish or forward this listener.

Requests require uncompressed JSON, with a 1 MiB limit, a 10-second body deadline,
and a 180-second response deadline. Headers are limited to 16 KiB with a 10-second
header timeout. Active HTTP requests are capped at 16; TCP connections at 32.
HTTP transport errors do not log headers, body contents, tokens, or raw SDK errors.
This is not a claim that every existing tool log has been audited for redaction.

MCP protocol servers share one process-owned browser and safety stack. Per-request
cleanup closes protocol resources; listener shutdown disposes the browser, including
an in-progress launch, and prevents queued work from relaunching it. A timeout or
disconnection does not establish whether an in-flight LinkedIn action completed.
The transport never automatically retries writes. Verify the outcome manually
before retrying.

The boundary follows the MCP guidance on origin validation, loopback binding, and
authentication: [MCP Streamable HTTP security](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#security-warning).

## Session and local data

The active v2 path uses a persistent Chrome profile, not the legacy cookie/OAuth
helpers. Treat `LINKEDIN_PROFILE_DIR` (default `~/.linkedin-mcp/profile`) as
credentials. Chrome may persist cookies, cache, and browsing data there. The safety
layer also persists budget and circuit-breaker state locally. Breaker state uses
`<profile-directory>.circuit.json`, outside the profile, with atomic replacement
and owner-only files. Corrupt/unreadable state prevents startup; save failures
stop the running process from issuing further automated calls. Repair storage
before restarting after a save failure; a failed write cannot prove durability.

`--logout` recursively deletes the configured browser profile directory. It does
not clear separate safety-state files. A custom profile requires the additional
`--confirm-profile-deletion` flag before its entire directory can be removed. Do not point it at a directory containing
unrelated data. Never commit or attach a browser profile to a support request.
Use a trusted local OS account and review tool arguments before approving writes.

## Checkpoint stops and recovery

The browser engine, Voyager response handling, and DOM fallbacks share the
persisted hard breaker. Response classification runs before auth parsing or raw
write classification. Queued tools recheck after pacing; session diagnostics do
not perform a live probe while stopped. Stops persist across runtime/process
restart and survive profile logout. No response bodies or URLs are written into
the hard-stop reason. Successful JSON content is not scanned for challenge words.

Only interactive `--login` can clear the hard stop after verifying a clean feed
page and a `/me` response with an identity. Cookie presence alone is insufficient.
Stop other processes before recovery, then restart them; existing runtimes do not
reload a human reset automatically. Soft action cooldowns remain in effect.

Ordinary login/authwall URLs and 401 responses are distinct from explicit
checkpoint signals. Opaque redirects do not expose their destination and cannot
be reliably classified as a checkpoint. DOM checks inspect bounded page titles
and challenge controls, not arbitrary feed/profile text. Challenge variants not
covered by these signals remain a compatibility limitation. In-flight work cannot
be undone when a separate request detects a challenge.

## Reviewed alpha writes

All five writes are disabled by default. `LINKEDIN_ENABLE_WRITES=true` is an
explicit opt-in; every submitted action still requires confirm:true. A local
preview exposes target, content, route, effect, operation ID and payload hash
without opening Chrome. The required server-issued preview_token on approval refuses changed
content before browser work. New-thread messages additionally require
LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES=true; current live success is unverified.
The release runtime has no pacing bypass and supports only serial execution.

## Write accounting and replay protection

Approved writes reserve an attempt immediately before the in-page request and
persist an `unknown` journal entry together with the conservative budget debit.
Only a recognized successful outcome increments connection success analytics.
Returned quota/restriction outcomes trigger an action cooldown inside the guard.
If a submitted request disconnects, times out, or has an ambiguous response, it
returns `unknown` and is never retried automatically. A checkpoint preserves that
uncertain result while hard-stopping subsequent automated work.

Each tool accepts a caller-generated `operation_id`; repeated identical inputs
return the stored status/code without browser work. Reuse with different inputs
is rejected. A generated ID cannot be recovered by a caller who loses the response;
supply an ID in advance. This is local replay protection while state is retained,
not LinkedIn-side idempotency or proof that a remote action happened exactly once.

The existing `~/.linkedin-mcp/budgets.json` now contains the journal as well as
counters. No target content, raw response detail, cookies, or authentication tokens
are stored in journal entries. Input hashes are fingerprints, not anonymization.
State is validated, bounded to 8 MiB, and replaced using a synced temporary file
and atomic rename requesting POSIX mode `0600`. Node mode bits do not establish
Windows ACL privacy; use an account-private directory and see
[platform permission limits](docs/PRIVACY.md). Corruption/read failures block startup; save
failures latch a stop in the running tracker. Preserve reservations when repairing
storage. Unknown invitations remain conservative inputs to safety gates across days.

The journal stops new writes at 10,000 retained operations rather than evicting IDs.
`--logout` does not remove the journal. Deletion, rollback to code that does not
preserve journal fields, or bypassing the shared state lock can invalidate replay
protection. File replacement and locking do not guarantee durability through every
filesystem/power-loss failure.

## Remaining boundaries

- This is an unofficial browser integration. Pacing and daily caps cannot ensure
  LinkedIn compliance or prevent account restrictions.
- Profile ownership is exclusive across compliant local processes. It is retained
  during idle/close_session and released on verified final browser disposal.
  A crash or failed shutdown requires manual orphan-lock repair after stopping
  associated processes. No automatic lock stealing is implemented.
- Authenticated opaque member identity is hashed for budget keys. Different
  profiles of one member share counters and operation IDs. Identity is rechecked
  on browser relaunch and before writes; changes block the runtime.
- Reserve/commit reload state under a shared filesystem lock. A busy lock refuses
  work before dispatch; commit contention leaves a durable unknown reservation.
  Legacy default counters remain an unattributed conservative safety floor.
- Protection assumes cooperating versions and local filesystem atomic operations.
  It does not defend against a local user deleting, replacing or editing safety
  files, older versions that ignore locks, or arbitrary session switching between
  identity verification and a provider request.
- HTTP response deadlines do not cancel tool work or guarantee bounded tool queues.
  Caller-provided IDs allow stored outcome lookup; automatic reconciliation of
  unknown outcomes remains future work.
- Tests use local protocol clients and synthetic fixtures. They do not establish
  live LinkedIn compatibility or certify Docker/browser deployment security.

## Setup diagnostics

`--doctor` reads local setup state without opening a browser or making a network
request. It reports fixed status fields and instructions, omitting private paths,
credentials, profile data and raw errors. `--doctor --live` explicitly performs
an authenticated identity read and then disposes its browser/profile ownership.
A hard stop or occupied profile prevents that probe. It never sends writes.

The packed artifact is exercised locally with isolated installation and two fresh
stdio processes. The [hosted Node20/22 matrix](https://github.com/devag7/linkedin-mcp/actions/runs/36853809883)
passed all 12 source/package jobs on Linux, macOS and Windows, including actual
Chrome launch, ownership and cleanup with empty temporary profiles. This does not
prove live LinkedIn behavior, Windows native ACL privacy or release authentication.
LICENSE was recovered from the committed revision after cloud-sync deletion;
packed-package checks require it. No publishing was performed.

### PR #3 preview and erasure corrections (2026-10-01)

New write submissions require a server-issued random `preview_token`, the preview's
`operation_id`, identical action/target/content, and `confirm:true`. Tokens are
process-local, expire in five minutes, and are consumed only after a durable
reservation. Revalidation occurs after pacing and immediately before reservation.
Client workflows must obtain explicit human approval; the server cannot infer it.
Tokens and raw preview content are not persisted in the journal. A restart requires
a fresh preview for unsubmitted actions. Existing journal outcomes remain readable
with the original ID and exact inputs, including unknown outcomes, without a token
or enabled writes; they never authorize a new dispatch.

Logout refuses symlinks, junctions, aliased ancestors, filesystem roots, home and
workspace ancestors. It locks, rechecks directory identity and renames the original
entry before deletion, checking that the moved entry is still that directory. Nested
links are unlinked without traversing targets. This protects ordinary accidental
aliases and entry replacement; Node filesystem APIs do not provide an atomic
open-relative deletion primitive against an adversarial local process replacing
ancestor directories. Keep state directories private. Windows ACL verification is
still an explicit open item. Safety journals and checkpoints survive logout.
