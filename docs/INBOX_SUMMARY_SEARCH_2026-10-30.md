# Bounded inbox summary search — October 30, 2026

Status: unreleased source work, absent from published npm 4.4.0 and its Claude
packages. This implements the local-summary portion of backlog P5; full message
search, verified continuation and current live-provider acceptance remain open.
No account access is authorized by this document or its examples.

## PRD

A job seeker can locate a conversation by a title or a participant's name or
headline, such as a recruiter description, using a small already fetched inbox
window. The client must distinguish a missing local match from evidence that no
matching conversation exists. No account crawl, per-thread fetch, contact export,
storage or unsolicited outreach is added. Required new service expense is $0.

## Contract

Existing `get_inbox({count:20})` returns its previous array and metadata. An
optional `keywords` string enables a different explicitly scoped result:

```json
{"count":20,"keywords":"recruiter"}
```

The query is trimmed and must contain 1–100 UTF-16 code units. Matching uses NFC
normalization followed by locale-independent lowercase and literal substring
comparison. No regex, semantic matching, role inference or instruction execution
occurs. Only explicit provider summary titles, participant names and participant
headlines are searched. The existing normalizer can generate a display title
from all names when a provider title is absent. That generated display title is
never searched: a separate per-row provenance view carries only explicit source
title/headline text beside the unchanged displayed conversation. Message bodies,
profile URLs, IDs and unrecognized fields are not.

With keywords, count is the number of returned conversations to inspect, from
1–25; it is not the number of matches to collect. The window is sliced BEFORE
filtering, so a miss never triggers read-ahead. Only the first 50 participants
per conversation and first 10,000 UTF-16 code units per selected text field are
searched. Any field/participant cutoff increments truncatedSummaries once for
that row. summariesWithoutText counts rows whose inspected prefixes had no
nonblank selected text. These counts may overlap; neither certifies a complete
summary or mailbox search. Matched rows are returned unchanged, in source order.
No thread URL is guessed; the existing conversationUrn and participant source
fields remain the available attribution.

`data` becomes an object with `status:"partial"`, `conversations` (0–25 unchanged
rows), and `search`: query, matching rule, the three field names
(provider_title, participant_name and participant_headline),
`coverage:"bounded_first_page"`, `complete:false`, `messageBodiesSearched:false`,
scanned/matched conversation counts, missing/truncated summary counts and
`stored:false`. `meta.status` stays partial, `meta.partial` true, and pagination
remains unsupported at offset zero with no cursor. Zero matches and even a known
empty first page remain partial; the server cannot certify the entire inbox.

Blank or overly long queries fail SDK validation before provider work. A search
count above 25 returns INVALID_INBOX_SEARCH before the guard/provider runs.
The old unfiltered limit remains 50. Provider errors and unrecognized nonempty
shapes retain their existing errors rather than turning into no-match results.

## TRD and request boundary

A pure helper accepts already shaped summaries. The existing get_inbox handler
retains its guard, pacing, own-identity and inbox routes. The keyword is never
sent as a provider query and no conversation, profile, next-page or fallback
request is added. Synthetic handler fixtures count the two existing direct
Voyager calls; this is not an account-wide HTTP ceiling. Authentication, browser
navigation/background activity and implicit identity checks remain governed by
the existing authorization, so do not promise a numeric total from that fixture.
The native output schema accepts either the unchanged legacy array or the new
bounded search object. The tool count remains 24; writes and safety state are
unchanged. Queries and results are not persisted by this feature. Client/model
processing and user-saved copies have their own retention.

## Implementation and acceptance

1. Add the bounded pure matcher and explicit output schema.
2. Add the optional argument and branch after the existing shaped read; reject
   invalid search limits before any provider work.
3. Test field boundaries, Unicode/literal matching, source-object lineage,
   pre-filter bounds, missing/cutoff counts, all empty/partial distinctions and
   provider-shape failures through the real SDK with synthetic responses.
4. Verify the compiled package advertises the argument and rejects an excessive
   search limit before its latched offline guard could run.
5. Complete independent review, source/package/security and exact-head hosted
   gates before integration. A future release needs a new version and artifact;
   do not attribute this behavior to public 4.4.0 or its pinned source plugin.
6. Current live usefulness needs separately authorized inbox access. Do not add
   this call to the owner's ongoing installation check or the own-profile pilot.

The feature is local summary filtering within an authenticated inbox tool, not
an offline substitute for fetching an inbox. It may help find returned recruiter
summaries, but does not implement message-body/full-inbox search, saved jobs,
Easy Apply, ATS submission, coordinated erasure or an official provider.

## Preserved review correction

The first review reproduced a participant-cutoff bypass: an absent source title
was generated from all participant names, so a name beyond the first 50 could
match indirectly. That candidate remains failed in review evidence. The corrected
normalizer carries explicit provider title provenance with each unchanged legacy
row. The matcher consumes that view, never the generated display fallback. SDK
regressions exercise actual normalization with a 51st-participant-only needle,
a first-50 match and a genuine provider-title match; legacy display rows remain
unchanged. No weak maps, hidden row properties or separate unbound title arrays
are used.
