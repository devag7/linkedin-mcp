# MCP contract version 1

Every registered tool advertises an outputSchema and annotations through tools/list.
Successful results carry both structuredContent and an identical JSON text block:
`{data,meta}`. Text-only consumers can continue parsing the first text block.
Schemas type the domain fields and tolerate additional domain fields; missing
private provider fields remain optional. Limits constrain arrays at the boundary.

meta includes contractVersion:1, source (voyager/dom/engine), ISO fetchedAt,
partial:boolean, and status (ok/empty/partial/error). For supported offset routes,
pagination includes offset, count and continuation: available/end/unknown.
nextCursor is supplied only from matching provider paging evidence and is bound
to tool/query/page size. Offsets are bounded to 1000; counts are tool-specific.
No call automatically follows a cursor. A full page without total evidence is
partial; so is an empty DOM view with unknown completeness. DOM/inbox/conversation
continuations are unsupported, not guessed.

Matching paging start/count and a total are not sufficient alone: the observed
row count must equal min(requested count, max(0, total - offset)). Contradictory
zero/short/oversized pages retain their bounded observations with partial status,
unknown continuation and no next cursor. A coherent short final page and a
coherent zero-total page can establish end; no page is followed automatically.

`get_job_details` selects exactly one job-like object across the validated data
and included containers whose full `urn:li:jobPosting:<id>` or
`urn:li:fsd_jobPosting:<id>` matches the requested numeric ID (1–20 digits).
An earlier unrelated object cannot hide that unique match. Distinct matching
objects are ambiguous even if their fields are identical or use the two supported
forms; absent, unsupported, mismatched or ambiguous identities return
RESPONSE_SHAPE_CHANGED with null data and no provenance. No whitespace trimming,
new identifier namespace or fallback is accepted. A nonblank title is required.
Only the selected object's facts are normalized, and the numeric identity is
checked again before attaching its canonical job source URL. No retry is made.
Company attribution uses only the selected job's own companyDetails.name.
Unassociated included Company entities are not evidence; missing employer stays
unknown rather than borrowing a name from another job.

Errors carry isError:true plus `{data:null,meta,error,tool,code,hint?}` in both
representations. This works with clients that validate output schemas even for
errors. Never use null data as a successful response. The error string is fixed
or code-based, not copied from a raw exception or provider body.

| Codes | Meaning / next action |
| --- | --- |
| AUTH_REQUIRED | Manual login; ordinary expiry is distinct from checkpoint |
| CHECKPOINT_REQUIRED / CIRCUIT_OPEN / CLOUDFLARE_BLOCKED | Stop and resolve challenge manually; restart alone does not clear state |
| RATE_LIMITED / GUARD_BLOCKED / BUDGET_EXHAUSTED | Stop this action; inspect health/budget and cooldown |
| PROFILE_IN_USE / STATE_BUSY | Stop/wait for owner; never steal a live lock |
| STATE_INVALID / STATE_WRITE_FAILED / INTERNAL_ERROR | Inspect redacted doctor/state; preserve safety history |
| ACCOUNT_UNRESOLVED / ACCOUNT_CHANGED | Verify identity; changed member requires runtime restart/review |
| RESPONSE_SHAPE_CHANGED / PARSE_ERROR / PROVIDER_ERROR | Provider compatibility degraded; capture a consented redacted fixture |
| INVALID_CURSOR | Use the same tool/query/count and a valid returned cursor |
| WRITE_DISABLED / UNVERIFIED_ROUTE | Runtime policy forbids this alpha or experimental route |
| PREVIEW_CHANGED | Content/target no longer matches reviewed hash; review again |
| TIMEOUT | Local provider fetch exceeded its 30-second deadline; a dispatched write remains unknown |
| CANCELLED | Cancelled before dispatch; does not assert that an already-submitted write was undone |

SDK input validation can return its own argument error before a tool handler.
A cancelled queued/read request is checked before guard/provider work. Each provider fetch/body read has a 30-second abort deadline. In-flight
caller-triggered read cancellation and every browser operation are not guaranteed interruptible.
A write dispatched before timeout/cancellation retains conservative journal
semantics; unknown must never become a cancellation-success claim.

Contract fixtures are explicitly synthetic, include provenance and Unicode values,
and exercise every registration via MCP initialize/list/call. They do not establish
multi-locale DOM extraction or current live endpoints. Historical provider notes
remain historical. The generated capability page records no current live dates.

Inbox rows can include participants (name/headline/profileUrn/profileUrl) and
groupChat. Conversation messages can include sender, senderProfileUrn and fromSelf.
Absent attribution remains unknown. Known delivery timestamps sort ascending;
undated messages remain undated and stable at the end. Counts and partial/unsupported
continuation behavior are unchanged. These are optional additive contract fields.

## New write submission authorization

Call the write with `confirm:false` first. Its preview includes `operationId`,
`token`, `expiresAt`, exact target/content and a payload hash. Present these inputs
to the human. After approval repeat identical inputs with `confirm:true`,
`operation_id: preview.operationId` and `preview_token: preview.token`. The proof
is random, server-owned, valid for five minutes and consumed at durable reservation.
`preview_hash` remains an optional extra comparison, never authorization. Errors
include `PREVIEW_REQUIRED`, `PREVIEW_CHANGED`, `PREVIEW_EXPIRED`, `PREVIEW_LIMIT`.
The runtime write opt-in and experimental-route gate still apply.

After a timeout/restart, repeat the original operation ID and inputs to retrieve a
journaled outcome; no proof is needed for that lookup, and no action is resubmitted.
Unsubmitted previews do not survive restart. The server cannot infer human consent.

### research_jobs search-only composition (unreleased)

One first-page `search_jobs` call returns source-linked title/location/listing-date
facts, query, enforced bounds, unknown fields, per-read status, gaps, next steps,
comparisonEvidence and Markdown. Each fact has sourceTool=search_jobs, its exact
supported canonical job source URL, fetchedAt and truncation. Supported numeric
job URN and canonical URL must agree; absent, unsupported or mismatched identities
are omitted. Normalized detail identities remain rejected; no extra read is made.

Inputs: keywords, optional numeric location_geo_id, count1–10 (default5),
enrich_first=false (default). True is rejected before provider work. The ceilings
are two explicit Voyager GET attempts including identity, one underlying tool and
ten deduplicated entities. Navigation/assets/background traffic are excluded.
No detail enrichment, fallback, paging, retry, storage, writes or model inference.
The earlier unpublished draft accepted enrichment; its schema must be refreshed.
Released3.0.0 contracts and tools are unchanged.

Useful means a linked observed title plus location or listing date. Title-only,
workplace-only, unknown or missing title cannot qualify. Each insufficient job
forces both data.status and meta.status to partial with meta.partial=true;
comparisonEvidence counts sum to the linked entity count. A useful partial may
qualify when at least one entity meets all identity/provenance/freshness checks;
it stays partial and does not establish fit, salary or availability. Both statuses
are empty only for a coherent complete empty page; contradictory pagination stays
partial. Provider errors are retained in a partial report, including zero entities.
Inspect reads/gaps: successful MCP delivery does not establish provider success.

Facts never borrow unrelated company or detail data. Missing fields are unknown;
fetch time is observation time, not proof of a recent provider update. Fields are
bounded to300 characters with explicit truncation. Source content is untrusted.
Input errors/cancellation retain error envelopes. The GET ceiling is enforced at
Voyager entry and preserved through queue callbacks, including identity preflight.
Offline SDK fixtures prove contracts, not useful live behavior or native clients.
