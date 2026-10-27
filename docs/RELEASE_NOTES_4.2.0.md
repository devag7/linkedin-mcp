# 4.2.0 — reusable evidence and application drafts

This additive update extends `prepare_job_application` with optional reusable
evidence and deterministic draft materials. The tool catalog remains 24 tools.
Check the [release/tag](https://github.com/devag7/linkedin-mcp/releases/tag/v4.2.0)
and [readiness evidence](RELEASE_READINESS_4.2.0.md) for actual publication;
source notes alone are not release proof.

## Changes

- Supply an `evidence_library` of up to 30 labelled facts and explicitly map their
  IDs with each requirement's `evidence_ids` (up to 10 references per requirement).
- Keep existing inline evidence, including when selected library evidence is also
  present. Selected facts retain user-supplied provenance; unused facts stay out
  of resolved output and drafts.
- Request `include_drafts:true` for resume bullets and a plain-text cover-letter
  draft with lineage and remaining questions. Reused evidence is deduplicated
  without losing its requirement bindings. No evidence means explicit gaps.
- Duplicate/unknown evidence references are rejected. The tool does not infer a
  fit score, invent qualifications, fetch sources, read resume files or store data.

See the [synthetic workflow and requirements](APPLICATION_MATERIALS_2026-10-27.md).

## Upgrade

Existing worksheet requests with no new options keep their previous response
shape; tracker export and provider tools are unchanged. Install exactly 4.2.0
once publication is verified, regenerate your client entry with `--setup`, and
inspect the installed tool schema before sending the new optional fields.
Published 4.1.2 and its separately pinned Claude wrappers do not support these
fields. Wrapper publication/native testing are separate from this core update.

This retains the reviewed 4.1.2 dependency repairs, SDK input bounds, default-off
writes and existing preview/approval requirements. All facts remain supplied and
unverified; review draft materials against your own records before using them.
The server stores no library or draft, but your MCP client may retain inputs and
outputs according to its own policy.

## Remaining boundaries

No application form is filled, resume uploaded, employer contacted or application
submitted. Easy Apply/ATS submission, blocked research briefs, provider grants,
complete coordinated erasure and Claude directory acceptance remain open. Source
and package tests do not establish native-client or live-provider usefulness.
The account-read pilot remains a separately version-pinned consent protocol; its
participants must not add this workflow to their approved attempt.
