# First-use scoring and private results guide

Use the [volunteer kit](FIRST_USE_VOLUNTEER_KIT.md) and copy the
[header-only CSV](FIRST_USE_RESULTS.csv) **outside the repository** into private
local storage. No real participant rows, contact list or account consent record
may be committed. The participant views their own result; the coordinator receives
only permitted timing/status/verification booleans. No hidden telemetry or screenshots.

## One person, one first attempt in the overall rate

A new user self-reports no prior LinkedIn MCP install/tool use before this study.
Prior users are `returning_user` trials, never part of the overall new-user rate.
Assign a random, study-only `study_person_code` before the first start; it is not an
account identity, contact identifier or hash of either. Use the same code across that
person's later client trials. `attempt_order` increases across **all** clients; assign
it at start, never after seeing an outcome. `attempt_group` is `first_person` for
order1, `later_client` for a subsequent first trial on another client, or `repeat`
for a repeat on a previously tried client. Use `returning_user` for all trials by
people who used the product before enrollment. Do not relabel a later success as first.

Overall new-user denominator = distinct people with a started `first_person` attempt.
Numerator = those people's **first** attempts qualifying within900 seconds. A person
with a failed first attempt remains a failure even if a later client works. First-client
strata use only those same first-person rows, split by the initially selected client.
Report later-client trials and repeats in separate tables, with their own started
attempt denominators and distinct-person counts; never add them to the overall rate.
Do not sum client-cohort percentages or client trials to manufacture new users.

Every started attempt stays in its appropriate denominator, including prerequisites,
missing Node/Chrome, client/model access, permissions, ownership, checkpoint, auth,
pacing, empty/partial-unusable result, shape error, timeout, cancellation, assistance,
missing timing/outcome and late responses. No timer reset or post-start exclusions.
The maintainer's existing-account check, synthetic demos and offline engineering
checks are not volunteer attempts and enter none of these study denominators.

Before consent/start the participant declares any prior product use and study attempt; no identity
verification or cross-account tracking. With private-row consent, the participant
keeps their random code for later trials. Without it, record only agreed anonymous
first-person/later-client/repeat tallies and the person's declaration at each start;
do not build a linkable registry. If first-person eligibility is unknown, classify as
`eligibility_unknown`, report its started failures/results separately and **do not**
include it as a new person or successful first attempt. Eligibility is self-declared,
not independently identity-verified; disclose that limitation for anonymous tallies.
Report these uncertain starts
alongside the headline, never silently discard them or count them twice.

## Useful complete or partial response — fixed acceptance

The published MCP read contract is `{ data, meta }`; **no top-level `ok:true` exists**.
`get_my_profile` normally returns `meta.status:"partial"` with `meta.partial:true`
([profile route](../src/tools/profile.ts), [envelope](../src/tools/result.ts)). A first
useful read does not require complete experience/education/skills sections.

A read qualifies only when **all** of these locally checked conditions are true:

1. Published3.0.0 and approved tool sequence: one manual `--login`, one
   `get_my_profile`, only cold `whoami`/`close_session` otherwise. No health probe,
   retries, second login, extra provider tools or writes. `scope_compliant=yes`.
2. A non-null, nonempty structured `data` profile with no `isError:true` or error/code
   envelope. `meta.contractVersion` is1 and `meta.source` is `voyager`.
3. Nonblank `data.firstName` and `data.headline`; participant confirms they are their
   own and useful (`required_fields_verified=yes`). Do not retain their values.
4. Canonical HTTPS `data.sourceUrl` under `www.linkedin.com/in/<nonempty-slug>/`,
   without query/fragment/credentials, recognized by the participant as their own
   profile (`source_link_verified=yes`). Inspect the returned link locally; do not
   navigate to add another read or store it.
5. Valid `meta.fetchedAt` within this attempt's start and received-result times
   (`freshness_verified=yes`). This is retrieval time, **not** proof of LinkedIn's
   last profile update. Invalid timestamps or clock uncertainty are unknown/failure;
   don't replace them with invented freshness.
6. Consistent metadata: `status=ok` with `partial=false`, or **`status=partial` with
   `partial=true`**. The latter is `result_code=useful_partial`; the former is
   `useful_ok`. Missing/inconsistent metadata, empty/error responses, absent required
   fields, identity mismatch or unverifiable provenance fail even if some text exists.

`useful_read=yes` requires every condition above. `within_15_minutes=yes` additionally
requires observed elapsed≤900 seconds. A valid useful partial counts in the numerator,
but publish its count separately; it never becomes evidence of a complete profile.
`request_count` is an observed integer or `unknown`. Published3.0.0 has **no enforced
numeric HTTP-request maximum**; count unknown alone does not fail an otherwise
observed approved tool sequence. Never infer scope compliance from a result or infer
request count from tool count. Unknown tool sequence gives `scope_compliant=unknown`
and cannot enter the success numerator. If a participant requires a hard request cap,
do not start their live attempt until a separately reviewed limiter exists.

