# LinkedIn MCP 3.2.0 release notes

Version 3.2.0 adds two offline safety improvements. Verify its publication and
destination integrity before installing; 3.1.0 is the preceding verified release.

## New in this candidate

- `--retirement-preview` reports bounded file and directory counts for one
  selected browser profile without printing paths, names or content. It makes
  no LinkedIn request, browser launch or filesystem mutation. It always reports
  `applicationSupported:false` and `deletionAuthorized:false`.
- On Windows, private-state creation uses a native protected ACL under the
  account profile. The runtime verifies existing profile, circuit, budget and
  lock paths and refuses unsafe custom parents before sensitive creation. The
  [hosted second-user probe](https://github.com/devag7/linkedin-mcp/actions/runs/38685192976)
  denied reading and modification of 18 synthetic targets on Node 20 and 22
  and passed nine negative cases.
- The release compatibility matrix uses a private Windows fixture location.
  The existing 22 MCP tools, write approval flow, provider routes and package
  inventory are unchanged.

## Upgrade notes and limits

Windows users with a custom profile outside the account-private tree may now
receive an explicit privacy refusal. Stop the server before selecting a safe
account-private profile and verify the native permissions of existing data.
The runtime does not silently relocate or repair previously exposed state.
Preserve safety history and uncertain write outcomes; do not delete budgets or
journals to work around a refusal.

The preview is not coordinated erasure. The Windows probe covers synthetic
state on hosted runners, not all machines, existing files, privileged
administrators or hostile same-account races. No new live LinkedIn route,
native-client first-use or volunteer outcome is established. PR #5 job briefs
and an official OAuth provider remain outside this release.

Release acceptance requires exact-head source/package checks, production and
full audits, hosted compatibility and native Windows probes, a nonpublishing
dry run, independent review, and readback of npm archive/integrity/provenance,
GitHub Packages, MCP Registry and GitHub tag/release after publication.
