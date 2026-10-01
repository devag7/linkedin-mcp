# Contracts, bounded reads and reviewed alpha actions

Local evidence dated 2026-10-01 (Asia/Kolkata), unreleased package 2.0.3.
All changes preserve existing Voyager write bodies; none was tuned by guessing a
new payload. No live LinkedIn call or write was made.

## Implemented boundaries

- A shared registration helper publishes each tool's input/output schema and
  read/write/open-world annotations. Count is derived from successful registrations.
  A typed route catalog drives whoami, local metadata and generated documentation.
  Current live check dates are null, and disabled writes are reported disabled.
- Every tool returns native structuredContent plus identical JSON text. Metadata
  carries contractVersion:1, source, fetchedAt, partial and status. Errors preserve
  legacy root code/error fields inside an output-schema-compatible null-data
  envelope, including for clients validating error responses.
- Fixed errors/log codes replace raw exceptions; DOM terms/slugs and Voyager URLs
  are absent from normal debug output. Provider HTTP-200 errors and malformed or
  unknown empty shapes cannot become a successful empty array. Missing core job/
  profile fields degrade explicitly; DOM and selected-profile views stay partial.
- Existing job/feed/notification start/count builders accept bounded explicit
  offsets. Cursors are emitted only with matching provider start/count/total,
  tied to tool/query/count, and bounded to offset 1000. Unknown continuation stays
  unknown. DOM, inbox and conversation expose bounded first pages; invitations
  return at most 100 per direction (200 for both). No implicit crawl is added.
- Preview returns exact normalized target/content/audience, route/effect, operation
  ID and payload hash without opening Chrome. Supplied approval hash must match.
  Browser writes default disabled; new-thread messaging has an additional
  experimental flag. Existing explicit confirm behavior and journal replay remain.
- Request cancellation is explicitly bound across queue execution contexts and
  checked before provider work. Pacing/working-hour/break timers can be cancelled.
  Each in-page fetch/body read has a 30-second abort deadline. A dispatched timeout
  leaves one durable unknown operation and replays it without another fetch.
- Health/doctor validate their final identity sample. An observed changed member
  latches AccountBinding and blocks subsequent production reads as well as writes.
- Known job/profile/company/activity identifiers produce source URLs; a created
  post URL is not invented. Bounded workflow recipes use these fields and mark
  unavailable/partial data. The offline demo uses actual MCP calls with synthetic
  content and a persistent stop; no browser can open.

## Evidence

contracts.test.ts uses actual MCP initialize/list/call and the SDK client's output
validation for all 22 registrations. Its 60 cases cover native/text parity,
annotations/inventory, each read's typed/redacted error states, bounded empty/partial
lists, wrong cursor/query/count/offset, local write previews/default refusal,
changed preview and experimental policy, invalid provider shapes and real queued
MCP cancellation. Synthetic Unicode fixture provenance explicitly says capturedAt
null; it is not a multi-locale DOM capture.

write-transaction.test.ts covers all five real registrations, reserves before page
evaluation, classifies semantic errors/cooldowns/duplicates/unknown, durable crash
reservations and repeated IDs. Two additional cases execute the actual in-page
callback with synthetic aborting fetch/body streams and simulated timers: one
submission, unknown debit, no lingering deadline timer, no replay dispatch.
Account and checkpoint suites exercise runtime wiring; no Chrome/provider is used.

metadata.test.ts validates server.json against the official public 2025-12-11
schema retrieved directly on 2026-10-01, rejects oversized descriptions/bad
transports and verifies package/version/catalog/client consistency. CI's metadata
check fails stale generated files; it does not silently rewrite a release.
Schema validation is not an accepted registry listing or publication.

The clean dependency installation and source/compiled/packed gates are recorded
in ROADMAP_PROGRESS.md. Public fixtures use synthetic IDs/content only. Missing
tracked files are recovered and the packed license is mandatory. Pack verification
also excludes legacy auth/config markers from the shipped graph.

## Remaining proof

No current endpoint capture, consented live write, official API app, hosted OS/Node
job or real client-application first read was performed. In-flight Chrome/fetch
cannot always be interrupted by caller cancellation; abort does not undo a remote
write. Optional DOM fields/locales and unsupported continuations need new captures.
Full shared-state erasure tooling and user workflow/adoption measurement remain
explicit gaps in ROADMAP_COVERAGE.md. Local changes need separate review/release;
no version bump, push, merge or publication is implied.
