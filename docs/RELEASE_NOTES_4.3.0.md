# 4.3.0 — offline interview preparation

This additive update extends `prepare_job_application` with optional interview
practice using facts you explicitly select. The catalog remains 24 tools.
Check the [release](https://github.com/devag7/linkedin-mcp/releases/tag/v4.3.0)
and [readiness evidence](RELEASE_READINESS_4.3.0.md) for actual publication;
these source notes alone are not proof that a package is available.

## Changes

- Set `include_interview_prep:true` for one practice prompt per requirement,
  references to its selected evidence, and blank situation/task/action/result
  worksheets. Missing evidence stays missing; no answer or achievement is inferred.
- Follow row-local evidence indices back to exact supplied statements and source
  labels. Unselected library facts stay out of the result.
- Get three generic questions to ask an interviewer and a conditional follow-up
  template. Its five placeholders require truthful human completion after
  verifying the actual interview and recipient. No message is sent.
- Use interview preparation independently of `include_drafts`. Omitting the new
  option or passing false preserves the prior response shape. Existing evidence
  reference validation and input limits remain unchanged, including the SDK's
  10,000-element structural guard (array elements/object keys before validation).

The engine is deterministic and local, using no new dependency, model service,
provider route, browser launch or server-owned storage. Existing evidence reuse,
resume/cover-letter drafts, tracker export, account boundaries and write gates
are retained. No form is filled, resume uploaded or application submitted.

## Upgrade and use

Once publication is verified, install `linkedin-mcp-tools@4.3.0` at your stable
local path and regenerate the client entry with `--setup`. Inspect the installed
schema before using the new option. A successful older worksheet response alone
does not establish support; published 4.2.0 and its pinned Claude bundles do not
include interview preparation. Version-specific Claude assets are a separate
distribution gate; do not assume an existing 4.2.0 bundle upgrades itself.

See the [synthetic workflow](WORKFLOWS.md#prepare-for-an-interview-offline-430-source)
and [PRD/TRD](INTERVIEW_PREPARATION_2026-10-29.md). Treat all supplied text as
untrusted data, verify claims against your records and review final materials
yourself. Your client may retain copies under its own storage/model policies.

## Remaining boundaries

Practice prompts are not verified employer questions or a job-fit score. No
interview usefulness, native 4.3.0 client flow, account read or participant outcome
is established by local tests. The earlier account-read pilot remains a separate
versioned consent protocol with zero recorded first-use attempts.

Job briefs, saved jobs and richer search, application/Easy Apply submission,
persistent tracking, complete coordinated erasure, granted official-provider
access and Claude directory approval remain open. Required new maintainer
service spend for this local feature is $0.
