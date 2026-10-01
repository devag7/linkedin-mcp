# Phase 1: diagnosis, session truth and installation evidence

Local implementation dated 2026-10-01 (Asia/Kolkata). Phase 1 is partially complete;
this evidence is not a statement that a clean real user completed a LinkedIn read.

## Implemented

- `--doctor` diagnoses package/Chrome availability, profile accessibility and
  ownership, validated budget/checkpoint state and transport/token configuration.
  It does not open Chrome, make network calls, create a profile/lock, or write state.
  It reports fixed status fields and next steps without private paths, credentials,
  profile content or raw errors. Invalid configuration identifies fields without
  echoing their values.
- `--doctor --live` explicitly selects an identity read using the production safety
  runtime. A known hard stop, invalid state or owned profile refuses the probe.
  The probe has a 30-second deadline, then cleanup; cleanup can outlast the deadline
  while Chrome finishes launching/closing. No write is performed. A timeout is
  not evidence that an in-flight read was cancelled.
- `whoami` distinguishes a cold unchecked runtime (`loggedIn: null`,
  `sessionState: not_checked`) from a checked session. `health_check` deliberately
  opens and verifies a cold saved profile, and preserves no-probe checkpoint and
  budget-storage stops.
- README removes unsupported competitor comparisons, evasion/resilience promises,
  throwaway-account recommendations and unqualified current live-verification
  claims. Source changes are explicitly unreleased; `@latest` is not presented as
  containing them.
- `npm run verify:package` packs without publishing, installs the tarball in a
  fresh temporary project, checks the installed CLI version, offline doctor and
  redaction, then connects two fresh stdio processes to initialize/list/call.
  Missing Chrome and a synthetic persisted stop make LinkedIn requests impossible
  in this smoke. Temporary installation/profile state is removed afterward.
- CLI flags take precedence over environment transport/port/log level. Conflicting
  commands are rejected before any action, preventing a diagnosis invocation from
  also selecting logout. Packed-CLI checks exercise those argument boundaries.
- CI adds packed-artifact jobs on Node 20/22 across Linux/macOS/Windows. Release
  checks the packed artifact and requires LICENSE before publishing.

## Proof and limitations

Doctor tests cover read-only cold diagnosis, executable/path fixtures for three
operating systems, missing Chrome, HTTP credential presence/redaction, invalid
profile and state, hard stops, ownership, success/error classification, deadline
handling and invalid configuration redaction. Production MCP fixtures cover cold
health and a doctor identity probe followed by disposal/released ownership.

The earlier local artifact installation passed with `licenseIncluded: false`; that
was a missing-file warning, not a completed package gate. The maintainer then
identified iCloud synchronization as the cause and authorized recovery. All 19
missing tracked files were restored from HEAD without overwriting local edits.
LICENSE is the committed MIT license. The newer packed installation passed with
`licenseIncluded: true`, and omission now fails verification.

Generated registry metadata uses the package version and is checked against a
pinned official 2025-12-11 schema retrieved on 2026-10-01. Local format validation
is not evidence of an accepted registry listing. whoami and generated docs expose
one capability source with null current live dates. Legacy auth/cache variables
are isolated from active config; writes default disabled and pacing has no bypass.
Warmup now measures elapsed time since first verified tool use, preserving counters
and never guessing LinkedIn account age. Custom profile logout requires an explicit
confirmation flag and is checked in the installed artifact.

The earlier local snapshot was followed by [hosted run 36853809883](https://github.com/devag7/linkedin-mcp/actions/runs/36853809883):
all 12 source/package/browser jobs passed across Node20/22 and Linux/macOS/Windows. Source/package results
and the latest test count are in [ROADMAP_PROGRESS.md](ROADMAP_PROGRESS.md).
The newer zero-cash pass proves local macOS Chrome launch/ownership/cleanup.
Consenting human first-use on real LinkedIn, hosted OS/browser launch/cleanup and
current provider/locale captures still remain for the Phase 1 exit gate. No live
session, official app, publishing, outreach or analytics collection was performed.
