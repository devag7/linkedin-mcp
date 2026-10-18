# LinkedIn MCP 4.1.0 release notes

**Status:** published. [Publication evidence](RELEASE_EVIDENCE_4.1.0.md)
verifies the exact npm archive, GitHub Packages, MCP Registry, GitHub Release
and source tag. The first npm readback failed before a same-source resume
completed; both runs are preserved in that evidence.

## What changes

- `prepare_job_application` makes an offline worksheet from a selected job ID,
  user-provided listing facts and user-provided resume facts. It distinguishes
  supported evidence, missing answers and unverified claims. It fetches no job
  data, stores no resume and always returns `submitted: false`.
- `export_application_tracker` formats up to 50 user-entered job statuses as a
  CSV. Receipt verification requires explicit user confirmation. Follow-up date
  and next action are optional. It does not read LinkedIn, store records or
  infer that an application was submitted. CSV cells are escaped for common
  spreadsheet formula prefixes; review imported files before sharing them.
- All 24 registered tools have human-readable titles and permission
  annotations. `close_session` is identified as a state-changing local action.
- The local Claude Desktop `.mcpb` builder in [PR #37](https://github.com/devag7/linkedin-mcp/pull/37)
  pins the verified 4.1.0 npm archive and bundles all 24 tools. It is an
  separate unsigned [GitHub Release asset](https://github.com/devag7/linkedin-mcp/releases/tag/v4.1.0)
  whose exact bytes passed a [native Mac cold check](evidence/claude-native-4.1.0-2026-10-18.md).
  It is not part of the published npm package.

## Boundaries

No tool fills, uploads or submits job applications, including LinkedIn Easy
Apply or an external applicant tracking system. `research_jobs` remains in a
blocked draft and is absent from this release. New worksheet/tracker data is
user-supplied and unverified, so its source links are navigational rather than
evidence that the posting is current. No new LinkedIn endpoint, write route or
permission is used by the two new tools.

The source and package gates exercise offline contracts and platform behavior.
They do not establish current LinkedIn compatibility, successful application
submission or fresh-user results. Keep first-use attempts, including failures,
in the measured cohort. Complete coordinated erasure remains separate.

## Upgrade

Replace an installed 4.0.0 package with exact `linkedin-mcp-tools@4.1.0`,
regenerate the client entry with `--setup <client>` and restart the MCP client. Existing profiles
and safety journals are not migrated by these tools. Preserve the 4.0.0
[Windows privacy requirements](RELEASE_NOTES_4.0.0.md#upgrade-notes-and-limits).