Begin timing before prerequisites/install, after consent. Include configuration,
restart, login and pacing. At900 seconds stop active work and close session/server.
A dispatched read arriving later may qualify only for eventual-read counts without
another call or timer reset. Missing timing/outcome is never a headline success.
Cleanup is separate yes/no/unknown: observe server exit and no owned Chrome remaining.
Useful-read success establishes neither cleanup nor erasure.

## Worked scoring examples — synthetic, not participants

| Example | Overall first-person rate | Separate later-client rate |
| --- | --- | --- |
| A first Claude trial fails; A later Cursor trial passes; B first VS Code trial passes |1/2=50%; A's first failure retained |1/1=100%, one person; excluded from overall |
| One first attempt has valid useful partial metadata/required fields/link/fetch time at600s |1/1; partial-success count1 | No later trial |
| One first attempt has `status:partial` but no headline, wrong identity, missing source, inconsistent partial flag or unverified freshness |0/1 | No later trial |
| One first attempt returns a valid useful partial at901s |0/1 within15; eventual-read1/1 | No later trial |
| First attempt outcome/timing missing or cancelled; later trial succeeds |0/1; missing/cancelled retained |1/1, excluded from overall |

Report `0/0` as **not measured**, not0%/100%. Pilot proposal:15 distinct new people,
five selecting each initial client; later trials do not fill missing first-person
slots. Report n, first-client split, partial successes, assistance, failure categories
and uncertain-eligibility starts.80% remains a target, not population proof from a
small pilot. State sample size and definitions beside elapsed distributions.

## CSV instructions and privacy

The [CSV header](FIRST_USE_RESULTS.csv) contains no real rows. Allowed values:

- `study_person_code`/`attempt_code`: random study codes with no account/contact join.
  `attempt_order`: positive integer across clients. `attempt_group`: first_person/
  later_client/repeat/returning_user/eligibility_unknown. Unknown eligibility may have blank person
  code/order; do not invent or silently reclassify it. `client`: claude-desktop/cursor/vscode.
- `client_version`, `os`, `node_version`: coarse versions, no device/path identifiers.
  `package_version`:3.0.0. `elapsed_seconds`: nonnegative integer or blank if unknown.
  `last_step`: prerequisites/install/doctor/config/discovery/login/read/cleanup.
- `result_code`: useful_ok/useful_partial/not_useful/client_unavailable/client_runtime/
  node_missing/chrome_missing/permissions/ownership/state_invalid/checkpoint/auth_required/
  budget/pacing_timeout/shape_changed/empty/timeout/out_of_scope/cancelled/unknown.
  Normalize locally; do not paste raw errors. `response_status`: ok/partial/empty/error/unknown.
- `partial`, `required_fields_verified`, `source_link_verified`, `freshness_verified`,
  `useful_read`, `within_15_minutes`, `eventual_read`, `scope_compliant`,
  `cleanup_observed`: yes/no/unknown. Unknown never substitutes for a required success.
  `request_count`: observed integer or unknown; no `request_bound_respected` field.
- `recording_delete_on`: participant-chosen ISO date, default within30days; erase on
  withdrawal. `followup_opt_in`: yes/no. Keep contact arrangements outside this file.

Before aggregation validate unique attempt codes, at most one first_person row per
person, unique person/order pairs, first_person=order1, subsequent orders>1 and the
six acceptance conditions. If ordering/duplicates conflict, resolve from consented
local registration; otherwise retain as eligibility_unknown, not extra new users.
A person's first attempt never disappears when another client works.

Separate consent: anonymous started/outcome tally is required before study start;
private rows and follow-up are optional. If private recording is declined/withdrawn,
do not retain/delete the row and linkage; retain only separately agreed anonymous
started/outcome/group counts, with returning users separate. Missing outcome cannot increase success. Irreversibly
anonymous published counts cannot be linked back for withdrawal; explain this before
consent. If all study consent is declined before start, do not start a measured attempt.
Publish broad aggregate counts only, suppress identifying small cells while retaining
their starts in totals. Never commit private CSVs, timestamps, identities, content,
source URLs, cookies, profile paths or tokens. No actual participant rows in GitHub.

Optional repeat use means voluntary use in two distinct weeks within28days. Report
eligible/opted-in/responded/returning separately; nonresponse is unknown, not retention.
Weekly review observed first-attempt failures to choose the next product fix; do not
choose a provider change from fixtures. Monthly record first useful read, repeat use,
GitHub traffic/net stars.10,000 stars and daily Trending remain goals, never promises.
