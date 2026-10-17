# LinkedIn MCP 4.1.0 release notes

**Status:** release candidate. Publication and destination integrity must be
verified after the versioned main commit; this document is not a publication
receipt. Published 4.0.0 remains the pinned installation in the setup guide
until that verification is recorded.

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
- A reproducible Claude Desktop `.mcpb` builder is available for the **pinned
  published 4.0.0** runtime. One native Mac install/discovery/cold-`whoami`/
  removal check passed. The bundle is unsigned, is not published as a release
  asset and does not contain the two new 4.1.0 tools. A 4.1.0 bundle requires a
  new builder pin and fresh verification after public 4.1.0 publication.

## Boundaries

No tool fills, uploads or submits job applications, including LinkedIn Easy
Apply or an external applicant tracking system. `research_jobs` remains in a
blocked draft and is absent from this candidate. New worksheet/tracker data is
user-supplied and unverified, so its source links are navigational rather than
evidence that the posting is current. No new LinkedIn endpoint, write route or
permission is used by the two new tools.

The source and package gates exercise offline contracts and platform behavior.
They do not establish current LinkedIn compatibility, successful application
submission or fresh-user results. Keep first-use attempts, including failures,
in the measured cohort. Complete coordinated erasure remains separate.

## Upgrade

After public 4.1.0 archive and registry verification, replace the installed
4.0.0 package with exact `linkedin-mcp-tools@4.1.0`, regenerate the client
entry with `--setup <client>` and restart the MCP client. Existing profiles
and safety journals are not migrated by these tools. Preserve the 4.0.0
[Windows privacy requirements](RELEASE_NOTES_4.0.0.md#upgrade-notes-and-limits).
