# Windows process identity: offline reproduction and repair

Base: `0dc13dc48d824d2757a4ea07fe2aa94fa47423c1`, draft PR #5.
No LinkedIn access, volunteer contact, merge or publication. Published 3.0.0,
protected sync copies/backups and historical receipts are preserved.

## Proven selector defects; historical cause remains unknown

The unchanged `matchingWindowsProcesses` selector is copied into a synthetic test.
It seeds every previously tracked PID, including absent/reused IDs, and follows
parent PID links without checking lifetime. Both defects reproduce:

- Ten profile processes plus 141 older, unrelated nodes reachable through a stale
  parent PID produce 151 selections; after the ten profile processes exit, the
  stored PID set still produces 141. This reproduces the historical count pattern.
- One tracked profile PID is reused by an unrelated parent. Its 140 unrelated
  children plus that reused PID produce 141 selections after the profile exits.

These are controlled fixtures, not reconstruction of the missing native inventory.
[CI 38051376890](https://github.com/devag7/linkedin-mcp/actions/runs/38051376890)
remains failed: Windows/Node 20, 151 observed, 141 at both cleanup checks,
`CHROME_CLEANUP_NOT_VERIFIED`, final 5202 ms. It cannot establish which defect,
genuine survivors or another cause occurred. No retry or historical relabeling.
The separate 20-second updater fixtures and consumed live cleanup failures remain
failed; Windows accounting repair does not establish ownership of updater work.

## Supported native identity and conservative tracking

[Microsoft's Win32_Process contract](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-process)
defines `CreationDate` as execution start and warns that `ParentProcessId` can
refer to a reused PID; comparing creation dates can disprove that parent relation.
The existing single native CIM probe now emits that timestamp in fixed UTC with
seven fractional digits. The five-second probe, five-second cleanup bound, buffer
limit and tracking limit are unchanged. No additional probe, kill or retry.

The offline Windows lifecycle tracker uses PID plus the full birth stamp:

- A tracked PID only selects the same lifetime. A different birth proves PID reuse
  and cannot seed that new process's descendants solely from the old tracking set.
- An observed surviving child remains tracked by its own birth even if its parent
  exits, reparents or is reused. Updater/auxiliary roles receive no exemption.
- A parent born later than a child cannot have created it. Older stale parent edges
  do not seed unrelated trees. Newly observed children born within an absent/reused
  tracked parent's possible lifetime fail as uncertain, rather than disappear.
- Missing relevant identity or equal parent/child timestamps fail with fixed
  `PROCESS_IDENTITY_UNCERTAIN`. Malformed/duplicate/incomplete inventories and native
  probe errors remain failures. A failed probe cannot later become a passing cleanup.
- Exact profile arguments and uncertain profile-tree footprints share existing
  parsing. A footprint remains counted and prevents clean certification. Only the
  validated observer itself is excluded; its genuine profile children still count.

Unrelated system rows may lack a birth stamp; they cannot supply a profile root,
tracked lifetime or ancestry edge. The inventory must include the current observer
with valid birth. CIM enumeration is an observation, not atomic process-handle
attestation or Windows ACL proof. No claim of exhaustive between-snapshot lifetime
coverage or exclusive termination authority is made.

Commands, PIDs, paths and birth stamps stay in memory. Native errors are replaced by
fixed codes. Public lifecycle output retains aggregate counts, platform/Node/Chrome
versions, method/deadline and cleanup status only. Parameterized malformed-inventory
test names no longer interpolate the native observer PID or inventory JSON.

## Regression and native acceptance

Synthetic tests cover both count reproductions, real surviving children,
reparenting, reused tracked PIDs, stale ancestry, unseen/ambiguous bindings,
sub-millisecond precision, missing/equal identities, malformed inventories,
profile boundary/auxiliary cases and native probe failures/redaction.

The resulting exact head must run actual temporary-profile Chrome lifecycle checks
on hosted Windows/Node 20 and 22, followed by the full source/package CI matrix and
pinned release dry run. Actual native results, archive equality and independent
review must be recorded in PR #5's resulting-head check summary and private hashed logs.
Passing native runs would establish those observed disposable lifecycles, not prove
the historical 141 cause or close representative macOS updater cleanup failures.

`fs_normalized_jobPosting` and ambiguous canonical identity remain rejected. No
provider endpoint, job fields, useful-brief criterion or production feature logic
changes. PR #5 remains draft; no live scope is frozen or authorized here. The next
single decision is whether the reviewed Windows repair passes its exact-head
native gates; even a pass does not authorize account access or a feature release.
