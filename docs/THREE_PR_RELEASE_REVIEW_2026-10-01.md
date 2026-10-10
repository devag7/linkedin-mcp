# Three draft PR review — October 1, 2026

Current remediation status: **R1 and R2 are fixed** in reviewed PR #3 commit
`5e6f25ba66800361abb8d7e47f3db258bb12a2e4` and carried by cherry-pick into PR #4
at `1ee61b69b0a8793f3cacf055e76b309ea574d14f` and PR #5 at `888d001`.
PR #5 also adds SDK coverage of contradictory brief pages and its independent
identity defense. Existing histories are ancestors; no rebase, force-push or
pull-request merge is used. Keep all drafts. The dated findings below describe
the **pre-fix heads**, not outstanding defects in the resulting source.

See [shared implementation/evidence](READ_CONSISTENCY_FIX_EVIDENCE_2026-10-01.md).
PR #3 passes499 tests/26 suites and [12 hosted jobs](https://github.com/devag7/linkedin-mcp/actions/runs/36894307898).
PR #4 passes504 tests/27 suites and [12 hosted jobs](https://github.com/devag7/linkedin-mcp/actions/runs/36895012222).
Both local source/package gates pass. PR #5 passes524 local tests/28 suites and
source/package/installed client gates after its track-specific follow-up. Its
resulting-head hosted run and exact SHA are recorded in the draft body and private
evidence after push. Passing fixture/platform checks do not establish live
LinkedIn compatibility. No additional P0/P1 defect was confirmed in this targeted
remediation review; broader evidence/roadmap gaps remain below.

## Exact source scope

