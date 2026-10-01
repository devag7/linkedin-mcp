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
The result is a local preview containing target, route, effect, content, operationId
and payloadHash. It does not open Chrome. The account owner must approve that
preview; an agent must not approve it on their behalf.

Only if alpha writes were deliberately enabled and the exact action approved,
repeat the inputs with confirm:true, operation_id from the preview and
preview_hash from payloadHash. On a lost response, repeat the same ID and inputs
for lookup. unknown requires manual inspection, not a new ID or automatic retry.
The tool currently returns classified status, not a verified newly created post
URL. Do not invent that URL or describe a bare HTTP 200 as confirmed publication.

No live write is part of these documentation or contract checks.
