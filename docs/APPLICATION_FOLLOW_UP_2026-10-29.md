# Local follow-up plan — October 29, 2026

Status: 4.4.0 release candidate, not in published 4.3.0. Check the
[versioned release readiness](RELEASE_READINESS_4.4.0.md) before installing. This is an additive
option on `export_application_tracker`; the tool count remains 24. The feature
addresses the job-seeker roadmap's follow-up organization without introducing
server-owned persistence or background account activity.

## Product requirements

- Turn up to 50 explicitly supplied application records into a deterministic
  timing queue. Require the caller's reference time instead of guessing today.
- Preserve every record, status, action and CSV byte from the legacy formatter.
  Omitted or false `include_follow_up_plan` keeps the previous data shape.
- Return overdue, due-now, upcoming, unscheduled and closed groups. A rejected
  or withdrawn record is closed even when it has an old follow-up date.
- Leave absent actions blank. A due date does not prove contact, submission,
  receipt, permission to send, or that contacting an employer is appropriate.
- Schedule no notifications; fetch, send and store nothing. The user controls
  private retention and supplies the records again on the next call. New
  mandatory maintainer expense: $0; no additional dependency or service.

## Contract and implementation

Supply `include_follow_up_plan:true` and `as_of` together. `as_of`, `updated_at`
and `follow_up_at` use valid UTC ISO timestamps ending in `Z`. An enabled plan
without a reference time, or a reference time without the enabled flag, returns
`INVALID_TRACKER_RECORD`. Invalid dates fail input validation. Existing duplicate
job-ID and receipt-confirmation checks still apply.

```json
{
  "records": [{
    "job_id": "123",
    "title": "User-supplied example",
    "status": "submitted_unverified",
    "updated_at": "2026-10-28T12:00:00Z",
    "next_action": "Review whether a follow-up is appropriate",
    "follow_up_at": "2026-10-29T12:00:00Z"
  }],
  "include_follow_up_plan": true,
  "as_of": "2026-10-30T12:00:00Z"
}
```

The added `data.followUpPlan` is:

```json
{
  "referenceTime": "2026-10-30T12:00:00Z",
  "basis": "user_supplied_dates",
  "notificationsScheduled": false,
  "overdueRecordIndices": [0],
  "dueNowRecordIndices": [],
  "upcomingRecordIndices": [],
  "unscheduledRecordIndices": [],
  "closedRecordIndices": []
}
```

All indices are zero-based references to the unchanged `data.records` array.
Every supplied row appears in exactly one group. Dated active groups sort by
ascending instant, preserving input order for equal instants; unscheduled and
closed groups preserve input order. Missing `next_action` remains null in the
record and creates no generated instruction. Missing `follow_up_at` is
unscheduled unless closed. Exact fractional seconds, including finer precision
than milliseconds, retain their ordering. `as_of` is a comparison reference,
not a reconstruction of historical status: supplied records remain the caller's
current assertions, regardless of their `updated_at` values.

The pure helper imports only Zod, accepts validated records, never reads the
wall clock, and returns bounded index groups. The existing MCP handler owns input
validation and the shared output schema validates the optional plan. Untrusted
titles/actions remain data in the original records; the plan duplicates none of
that display text. Existing CSV formula protection remains unchanged.

## Acceptance and remaining scope

SDK regressions cover legacy equivalence, paired arguments, invalid dates,
chronological ordering across missing dates, ties/fractional precision, terminal
states, null actions, exact lineage and the 50-row limit. The compiled stdio
probe checks both legacy and enabled calls in fresh offline server processes.
Standard source, package and hosted gates remain required before integration.

This is not persistent tracking, a reminder service, verified application
history, live LinkedIn compatibility, or application submission. Those remain
separate roadmap work. Published 4.3.0, historical receipts and versioned pilot
cohorts do not acquire this unreleased option.
