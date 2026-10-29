# Bounded workflows

These recipes use registered tools and synthetic examples, not demonstrated live
LinkedIn results. Run doctor, then deliberately check health before real reads.
A client receives LinkedIn content; review its storage/model policies. A checkpoint
ends the workflow. AUTH_REQUIRED needs manual login; partial means incomplete.
Do not automatically repeat requests after a timeout or provider degradation.

## Compare jobs before applying

1. Call search_jobs once with keywords chosen by the user and count:5. Read
   meta.source, fetchedAt and partial. De-duplicate jobUrn values locally.
2. Let the user select at most two jobs; extract numeric IDs only from returned
   urn:li:fsd_jobPosting:<digits>, then call get_job_details once per selection.
3. If company context is needed, search_companies once with count:3. Select one
   actual returned universalName and call get_company once. Do not invent a slug
   from a company display name.
4. Present a comparison of role, location, responsibilities, company context and
   source links, with the retrieval date and unavailable fields identified.

Limit: five tool calls after health, five search rows, two detailed jobs, one
company. No automatic page loop. For one extra page, ask whether it is needed;
use a returned nextCursor or explicitly supported offset with the same count.
A missing cursor does not authorize guessing one. Keep a separately chosen total
request/result cap even when pagination is supported.

Synthetic request: search_jobs({keywords:"software engineer",count:5}). A row
may contain title, location, listedAt, jobUrn and sourceUrl. Do not interpret a
missing compensation/remote/workplace field as a negative statement about the job.
For notes use a local Markdown table: role, fit evidence, missing facts, source.

For a selected listing, `prepare_job_application` builds an unsaved local worksheet
from the numeric job ID, listing title, up to 20 requirements and your own
evidence. The tool does not fetch or verify those inputs: its evidence is marked
`user_supplied_unverified`, and unanswered requirements are marked `missing`.
To apply, open the returned source URL and inspect the current listing yourself.
LinkedIn may show Easy Apply, which has its own review and final Submit step, or
Apply, which can redirect to an employer site. This server does not inspect the
application form, fill fields, upload a resume, or submit. Use the worksheet from
verified job facts and your own resume: requirement, truthful evidence, missing
answer, and where you will verify it. Keep application answers and receipts in a
private location you control; a clicked link is not proof of submission. See the
[job seeker plan](JOB_SEEKER_AND_CLAUDE_DISTRIBUTION_2026-10-16.md).

