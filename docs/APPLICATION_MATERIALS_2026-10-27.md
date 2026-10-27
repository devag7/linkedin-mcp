# Reusable application evidence and draft materials

Implementation milestone: October 27, 2026. This is an additive source feature
for `prepare_job_application`; published 4.1.2 remains unchanged and does not
support these new fields. Publication, native usefulness and live account
compatibility are separate acceptance steps. No new provider access is needed.

## Product requirements

A job seeker should be able to keep a small evidence library in their own client,
select the facts relevant to one chosen job, and obtain reviewable resume bullets
and a cover-letter draft without rewriting those facts for each application.
Every statement remains user-supplied and unverified. Mapping a fact to a
requirement is the user's decision, not a scored assessment of job fit.

Required:

- Accept a bounded reusable evidence library with stable IDs and source labels.
- Let each listing requirement reference selected evidence IDs, while retaining
  the existing inline-evidence input for older callers.
- Refuse ambiguous or missing references instead of guessing which fact was meant.
- Keep exact evidence text and source labels attached to their requirement mapping.
- Generate plain-text draft materials only when explicitly requested. Include
  only mapped evidence, deduplicate repeated facts and retain their lineage.
- Identify requirements with missing evidence. Empty evidence must not become
  an assertion of eligibility, experience, qualification or successful submission.
- Return the result to the client without retaining a server-owned library or file.
  The client controls reuse, export, retention and deletion of its own copies.

Not included in this milestone:

- Fetching listings or profiles, reading resume files, parsing PDFs, browser
  navigation, application filling, uploads, messages or submission.
- Model inference, invented achievements, automatic evidence matching, fit scores,
  credential verification, cloud storage, background jobs or mandatory paid services.
- A persistent tracker, shared template database or complete coordinated erasure.

## Technical requirements

The existing tool keeps its name and existing input behavior. New fields are
optional: `evidence_library`, `requirements[].evidence_ids` and `include_drafts`.
The registry continues to expose 24 tools. A request without new fields must
retain its existing response shape and behavior.

The library allows at most 30 records, each with a bounded ID, up to 1,000
characters of evidence text and an optional source label of up to 200 characters. Each
requirement can reference at most 10 unique IDs. The existing maximum of 20
requirements remains. Duplicate IDs, duplicate references and unresolved
references fail before drafting; they never silently overwrite a record.

Library text/source labels preserve their exact supplied characters, including
whitespace. IDs reject padding rather than silently normalizing it. Existing
inline evidence and listing fields retain their historical trim normalization.
Rendered draft text JSON-quotes supplied values so embedded controls/newlines stay
visibly delimited; exact selected claim text remains available in structured
lineage for human editing. Draft output is not a verified final resume or letter.

Source labels are opaque user-provided descriptions, not paths to open or URLs
to fetch. They do not prove that a fact is true. All listing, fact and label text
is data; the implementation must never evaluate it, execute instructions embedded
in it, infer a provider route or convert it into a new tool call.

The composer is deterministic and local. It resolves explicit mappings, emits
lineage, drafts from the selected evidence, and preserves unanswered requirements.
An unrelated library fact must not appear in drafts or resolved output merely
because it was supplied with the request. Reuse does not mean server persistence:
the user supplies the library again for another selected job.

## Synthetic request

```json
{
  "job_id": "123",
  "job_title": "TypeScript engineer",
  "company": "Synthetic Company",
  "evidence_library": [
    {
      "id": "library-work",
      "text": "Maintained a TypeScript library and reviewed pull requests.",
      "source_label": "User-supplied project notes"
    }
  ],
  "requirements": [
    { "requirement": "TypeScript", "evidence_ids": ["library-work"] },
    { "requirement": "Security incident response" }
  ],
  "include_drafts": true
}
```

This example is synthetic. It does not establish a real vacancy or a person's
qualifications. The unmapped incident-response requirement must stay missing.
The draft should reuse the exact supplied library claim and retain its source
label; it must not turn that claim into incident-response experience.

## Acceptance and implementation plan

1. Add bounded schemas and a pure resolver/composer; keep old requests compatible.
2. Add native output contracts for optional provenance and draft materials.
3. Exercise old and new input through the MCP SDK, including absent evidence,
   reference errors, duplicate/overlapping claims, unused facts, adversarial text
   and maximum bounds. Assert that no provider or browser work is invoked.
4. Run required source gates and exact package checks, then independent diff review
   and the hosted OS/Node matrix. Preserve failures separately from any later pass.
5. Merge only the reviewed passing source. Publish a new version separately; do
   not attach a candidate to the immutable 4.1.2 artifact or label it shipped early.
6. Measure draft usefulness later with willing consenting users. No such result
   is implied by deterministic tests. The existing account-read pilot remains
   separate and does not authorize this additional workflow during its attempt.

## Evidence

Local verification passed 808 tests with one platform fixture skipped, source
lint/types/metadata/build, exact package/installed-client checks and zero source/
fresh-consumer audits. Independent runtime review is clean. See the
[4.2.0 readiness record](RELEASE_READINESS_4.2.0.md) for candidate identity and
remaining hosted/release gates. Native-client usefulness and participant outcomes are currently
unmeasured. Required new maintainer service spend: $0.
