# Offline interview preparation — PRD and TRD
Date: October 29, 2026.
Status: planned source milestone; implementation in progress; full verification pending sufficient disk space. Published 4.2.0 does not support the new option. No version change is authorized by this document alone.

## Problem and outcome
A job seeker has selected a listing and mapped their own evidence to its requirements, but still needs a practical interview worksheet. Extend the existing local preparation tool so the same explicit mappings can produce practice prompts, evidence references, unanswered preparation questions and a follow-up template. This is preparation, not a prediction of employer questions or an assessment of qualification.

## Scope
Add optional boolean `include_interview_prep` to `prepare_job_application`; preserve 24 registered tools and the exact existing output when this option is absent or false. It operates independently of `include_drafts`. Reuse the current 20-requirement, 30-library-record and 10-reference-per-requirement limits. Do not add a library database, file access, browser operation, provider request, model API, scheduler or paid service.

## Proposed contract
With the option true, include `interviewPrep`:
- `status: "practice_only"` and `verification: "user_supplied_unverified"`.
- `practiceQuestions`: at most one worksheet per requirement, containing its requirement index, a deterministic question, indices into that requirement's selected `evidenceItems`, evidence status and null STAR fields (situation/task/action/result).
- `questionsForInterviewer`: a small bounded set of generic questions, with supplied role/company text visibly quoted where used. Do not claim these describe the employer.
- `followUpTemplate`: a fill-in template with a subject, body, explicit placeholder names and a requirement to verify actual interview context before use. Do not infer an interview occurred, a recipient exists or any message was sent.

When true, extended requirement rows must include selected `evidenceItems` so references are resolvable even when application drafts are disabled. Preserve exact claim text, labels, duplicate-source bindings and the existing validation of missing/duplicate IDs. Reference the existing rows instead of duplicating the complete provenance graph again. `submitted:false` and `stored:false` continue to apply.

The final field spelling and bounds must be checked against implementation before this proposal becomes an implemented contract.

## Data and trust boundaries
All listing text, claims and labels are untrusted input. Render supplied text using the existing JSON/control quoting helper; keep its exact structured form in the selected evidence. Never execute embedded instructions, inspect a labeled path, fetch a labeled URL or invent a STAR example, skill, result, metric or interview history. Unreferenced library facts must remain absent from the entire result.

Follow-up placeholders such as [INTERVIEWER_NAME], [INTERVIEW_DATE], [DISCUSSION_TOPIC] and [YOUR_NAME] require human completion. A conditional template is not an event receipt or approval to send. The client controls any copies and its own retention/model policies.

## Implementation plan
1. Add the opt-in input field and a pure preparation composer using existing resolved rows. Avoid changes to legacy normalization and evidence validation.
2. Add explicit bounded native output schemas and update the tool description without implying public 4.2.0 support.
3. Add meaningful pure and SDK regressions: absent/false compatibility; true without drafts; both options; missing evidence; mixed inline/library selections; repeated mappings; unused private facts; malformed references; adversarial controls; maximum bounds; valid output contracts; and no engine/provider invocation.
4. Extend the compiled installed-package smoke to check the new result, selected source references, omissions, null STAR blanks and unchanged cold status.
5. Update workflow/contract/current-scope documentation and generated metadata where applicable. Preserve historical dated evidence.
6. Run tests, types, lint, metadata, build, exact 15-file package, installed client and source/consumer audits. Obtain independent read-only review and the hosted OS/Node matrix. A pending or skipped gate is not a pass.
7. Merge only the exact reviewed passing source under standing authorization. Prepare a new minor release as a separate identity/verification step; never label the existing immutable 4.2.0 archive as containing this feature.

## Acceptance
Old calls remain byte-for-byte compatible in their data shape. Each evidence index resolves to the selected requirement's evidence item and retains every supplied source binding. Missing evidence remains missing; no STAR field is filled from an inferred claim. No unrelated fact or label leaks through any worksheet or template. The full result validates against its native contract at supported bounds. Offline flows create no browser session, account request, message, application submission or server-owned storage.

Tests establish contracts, not interview usefulness or native-client acceptance. Later voluntary offline user testing must stay separate from the existing account-read pilot and must not alter its denominators.

## Cost, dependencies and open work
Required new maintainer service spend: $0. Reuse existing dependencies and user-controlled clients. Native 4.2.0 checks, directory permission/acceptance, real first use, job briefs, provider route captures, automatic application submission, persistent tracking and complete erasure remain independent open scope.

Current implementation constraint: branch creation initially failed with ENOSPC at about 116 MB reported free. Small source writes became possible at about 226 MB free; package verification still requires more space. Do not delete protected backups, sync copies, historical receipts, profiles or ownership locks to proceed. Await sufficient available space before dependent writes/builds/installs. Preserve the failure and resume this plan after recovery.

