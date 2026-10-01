# Review follow-up and bounded brief evidence — October 1, 2026

Both existing PRs remain drafts; no merge, version bump, publication or new LinkedIn
account request. Package remains2.0.3. The 57 workspace sync copies, ignored
`dist/index 2.js`, and pr_diff.txt are preserved with hashes/private backup outside
iCloud. A malformed duplicate Git ref was preserved outside refs so fetch works;
valid history was not rewritten. Original roadmap and historical evidence remain.

## Independent review corrections

- PR #3 head `01205f0eb7fcc78a814872476cf2c576386e8aba`: exact package allowlist,
  prepack rejection and actual archive byte/inventory verification. Local476 tests,
  lint/typecheck/metadata/build/installed offline package checks pass. All12 hosted
  source/packed/browser jobs pass in [run36873671301](https://github.com/devag7/linkedin-mcp/actions/runs/36873671301).
- PR #4 head `86edeb48647bf29f7811469151e71a519c3e7ff4`: incorporates packaging by
  an ordinary merge; guided setup diagnoses broken symlinks/junctions before
  exporting configuration. It returns needs_attention JSON, invalid profile,
  actionable repair guidance and null configuration/commands. Disposable unit and
  installed-CLI fixtures retain the broken link and never touch the real profile.
  Local481 tests and source/metadata/build/packed checks pass. All12 hosted jobs
  pass in [run36873941821](https://github.com/devag7/linkedin-mcp/actions/runs/36873941821).

Reproduced old dry run:66 files including23 duplicate docs/dist entries. New real
tarballs from the dirty workspace and a fresh clean Git clone of PR #4 each contain
exactly15 files, with matching file names, lengths and SHA256 hashes across every
entry. The clone used fresh npm ci (scripts disabled), built its own output and
installed/exercised its own tarball. See before/dirty/clean inventories and hosted
job snapshots in [evidence](evidence/review-brief-2026-10-01/).

Fourteen explicit package paths plus npm's package.json ship: build/map, license,
README/setup/security/disclaimer, original roadmap, client config, local metadata,
and capabilities/contracts/privacy/workflows docs. Repository audit/execution logs
remain in GitHub. Build preserves unrelated dist files. Prepack rejects changed
allowances, missing output and unexpected inventory; --ignore-scripts still uses
exact paths. Archive verification independently rejects extra/missing/duplicate
paths/non-file types and compares bytes. Existing historical package smoke checks
prove selected-runtime behavior/license/offline MCP flow; **exclusive inventory was
not previously checked**, and those results do not prove a later dirty tarball.
No old evidence was erased or retroactively upgraded.

## Separate product track: research_jobs

One first-page existing search_jobs call and optional first-linked-job detail
produce a practical comparison: observed titles/locations/posting timestamps,
first listing's company/workplace/requirements where returned, exact field sources,
fetch times, unknowns, gaps, recovery codes and manual next steps. JSON includes
Markdown export. Up to10 entities,2 existing read-tool calls,3 explicit Voyager GET
attempts including account identity. Budget survives delayed queue callbacks and
concurrent contexts. A fourth attempt fails before browser/page access. This is
not a cap on Chrome navigation/assets/background traffic. No new route, guessed
provider parameter, paging, retry, persistent content, model fee or write is added.

Tests run actual SDK protocol, registered read bodies, Guard, account binding and
Voyager code with **synthetic page responses**. Cases cover cold three-attempt
assembly, missing completeness, empty pages, oversized/duplicate/unlinked rows,
input bounds, disabled enrichment, mismatched detail identity, conflicting titles,
failed detail preserving search facts, rate-limit stop, queue-context isolation,
spent ceiling and extra identity exhausting the budget. Per-fact excerpts are
marked; Markdown escapes untrusted source text. Provider read failures are useful
partial reports; clients must inspect data.status/reads/gaps rather than treating
a successful MCP envelope as provider success.

`npm run demo:brief` reproduces the synthetic real-SDK example; no browser/account
requests. Recorded JSON and Markdown are clearly labeled synthetic. Packed stdio
also invokes research_jobs under a disposable persisted stop and verifies a
partial CIRCUIT_OPEN brief with0 reads. Three generated client configurations
launch the actual installed package with23 tool discovery. This is SDK/process
proof, not a new native Claude/Cursor/VS Code chat or live provider claim.

Local Chrome154 offline lifecycle:9 observed processes→0, context closed and
ownership released;0 LinkedIn requests. Brief feature local validation:496 tests/27 suites, lint/typecheck/metadata/build,
synthetic demo, exact archive and installed SDK/stdio gates pass. Hosted final
source SHA and job results will be appended after the separate draft matrix. Hosted jobs install fresh
packages and test actual offline Chrome on Linux/macOS/Windows Node20/22; they do
not prove LinkedIn endpoints, adoption, release availability or Trending.

## Remaining gaps and next milestone

Independent review of all three draft tracks, newly consented real job-brief flow
and volunteer first-read/repeat-use evidence before promotion. Broader briefs need
a separate request-budget design; saved jobs/filters/post/conversation search need
verified captures or clearly bounded local semantics. Complete data erasure,
Windows ACL proof, optional official-provider pilot and the October8 development
advisory follow-up remain open. No mandatory paid service is introduced. The
10,000-star and GitHub Trending daily distribution/measurement ambitions remain
in PRODUCT_EXECUTION_PLAN_2026.md as measured outcomes, never guarantees.

Normal prepack testing also found stdout contamination of npm pack --json, before
any release. PR #3 follow-up `62fcda8` sends status to stderr and tests normal and
scripts-disabled tarballs for identical contents. PR #4 incorporates it at
`3189e6f`. Local source/package gates rerun successfully (476/481 tests). Both current-head hosted matrices pass all12 jobs: [PR3 run36876623435](https://github.com/devag7/linkedin-mcp/actions/runs/36876623435) and [PR4 run36876685397](https://github.com/devag7/linkedin-mcp/actions/runs/36876685397). Earlier successful runs remain archived.
A disposable broadened package.files case is rejected by normal prepack; restored
clone metadata and every preserved workspace copy remain unchanged.

TypeScript's old sync copies were also included in src/**/* and could fail when
the capability union grew. The brief track excludes **/* 2.ts from typechecking
without editing/deleting copies; the built import graph uses the original files.
The synthetic demo and code are $0 to run with existing local prerequisites.

The separate [draft PR #5](https://github.com/devag7/linkedin-mcp/pull/5)
implements the first job-brief scope. At `66a5c89`, its dirty workspace and clean
checkout each produce identical15-entry archive names/lengths/SHA256s for normal
and scripts-disabled packing; both installed artifacts and the clean synthetic
demo pass. The current clean clone used its own built output, with no sync copies.
Exact feature archive inventories and a normal-prepack rejection fixture are in
the evidence folder.496 local tests/27 suites pass; no account access occurred.

Feature source/evidence head `66a5c89f627c82eb0bc83372aa40c49dfec9d371` passes
all12 hosted source/packed/offline Chrome checks in
[run36877160263](https://github.com/devag7/linkedin-mcp/actions/runs/36877160263).
This includes496 source tests and actual packed stopped-brief/client execution.
The final documentation-only head is separately checked in CI and linked in the
PR body, with its result retained in the private backup to avoid an endless
commit-evidence/head-change cycle. All three PRs remain OPEN/DRAFT.

Final preservation check: all60 backed-up files match their initial SHA256s (57
workspace sync copies + pr_diff.txt + ignored dist copy + relocated Git ref).
Original roadmap SHA256 remains726b77032825ba66753785633c5dade585da9d7afe40582ac0f940d3fb283c2a;
pr_diff.txt remains58cd3df819058c0ce4fff6ca2de0a58db2c68144900e9fad37696139507af36f.
GitHub metadata still reports10 stars on October1; neither adoption nor daily
Trending inclusion is claimed from these code/CI results.
