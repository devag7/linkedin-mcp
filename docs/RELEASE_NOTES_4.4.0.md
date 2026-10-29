# 4.4.0 — local application follow-up planning

This additive update extends `export_application_tracker` with a deterministic
timing queue for records you supply. The catalog remains 24 tools. Check the
[release](https://github.com/devag7/linkedin-mcp/releases/tag/v4.4.0) and
[readiness evidence](RELEASE_READINESS_4.4.0.md) for actual publication.

## Changes and use

Supply `include_follow_up_plan:true` together with an explicit UTC `as_of`
timestamp ending in `Z`. The added `data.followUpPlan` groups zero-based indices
into the unchanged returned records: overdue, due now, upcoming, unscheduled
and closed. Active dates sort chronologically with stable ties and exact
fractional-second ordering. Rejected and withdrawn records stay closed; absent
actions remain blank. The reference time compares your supplied records and
does not reconstruct historical application status.

Omitting the option or passing false retains the previous data shape and exact
CSV. Both option and reference time must be supplied together. Duplicate job-ID,
receipt-confirmation, UTC-date and 50-record bounds remain enforced. See the
[contract, synthetic request and PRD/TRD](APPLICATION_FOLLOW_UP_2026-10-29.md).

Nothing is scheduled, sent, fetched or stored. There is no background worker,
new dependency, model service, provider route or browser launch. Your client may
retain copies under its own policies. Supplied statuses and receipt assertions
remain unverified input; a due follow-up is not permission to send a message.

## Upgrade

After verified publication, install `linkedin-mcp-tools@4.4.0` at your stable
local path and regenerate the client entry using `--setup`. Inspect the tool's
installed input schema before using the new option: older 4.3.0 and its pinned
Claude packages do not include it. Matching 4.4.0 Claude archives require their
own audited build and public download verification; they do not update themselves.

Existing interview practice, evidence reuse, resume/letter drafts, reviewed
writes, safety state and scoped retirement are retained. Existing calls need
no migration. No application form filling, upload, Easy Apply or submission is
added. Saved jobs/richer search, blocked job briefs, persistence, complete
erasure, official-provider grants and Claude directory approval remain open.
First-use and native/live usefulness are unmeasured; the new versioned pilot
remains separate and excludes both local application tools. Required new
maintainer service expense remains $0.
