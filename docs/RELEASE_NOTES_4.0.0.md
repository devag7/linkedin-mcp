# LinkedIn MCP 4.0.0 release notes

Version 4.0.0 adds two offline safety improvements. Verify its publication and
destination integrity before installing; 3.1.0 is the preceding verified release.

## Changes

- `--retirement-preview` reports bounded file and directory counts for one
  selected browser profile without printing paths, names or content. It makes
  no LinkedIn request, browser launch or filesystem mutation. It always reports
  `applicationSupported:false` and `deletionAuthorized:false`.
- On Windows, private-state creation uses a native protected ACL under the
  actual `%USERPROFILE%` tree. The runtime verifies existing profile, circuit,
  budget and lock paths and refuses every state path outside that tree before
  sensitive creation, regardless of its existing ACL. The
  [hosted second-user probe](https://github.com/devag7/linkedin-mcp/actions/runs/38685192976)
  denied reading and modification of 18 synthetic targets on Node 20 and 22
  and passed nine negative cases.
- The release compatibility matrix uses a private Windows fixture location.
  The existing 22 MCP tools, write approval flow, provider routes and package
  inventory are unchanged.

## Upgrade notes and limits

**Breaking Windows configuration change:** a custom profile outside the actual
`%USERPROFILE%` tree now fails with `WINDOWS_STATE_OUTSIDE_USER_PROFILE`, even
when its old directory is account-private or on another drive. Stop every
runtime and associated Chrome before planning a manual move. Preserve the
selected profile **and its sibling `.circuit.json` checkpoint file** at the
matching new path, while retaining the home-scoped budgets/write journal and
unknown-operation records. Do not erase those safety files or start with fresh
caps to bypass a refusal. Review native permissions and let the new version
verify all existing state before account use; a refusal requires investigation.
No automatic relocation or repair of previously exposed state is provided.

The preview is not coordinated erasure. The Windows probe covers synthetic
state on hosted runners, not all machines, existing files, privileged
administrators or hostile same-account races. No new live LinkedIn route,
native-client first-use or volunteer outcome is established. PR #5 job briefs
and an official OAuth provider remain outside this release.

Release acceptance requires exact-head source/package checks, production and
full audits, hosted compatibility and native Windows probes, a nonpublishing
dry run, independent review, and readback of npm archive/integrity/provenance,
GitHub Packages, MCP Registry and GitHub tag/release after publication.
