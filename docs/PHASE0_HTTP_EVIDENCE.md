# Phase 0, change 1: local HTTP boundary

Current verification note: 2026-10-01 (Asia/Kolkata). The HTTP implementation was
completed before the checkpoint and write-transaction milestones. This note
replaces a missing evidence file and reports only currently verified checks.

The listener binds to `127.0.0.1`, requires a bearer secret on every route,
validates exact Host/Origin, rejects duplicate security headers, and grants no
CORS access. JSON bodies, upload/response deadlines, headers, and active requests
are bounded. Per-request MCP servers share one process-owned browser and safety
stack; shutting down the listener disposes that runtime.

The current `tests/http.test.ts` has 12 passing cases covering unauthenticated
health/MCP requests, hostile Host/Origin, wrong bearer token, content type and
compression, malformed/oversized bodies, startup token validation, loopback
binding, authenticated health, and idempotent shutdown. `tests/tools.test.ts`
exercises actual production registrations across two HTTP MCP clients with
LinkedIn-facing work replaced by fixtures. Current lint/typecheck/build and all
268 tests pass in the actual workspace.

This is local synthetic evidence, not a remote deployment, live LinkedIn, or
cross-process safety certification. Older missing regression suites are not
claimed to be preserved verbatim. See [SECURITY.md](../SECURITY.md) and
[write-transaction evidence](PHASE0_WRITE_EVIDENCE.md) for remaining boundaries.
