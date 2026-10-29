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

`get_job_details` verifies a numeric `urn:li:jobPosting:<id>` or
`urn:li:fsd_jobPosting:<id>` matches the requested ID before attaching its canonical
job source URL. An absent, unsupported or mismatched identity returns
RESPONSE_SHAPE_CHANGED with null data and no provenance; it is never retried.
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

## Optional application evidence and drafts (4.2.0 source)

`prepare_job_application` retains its original inputs and response shape when
new options are omitted. `evidence_library` accepts up to 30 user-supplied
`id`/`text`/optional `source_label` records; each requirement can select up to
10 unique `evidence_ids`. IDs are case-sensitive, 1–64 ASCII alphanumeric,
hyphen or underscore characters, with an alphanumeric first character.
Missing or duplicate references return `INVALID_APPLICATION_EVIDENCE`; no
reference is guessed. Source labels are unverified opaque text, never read
as files or fetched as URLs. Existing inline evidence remains supported. In a references-only row, the old
`evidence` field remains null while `evidenceItems` carries the selected facts
and `evidenceStatus` reflects their presence; mixed rows preserve both sources.

Extended rows retain selected exact evidence and its lineage, distinguish
missing evidence, and exclude unused library facts. `include_drafts:true`
adds `drafts`: JSON-quoted plain-text resume bullets, a cover-letter draft,
source/requirement lineage and remaining questions. Exact selected claim text
remains in lineage; displayed values are delimited so controls/newlines stay visible as supplied data.
Clients must still treat all supplied text as untrusted content. All supplied claims remain unverified;
the engine does not assert a match score, qualifications or submission.
Drafting is deterministic and uses no provider, model, file or storage call.
`submitted:false` and `stored:false` remain true guarantees for this tool.
Published 4.1.2 does not support this extension; verify 4.2.0 availability and
the installed schema separately. Native usefulness remains unmeasured.

## Optional interview kit (unreleased source)

Published 4.2.0 does not support this option. Check the installed tool's advertised
schema and returned `interviewPrep`; a successful worksheet response alone does
not establish support.

`include_interview_prep:true` independently requests practice questions and a
fill-in follow-up template. Omitting the option or passing false preserves the
previous output. Existing evidence bounds and missing/duplicate-reference errors
continue to apply. No new tool is registered.

The optional `interviewPrep` contains:

- `status:"practice_only"` and `verification:"user_supplied_unverified"`.
- One `practiceQuestions` item per requirement, up to 20. Each contains its
  zero-based `requirementIndex`, quoted question, `evidenceStatus`,
  `evidenceItemIndices` and a `starWorksheet` with null `situation`, `task`,
  `action` and `result`. No anecdote or result is inferred.
- Evidence indices resolve only within
  `requirements[requirementIndex].evidenceItems`. These rows are present when
  interview preparation is requested, including when drafts are disabled.
  Exact selected text and all its supplied source bindings remain in those rows;
  unused library facts stay absent. Missing evidence has empty indices.
- Three generic `questionsForInterviewer`, not predictions of employer questions.
- A `followUpTemplate` with `kind:"fill_in_template"`,
  `requiresVerifiedInterview:true`, subject/body and five placeholders:
  `[INTERVIEWER_NAME]`, `[INTERVIEW_DATE]`, `[DISCUSSION_TOPIC]`,
  `[NEXT_STEP_OR_QUESTION]` and `[YOUR_NAME]`. Verify actual interview context
  before manually completing or using the template.

Supplied role, company and requirement strings are JSON/control-quoted in
rendered text. Exact structured claims and labels remain untrusted data. No
interview event, recipient, answer, qualification or sent message is established.
The tool adds no provider, model, file, storage or send operation; outer
`submitted:false` and `stored:false` remain unchanged.

Implementation, package, review and hosted gates remain separate from public
release. Offline checks do not establish native-client or interview usefulness.