| Draft                                               | Refreshed head reviewed                                                                 | Hosted checks verified at that head                                                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [#3](https://github.com/devag7/linkedin-mcp/pull/3) | `62fcda8c473e3ce7016d140773274ac63177a6a7`                                              | [12/12 successful jobs](https://github.com/devag7/linkedin-mcp/actions/runs/36876623435)                                                       |
| [#4](https://github.com/devag7/linkedin-mcp/pull/4) | `3189e6f13a2a33c77539a0263d97f5dfd06aaf46`                                              | [12/12 successful jobs](https://github.com/devag7/linkedin-mcp/actions/runs/36876685397)                                                       |
| [#5](https://github.com/devag7/linkedin-mcp/pull/5) | `5faf06cdcceaf2dae19fc7d371704ea36a162881`, then the small status fix in this follow-up | [Baseline 12/12 successful jobs](https://github.com/devag7/linkedin-mcp/actions/runs/36877905425); new-head results must be checked separately |

This is a separate targeted review after the requested fix. PR #3 review covers
logout/ownership, write preview authorization and durable replay, account binding,
checkpoint/rate-limit handling, HTTP authentication/body bounds, archive allowlist
and release identity/finalization. PR #4 covers configuration export, inherited
environment exclusions, offline diagnosis and broken profile aliases. PR #5 covers
SDK registration/contracts, request-local counters across the queue, source
identity/links, freshness, empty/partial/error behavior and Markdown handling.
Shared code is assessed in each head, rather than only each PR's incremental diff.
This is not an exhaustive proof against hostile local processes or live provider
drift. Neither Chrome nor LinkedIn was used in the two new reproductions.

## Findings by severity — historical pre-fix snapshot

### R1 — P2: contradictory paging can certify a false empty result

Affects **#3, #4 and #5**. Exact location:
[src/tools/pagination.ts:77–85](https://github.com/devag7/linkedin-mcp/blob/62fcda8c473e3ce7016d140773274ac63177a6a7/src/tools/pagination.ts#L77-L85).
The file is byte-identical in all three reviewed heads.

With `included:[]` and `paging:{start:0,count:2,total:2}`, `offset + count`
is treated as reaching the end, regardless of zero observed rows. `search_jobs`
returns `meta.status:empty`, `partial:false`, despite the provider reporting two
results. PR #5 then turns this into `data.status:empty` too at
[src/tools/research.ts:231](https://github.com/devag7/linkedin-mcp/blob/5faf06cdcceaf2dae19fc7d371704ea36a162881/src/tools/research.ts#L231).
The status-alignment fix resolves the requested field mismatch but cannot repair
this earlier completeness decision. Consumers can wrongly conclude no jobs exist.

Required fix: treat inconsistent totals/observed page lengths as unknown or a
typed shape error; do not certify completeness from requested count alone. Test
zero rows/nonzero remaining total, short rows on a purported final page, true
zero-total emptiness and a valid final page through the SDK. Preserve explicit
paging and never fetch another page automatically. No new endpoint is needed.

### R2 — P2: standalone job details can cite the wrong source

Affects **#3, #4 and #5**. Exact location:
[src/tools/discovery.ts:121–124](https://github.com/devag7/linkedin-mcp/blob/62fcda8c473e3ce7016d140773274ac63177a6a7/src/tools/discovery.ts#L121-L124).
The file is byte-identical in all three reviewed heads.

`get_job_details({job_id:"1"})` accepts any nonempty `jobUrn` and constructs the
source URL from the requested ID. A synthetic response with
`urn:li:fsd_jobPosting:99` is returned successfully with the claimed source
`https://www.linkedin.com/jobs/view/1/`. Provider drift or an unrelated normalized
entity can therefore attach a different job's facts to the requested listing.

Required fix: verify the shaped job's supported numeric URN equals the requested
ID before returning facts or assigning provenance. Return `RESPONSE_SHAPE_CHANGED`
on mismatch without retry; exercise both supported URN forms, absent/mismatched
identity and exact URL consistency via the SDK. `research_jobs` already rejects
the mismatched detail at
[src/tools/research.ts:217–225](https://github.com/devag7/linkedin-mcp/blob/5faf06cdcceaf2dae19fc7d371704ea36a162881/src/tools/research.ts#L217-L225)
and retains the search facts; keep that defense.

Both are reproducible correctness blockers, not assertions that these synthetic
responses have occurred on LinkedIn. See
[observations](evidence/three-pr-review-2026-10-01/sdk-review-observations.json),
[reproduction appendix](evidence/three-pr-review-2026-10-01/sdk-review-probes.txt)
and [fixture output](evidence/three-pr-review-2026-10-01/sdk-review-probe-output.txt).
The two audit assertions deliberately verify the defective current behavior;
their passing result is **not** an acceptance pass. They are excluded from the
permanent suite and from its test count. Complete temporary fixture source is
also retained in the private backup.

The SDK probes were executed on the PR #5 workspace with the status follow-up.
Affected scope for #3/#4 is established by identical shared source hashes and
their same call sites; this is not a claim of three separate live executions.

## Requested fix and validation

The pre-fix SDK empty-page assertion failed on `meta.status:ok` while
`data.status:empty`. The result helper now accepts an explicit status, with
partial taking precedence; the brief supplies its own status. The existing
complete-empty SDK test asserts both fields and `meta.partial:false`. A new
unknown-completeness empty-page SDK test asserts both fields remain partial.
Structured content still equals the JSON text block.

Local macOS/Node 22.14.0 gates pass: **497 tests / 27 suites**, lint, strict
typecheck, metadata check, build and packed-artifact verification. These validate
the source/contract regression, existing bound/provenance/partial cases, exact
15-entry tarball bytes under normal and scripts-disabled packing, installed
stdio and all three generated client configurations. They do not establish live
provider compatibility, native client chat behavior, publication or adoption.
New-head hosted matrix results are linked in the draft PR and retained privately
after push; this document does not predeclare their success.

The code follow-up is `10223a173d3dcee2688c1cb85f06133cdc82ecde`; its hosted
matrix is [run36888935665](https://github.com/devag7/linkedin-mcp/actions/runs/36888935665).
Dirty workspace and fresh clean checkout at that source produce identical normal
and scripts-disabled archives: all15 names, lengths and SHA256s match the
[dirty inventory](evidence/three-pr-review-2026-10-01/dirty-status-fix-inventory.json)
and [clean inventory](evidence/three-pr-review-2026-10-01/clean-status-fix-inventory.json).
The actual local Chrome154 offline lifecycle also passes:9 observed processes
close to0, context closes and ownership releases, with0 LinkedIn requests.
This subsequent documentation-only evidence commit changes no shipped path or
source; its resulting-head hosted result must still be verified independently.

Previous logout alias/junction regression, preview token expiration/target-content
binding/replay tests, release target-SHA/tag mismatch tests and broken-alias setup
tests remain in the passing suite. Source inspection finds those requested
boundaries intact. The brief still has a three-attempt ceiling, two existing
tool calls, per-fact URLs/observation times, excerpts, partial-result recovery
and no retry/paging. No paid service or dependency was added.

## Preservation and next milestone

The private backup made before edits includes all 57 workspace sync copies,
`pr_diff.txt`, the ignored dist copy, SHA256 inventory and a source-head bundle.
Existing backups, historical evidence, upstream history and the original roadmap
are preserved. Only the owned temporary audit fixture was removed after its
source and output were saved. PR #3/#4 source heads remain unchanged; PR #5 gets
only this reviewable follow-up. All drafts stay drafts; no version, merge or
publication action is authorized.

Next concrete milestone after the shared fixes and resulting-head gates: prepare
the exact PR #5 tarball in a stable private installation, record its SHA256/source
head and verify configuration/discovery offline. Seek **fresh human consent**
against that build and the [live validation protocol](LIVE_JOB_BRIEF_VALIDATION_PROTOCOL.md)
before any account request. Earlier account consent is not reused. Full erasure
tooling, NTFS ACL proof and the optional
official provider are still roadmap work; this review does not claim completion.
The development advisory follow-up remains October 8.

The [product execution plan](PRODUCT_EXECUTION_PLAN_2026.md) retains the $0
mandatory-cash constraint, first-read/repeat-use measurement, monthly GitHub
traffic/net stars, reproducible demos/tutorials and daily Trending observations.
10,000 stars and daily Trending appearances are ambitions measured after actual
distribution, never outcomes asserted from these changes.
