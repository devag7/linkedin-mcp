# Build Backlog — path to feature-complete (M2→M4)

Grounded gap audit vs github.com/stickerdaniel/linkedin-mcp-server (their issues,
PRs, tools) + best-in-class expectations. Generated 2026-06-13. Many P0s are
wiring to plumbing that already exists in `src/browser/endpoints.ts`.

Verified against the actual tree. The brief is out of date on one major point: write tools already exist. Here is the grounded backlog.

---

## STATE CORRECTION (read before the backlog)

v2 ships **17 registered tools**, and **write tools already exist** (alpha, `confirm:true`-gated, all via in-page Voyager `POST`): `connect_with_person`, `send_message`, `create_post`, `react_to_post`, `comment_on_post` (`src/tools/write.ts`). Reads: `get_profile`, `get_my_profile`, `get_feed`, `get_notifications`, `search_jobs`, `search_people`, `get_company`, `get_inbox`, `get_conversation`. Meta: `whoami`, `health_check`, `close_session`.

Three things matter for prioritization:
1. **Plumbing exists ahead of tools.** `src/browser/endpoints.ts` already defines `jobPostingGraphql`, `companyPosts` (queryId in `KNOWN_QUERY_IDS`), `invitationsReceived`/`invitationsSent`, `profileSkillsGraphql`, and a `COMPANIES` search vertical — but **no tools are wired to them**. Several P0s are wiring jobs, not green-field.
2. **Our write path is Voyager `POST`, not DOM clicking.** This structurally immunizes us against the entire competitor `connect_with_person`/composer DOM-bug cluster (see "bugs to avoid"). Big moat — but we have our own correctness gaps.
3. **`get_profile` is thin**: returns only core + experience + education (`src/tools/profile.ts` `buildProfile`). No skills/certs/contact/recommendations even though the section plumbing supports it.

Data-source tags: `voyager-inpage` | `dom-fallback` | `official-oauth`. ⚠️ = write/ban-sensitive.

---

## P0 — table stakes + cheap wins (plumbing mostly exists)

**Status: P0 cleared (2026-06-14).** All P0 rows landed in v2.0.0. Writes are
hardened + gated but their live payloads still need a burner re-verify (the
2026-06-14 read-spike, run with pacing disabled on a brand-new account, tripped
a session logout — re-login the burner and run `--writecapture` to lock the
exact write request shapes).