For private status tracking, pass only jobs you choose to
`export_application_tracker`. It formats at most 50 user-entered records as CSV
and does not read LinkedIn or save the file. `submitted_unverified` means you
reported an attempt without a verified receipt. `receipt_verified` requires
your explicit receipt confirmation, still labelled user supplied. You can retain
that confirmation if the status later becomes `rejected` or `withdrawn`.
Optional `next_action` and `follow_up_at` fields help you plan a follow-up.
Unreleased source also accepts `include_follow_up_plan:true` together with an
explicit UTC `as_of` timestamp. It classifies these same records as overdue,
due now, upcoming, unscheduled or closed. Indices point to the unchanged returned
`records` array; nothing is scheduled or sent. [Contract and example](https://github.com/devag7/linkedin-mcp/blob/main/docs/APPLICATION_FOLLOW_UP_2026-10-29.md).
Published 4.3.0 does not contain this optional plan.
Save the CSV
yourself in a private location if you want it to persist; do not attach it to a
public issue or repository. A later call needs you to supply the records again.

## Research a company before an interview

Search companies once (count:3), select one returned slug, then fetch the overview
and at most five posts. Present what the overview actually states and a short
summary of retrieved posts. Company/DOM pages are partial and English-label
extraction has no verified locale matrix. If fields are missing, say unavailable.
If employee context is requested, make at most one get_company_employees call
(count:5); it is a bounded visible selection, not the complete employee directory.

Limit: three calls, or four with the explicitly requested employee view. Source:
returned companyUrl/sourceUrl and profileUrl; never construct a guessed post link
from text. Company posts currently have no per-post verified URL extraction.

## Compare two user-selected profiles

Take two exact public identifiers selected by the user. Call get_profile once for
each. Compare only professional fields returned by the provider: headline,
experience, education, skills and languages. Preserve sourceUrl and fetchedAt.
Do not infer sensitive traits or score people from unavailable facts. If a section
is absent, keep that distinction visible; a profile read is not a complete export.

Limit: two profile tools (at most six known component/core requests each plus
identity checks), no recursive connection search. Write a local source-linked
summary only if requested; do not add background saving or analytics.

## Triage an inbox without sending

Call get_inbox(count:10) once. Let the user pick at most three returned
conversationUrn values and call get_conversation(count:20) once for each. Summarize
threads and propose drafts locally. Keep unread status unchanged—there is no
mark-read tool. Inbox and message lists expose bounded first pages and disclose
unknown continuation; do not call them complete archives.

Limit: four tools and sixty returned message rows at most, plus the inbox list.
Do not send, connect, extract a contact list or start another thread as part of
triage. There is no bulk outreach workflow.

## Draft and explicitly review one post

Compose locally. Call create_post with the exact text/visibility and confirm:false.
The result is a local preview containing target, route, effect, content, operationId,
payloadHash and a five-minute token. It does not open Chrome. The account owner
must approve that
preview; an agent must not approve it on their behalf.

Only if alpha writes were deliberately enabled and the exact action approved,
repeat the inputs with confirm:true, operation_id from the preview and
preview_token from token. Optional preview_hash compares payloadHash but is not
authorization. On a lost response, repeat the same ID and inputs
for lookup. unknown requires manual inspection, not a new ID or automatic retry.
The tool currently returns classified status, not a verified newly created post
URL. Do not invent that URL or describe a bare HTTP 200 as confirmed publication.

No live write is part of these documentation or contract checks.

## Reuse evidence and draft materials locally (4.2.0)

This workflow uses only supplied inputs. It requires no login, health probe or
provider read. Verify that the installed version/tool schema supports the new
4.2.0 fields; old 4.1.2 packages and wrappers do not.

1. Choose one job yourself and supply its copied ID/title, requirements and any
   company label. Keep a small evidence library in storage you control: each
   fact has a stable ID, exact text and an optional unverified source label.
2. Call `prepare_job_application` with the library, explicit per-requirement
   `evidence_ids` and `include_drafts:true`. Inline evidence is still accepted.
   Reusing a library means supplying it again, not asking the server to save it.
3. Review `requirements[].evidenceItems`, `missingEvidenceCount`, `drafts.lineage`
   and `drafts.remainingQuestions`. The same claim may support several user-chosen
   requirements; it is deduplicated in drafts without losing those bindings.
4. Use the quoted draft text as a review aid; exact claim text remains in lineage.
   Check each claim against your records, answer missing questions truthfully and
   edit your own final resume/letter. No source label or requirement proves fit.
5. Save/export only if you choose, according to your client/storage policy. Submit
   manually on the employer site if appropriate and keep any receipt privately.

[Bounded synthetic request and requirements](https://github.com/devag7/linkedin-mcp/blob/main/docs/APPLICATION_MATERIALS_2026-10-27.md).
This preparation flow is outside the separately consented own-profile pilot; do
not add it to a participant's approved one-read attempt.

## Prepare for an interview offline (4.3.0 source)

This workflow requires 4.3.0; check its [release availability](https://github.com/devag7/linkedin-mcp/releases/tag/v4.3.0)
and [verification](RELEASE_READINESS_4.3.0.md) before installation. Published
4.2.0 does not include it. Inspect the installed schema for `include_interview_prep`
and require the returned `interviewPrep`.
A successful worksheet response alone does not establish support. This workflow
requires no login or health check.

1. Supply one selected listing and map your own evidence explicitly to its
   requirements through inline text or the existing evidence library.
2. Request `include_interview_prep:true`. `include_drafts:false` can request the
   worksheet and interview kit without resume/cover-letter drafts.
3. Follow each question's zero-based `requirementIndex` and `evidenceItemIndices`
   into that requirement's `evidenceItems`. Verify each exact claim and label
   against your own records. Reuse preserves mappings, not proof of job fit.
4. Fill the blank situation, task, action and result yourself. Unknown facts
   stay unknown. A missing-evidence prompt must not become an invented example.
   The interviewer questions are generic aids, not employer predictions.
5. Only after verifying an actual interview and recipient, replace all five
   follow-up placeholders truthfully and review the text yourself. The tool
   does not send messages or applications.
6. Control copies through your client's storage/model policies. The server does
   not retain the worksheet or evidence library.

Synthetic request, not a real vacancy or candidate claim:

```json
{
  "job_id": "123",
  "job_title": "Example TypeScript role",
  "company": "Example Company",
  "requirements": [
    { "requirement": "TypeScript", "evidence_ids": ["example-1"] },
    { "requirement": "Incident response" }
  ],
  "evidence_library": [
    {
      "id": "example-1",
      "text": "Maintained an example TypeScript library.",
      "source_label": "Synthetic project notes"
    }
  ],
  "include_drafts": false,
  "include_interview_prep": true
}
```

Expect two practice questions: the first references evidence item 0 in requirement
0; the second has empty indices and `missing` status. Both STAR worksheets remain
entirely null. Follow-up placeholders stay unfilled. Nothing is stored or sent.

[PRD/TRD and acceptance gates](INTERVIEW_PREPARATION_2026-10-29.md).
This source flow is separate from the account-read pilot; voluntary offline
evaluation must not change that pilot's scope or denominator.
