# First-use scoring and private results guide

Use the [volunteer kit](FIRST_USE_VOLUNTEER_KIT.md) and copy the
[header-only CSV](FIRST_USE_RESULTS.csv) **outside the repository** into private
local storage. No real participant rows, contact list or account consent record
may be committed. Retain the separate consent record privately until its selected
deletion date; use a random attempt code, never a LinkedIn ID or hashed identity.
The facilitator observes only timing and permitted status; the participant views
their own returned content. No hidden telemetry or screen capture.

## Fixed measurement rules

- One primary first-use attempt per new participant/client pairing. Register the
  client and cohort before starting; label later repeats separately. Begin at the
  first prerequisite/install action after consent; end at useful read or stop.
  Include prerequisite installation, configuration, restart, login, pacing and errors.
- Every started primary attempt enters the denominator exactly once. Missing
  Node/Chrome, absent/free-client access, unsupported OS, permissions, locked profile,
  checkpoint, authentication failure, empty result, shape error, timeout, cancellation,
  assistance and a late result remain in it. No post-start exclusions or timer resets.
  Maintainer existing-account checks, synthetic demos and this offline setup check
  are excluded because they are not volunteer first-use attempts.
- **Pass within15:** approved published3.0.0; exactly the approved tool scope;
  structured success (`ok:true`, `meta.status:ok`); participant confirms a correct
  own name plus useful headline, with canonical profile source link and freshness;
  elapsed≤900 seconds. A flagged partial result passes only if those fields remain
  useful and explicitly shown as partial. Report partial passes separately. Empty,
  contradictory, unverified identity or errors fail. Do not inspect/retain the name,
  headline or URL to score the row. Complete-profile reliability is a separate metric.
- A request-bound violation or unknown enforcement/count prevents a **protocol
  compliance** pass. Report first-use usefulness and compliance separately; do not
  claim a request bound from a successful result alone. Unexpected additional tools
  end the attempt. First-use numerator includes only useful, authorized results
  within15; out-of-scope success is a failure. No extra reads for checking status.
- Missing timing/outcome counts as failure in the headline numerator. At900 seconds
  stop; a previously dispatched response arriving later can enter eventual-read
  counts, never the within15 numerator. Do not retry to improve the first-attempt score.
- Cleanup is separately pass/fail/unknown and must show server exit and no owned
  Chrome remaining. Useful-read success does not establish cleanup or erasure.

Headline rate = useful authorized reads within900s / **all started attempts**.
Never report `0/0` as0% or100%: report **not measured**. Before recruiting, propose a
pilot of five participants per client (15 total), without treating a small pilot
as population proof. Publish n and per-client counts; report assistance and partial
passes, failures and the same raw denominator alongside any provider-available rate.
80% is a target, not an established result. Report elapsed min/median/p90/max only
with sample sizes and definitions; no fabricated precision for tiny cohorts.

Consent to the anonymous started/outcome tally is required before study start.
Optional private-row consent is independent. If private recording is declined or
withdrawn, erase that row/consent linkage and retain only the already agreed anonymous
started/failure/success tally; missing outcome cannot increase the numerator. Explain
that irreversibly anonymous published tallies cannot be linked for withdrawal.
If all study consent is declined before start, do not start a measured attempt.

## Allowed values

`attempt_code`: random locally chosen code. `client`: claude-desktop/cursor/vscode.
Versions and OS: coarse app/platform versions, no device identifiers or exact paths.
`package_version`:3.0.0. `elapsed_seconds`: integer or blank if unknown.
`last_step`: prerequisites/install/doctor/config/discovery/login/read/cleanup.
`result_code`: ok/client_unavailable/client_runtime/node_missing/chrome_missing/
permissions/ownership/state_invalid/checkpoint/auth_required/budget/pacing_timeout/
shape_changed/empty/timeout/out_of_scope/cancelled/unknown. Normalize raw codes
locally; never paste raw error messages. `useful_read`, `within_15_minutes`,
`eventual_read`: yes/no/unknown; unknown never counts as success.
`partial`: yes/no/unknown; no field value inference from absent metadata.
`request_count`: observed integer or unknown (never an estimate presented as fact).
`request_bound_respected`, `cleanup_observed`: yes/no/unknown.
`recording_delete_on`: chosen ISO date≤30days by default; delete promptly on withdrawal.
`followup_opt_in`: yes/no. Put contact arrangements outside the results file.

Before aggregation check unique attempt codes, elapsed≥0, no non3.0.0 cohort rows,
within15 success only when elapsed≤900 and useful_read=yes, and failures still
represented. Aggregate declined-row attempts separately without any linkage. Keep
any source/content/path/cookie/token fields out. Do not attach this private file to
a public issue; publish broad counts only, suppress small potentially identifying
OS/client combinations, and keep suppressed starts in the overall denominator.

Repeat use = voluntary use in two distinct weeks within28days. Report eligible,
opted-in, responded and returning counts separately; no response is **unknown**,
not proof of retention. Weekly review first-use failures, issue response and GitHub
traffic; monthly record net stars, repeat use and first successful read. No account
identity joins.10,000 stars and daily Trending remain observed goals, never promises.