| Capability | Status | Notes |
|---|---|---|
| **Expand `get_profile` sections**: skills, certifications, languages, honors, projects, contact_info, recommendations | ✅ skills/certs/languages | `buildProfile` fetches sections in parallel, no 30-cap (#360 avoided). honors/projects/contact_info/recommendations still open (P1 depth). |
| **`get_job_details`** | ✅ done | `jobPostingGraphql` + deep-walk shaper (prior commit). |
| **`get_company_posts`** | ✅ done | DOM fallback (`scrapeCompanyPosts`), consistent with the other company tools. |
| **`search_companies`** | ✅ done | DOM fallback (prior commit). |
| **`get_pending_invitations`** (received + sent) | ✅ done | Voyager `invitationsReceived`/`invitationsSent` + tolerant `shapePendingInvitations`; partial-tolerant. **Live-verify pending** (burner logged out). |
| **Harden the 5 alpha write tools** ⚠️ | ✅ hardened; **ALL 5 verified** | `voyagerPostRaw` + `classifyWrite` → structured statuses (catches HTTP-200 GraphQL `errors[]` + plain-text 200 errors — proven live). Every legacy REST-li write endpoint was dead; all rewired to the live SPA's actual request via `--writecapture`/`--writeprobe`: **connect** → `voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreateV2` (capture-verified); **create_post** → `voyagerContentcreationDashShares` mutation (HTTP 200 ok); **react_to_post** → `voyagerSocialDashReactions` mutation (HTTP 200 ok); **comment_on_post** → `voyagerSocialDashNormComments` (HTTP 201 ok); **send_message** → `voyagerMessagingDashMessengerMessages?action=createMessage` (HTTP 200 ok, reply path). react/comment target the ACTIVITY urn; send_message new-thread path is best-known. |
| **`get_company_employees`** | ✅ done | DOM fallback (`scrapeCompanyEmployees`) off the company People tab. |
| **Deepen `health_check` + expose cap/rate-limit status** | ✅ done | Live Voyager `/me` probe + budget snapshot (used/cap/remaining + pending invites); status `healthy`/`degraded`/`logged_out`. |

## P1 — differentiators / outreach + content core

| Capability | Source | Notes |
|---|---|---|
| **Invitations management**: `accept_invitation`, `withdraw_invitation`, `ignore_invitation` ⚠️ | `voyager-inpage` | Completes the network family (#460, #504/#505). |
| **`get_connections`** (1st-degree, sortable by recently-added) | `voyager-inpage` | #453. **PII-bulk-sensitive** → gate + cap (their #213). |
| **`get_post`** (single post: full text + media download + comments + reactions) | `voyager-inpage` + `dom-fallback` | PR #489. DOM fallback needed for "Activate to view larger image" placeholders. |
| **`search_posts` / content search** | `voyager-inpage` | #318, still open upstream — beat them to it. |
| **`get_similar_profiles` / "people also viewed"** | `voyager-inpage`/`dom-fallback` | Lookalike discovery (their `get_sidebar_profiles`). |
| **`follow`/`unfollow` (person + company), `endorse_skill`** ⚠️ | `voyager-inpage` | Engagement write surface. |
| **`create_image_post`, `repost`, `edit_post`, `delete_post`, `media_upload`** ⚠️ | `voyager-inpage` | Extends existing `create_post`; needs media register/upload flow. |
| **Saved jobs**: `get_saved_jobs` + `save_job`/`unsave_job` | `voyager-inpage` (+light ⚠️) | #364/PR #338. |
| **OAuth 2.1 auth-code + multi-user remote** | `official-oauth` | We already have token validate (`src/auth/oauth.ts`) + http transport — finish the auth-code flow for hosted/Cloud-Run multi-user (#231/#232). Unlocks compliant posting/analytics. |

## P2 — depth / heavy / lower demand

| Capability | Source | Notes |
|---|---|---|
| **Analytics**: profile views (who-viewed-me), post/content performance, engagement reports, optimal-time/hashtag analysis | `voyager-inpage` (some `official-oauth`) | southleft's biggest surface; creator/recruiter value. |
| **Drafts lifecycle + scheduling** ⚠️ | local store + `voyager-inpage`/`official-oauth` | create/list/update/publish drafts; schedule/cancel posts. |
| **Profile editing** (own headline/summary/experience) ⚠️ | `voyager-inpage` | Higher ban sensitivity — gate hard. |
| **Conversation management**: `mark_as_seen`, `star_conversation`, `archive` ⚠️ | `voyager-inpage` | PR #462; cheap once messaging hardened. |
| **AI image generation for posts** ⚠️ | external API | gacabartosz parity; optional. |
| **Sales-Nav-grade search filters** (seniority, headcount, function, boolean) | `voyager-inpage` | Power-user expectation; extend `searchClusters` filter map. |

---

## THEIR BUGS WE MUST NOT SHIP

**Architectural moat (keep it):** our writes are Voyager `POST`, so we **already dodge** the entire competitor DOM cluster — connect button hidden under "More"/sticky-navbar (#304/#406), the late-mounting `role=alertdialog`/`aria-modal` invite gate (#455/#458), dialog-vs-composer overlay collisions (#432), localized-button-text matching (#454/#504), and the composer timeout/headless/overlay failures (#296/#344/#433). Don't regress into DOM clicking for writes. Lead with this.

**Real risks in OUR current code — fix proactively:**

1. **False-positive success (#365, #448).** `src/tools/write.ts` returns `ok({ sent:true })` straight from `voyagerPost` **without inspecting the response**. Must parse the Voyager result and return structured status (`sent | duplicate | already_connected | restricted | quota_exhausted | failed`). Invite-note free-quota exhaustion (#448) must surface as its own status, not silent success/`send_failed`.

2. **`send_message` always creates a NEW thread (#483, #434).** Confirmed: it always sends `conversationCreate` with `recipients` only — exactly the bug where replying to a recruiter/InMail spawns a new DM. Add `thread_id`/`conversation_urn` targeting with priority `thread_id > recipient_urn` (we already have `conversationMessages`/`messagingConversationEvents` endpoints to target existing threads).

3. **Query-id rotation → silent empty results (#224/#195/#201).** `endpoints.ts` itself warns the `graphql` queryIds rotate. On a rotated/400 response, return an actionable error ("queryId stale, refresh from DevTools") — never an empty array that looks like "no results". Fold a real Voyager probe into `health_check`.

4. **Detail-section truncation at 30 (#360).** When wiring skills/certs/connections, paginate fully (`start`/`count` loop) — don't stop at the first page.

5. **`get_conversation` scope leak (#442/#307).** We use the structured `conversationMessages` endpoint (good — no inbox-sidebar leakage). Keep it endpoint-based; add thread-id addressing and handle multiple threads with the same person.

6. **Bulk-PII exposure (#213/#271/#279).** Session perms are already correct (`src/auth/store.ts`: dir `0o700`, file `0o600`) — we already beat their #271/#279. But `get_connections`/contact-export are new PII firehoses → add explicit approval gating + daily caps + chunked, paced batches.

7. **Docker zombie-chrome reaper (#477).** `Dockerfile` runs `node` as PID 1 with **no init** — same zombie-Chromium risk. Add `tini` as entrypoint. (Non-root user is already correct, so we avoid #321.)

8. **Setup first-run failures (#404/#317).** Verify the Patchright/Chromium binary on startup with an actionable message instead of a vague "network error"; ensure the login flow can't loop on `ERR_TOO_MANY_REDIRECTS`. (Pydantic/FastMCP bugs #389/#484 are Python-only — N/A to us.)

**Avoid the maintainer's rejected paths:** no bolt-on pay-per-use/tollbooth monetization (closed #487) and no sponsor banners (closed #509) — keep safety/pacing as the differentiator instead.