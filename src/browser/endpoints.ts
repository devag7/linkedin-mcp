/**
 * Centralized catalog of LinkedIn Voyager REST-li paths and known GraphQL
 * queryId patterns used by the v2 tools.
 *
 * Every builder returns the path string *after* `/voyager/api` — exactly what
 * {@link VoyagerClient.voyagerGet} / `voyagerPost` expect (they prepend the
 * `/voyager/api` prefix themselves). GraphQL builders return the full
 * `/graphql?...` query string for the same reason.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * IMPORTANT — these are BEST-KNOWN, not contractual.
 *
 * LinkedIn's Voyager API is private and undocumented. The REST-li path shapes
 * below are stable-ish but can change without notice. The GraphQL `queryId`
 * values (e.g. `voyagerSearchDashClusters.<hash>`) ROTATE frequently: LinkedIn
 * ships a new persisted-query hash on practically every web deploy. The hashes
 * embedded here are illustrative defaults captured at one point in time and
 * WILL go stale. Production callers must RE-CAPTURE the live queryId from a real
 * authenticated browser session (DevTools → Network → filter `graphql`) and pass
 * it in via the `queryId` parameter rather than relying on the bundled default.
 *
 * This module performs NO network I/O. Every function is a pure, deterministic
 * string builder that URL-encodes its parameters. It is unit-testable fully
 * offline.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Known GraphQL persisted-query IDs, captured live at one point in time.
 *
 * BEST-KNOWN ONLY. These hashes rotate on nearly every LinkedIn web deploy and
 * MUST be re-captured live. Treat them as fallbacks/examples, never guarantees.
 */
export const KNOWN_QUERY_IDS = {
  /** SRP DASH clusters — people/company search. Captured 2026-06-13. */
  searchClusters: 'voyagerSearchDashClusters.9a78a658089851e133c5b7bb2b4baee5',
  /** Jobs search DASH cards (GraphQL variant). Captured 2026-06-13. */
  jobsSearch: 'voyagerJobsDashJobCards.9c135b2568ee44623733b4a578d25279',
  /** Single job posting entity by urn (takes only jobPostingUrn). Captured 2026-06-13. */
  jobPosting: 'voyagerJobsDashJobPostings.891aed7916d7453a37e4bbf5f1f60de4',
  /** Profile cards (DASH). Captured 2026-06-13. */
  profileSkills: 'voyagerIdentityDashProfileComponents.86824295e1093fb0f5acdd8d57213aaa',
  /** Messaging conversations list (messaging GraphQL host). Captured 2026-06-13. */
  messagingConversations: 'messengerConversations.0d5e6781bbee71c3e51c8843c6519f48',
  /** A single conversation's messages (messaging GraphQL host). Captured 2026-06-13. */
  messagingMessages: 'messengerMessages.5846eeb71c981f11e0134cb6626cc314',
  /** Home feed updates (DASH). Captured 2026-06-13. */
  mainFeed: 'voyagerFeedDashMainFeed.923020905727c01516495a0ac90bb475',
  /** Company by universal name (DASH). Captured 2026-06-13. */
  company: 'voyagerOrganizationDashCompanies.148b1aebfadd0a455f32806df656c3c1',
  /** Company page updates / posts (DASH). Captured 2026-06-13. */
  companyPosts: 'voyagerFeedDashOrganizationalPageUpdates.827e11d165078dd7a5afaf1cba734121',
} as const;

/**
 * Decoration id for the full profile aggregate (header + experience + education
 * + skills). Captured live 2026-06-13 — increments on LinkedIn deploys.
 */
export const FULL_PROFILE_DECO =
  'com.linkedin.voyager.dash.deco.identity.profile.FullProfile-76';

/** Keys of {@link KNOWN_QUERY_IDS}. */
export type KnownQueryIdKey = keyof typeof KNOWN_QUERY_IDS;

/**
 * The two LinkedIn DASH search verticals exposed by the v2 tools. `ALL` is the
 * universal SRP; the others scope a single entity type.
 */
export type SearchVertical = 'ALL' | 'PEOPLE' | 'COMPANIES' | 'JOBS';

/** Map a {@link SearchVertical} to the Voyager SRP `resultType` token. */
const RESULT_TYPE: Record<SearchVertical, string> = {
  ALL: 'ALL',
  PEOPLE: 'PEOPLE',
  COMPANIES: 'COMPANIES',
  JOBS: 'JOBS',
};

/**
 * Encode a REST-li list literal, e.g. `List(value1,value2)`. Each element is
 * individually percent-encoded; the `List(...)` syntax itself is left intact
 * because Voyager parses it structurally.
 */
function restliList(values: readonly string[]): string {
  return `List(${values.map((v) => encodeURIComponent(v)).join(',')})`;
}

/**
 * Build a `graphql?queryId=...&variables=...` query string (the part after
 * `/voyager/api`). The caller-supplied `queryId` always wins so a freshly
 * re-captured hash can override the bundled {@link KNOWN_QUERY_IDS} default.
 *
 * NOTE: REST-li GraphQL `variables` use a structural literal syntax, NOT JSON
 * (e.g. `(start:0,count:10)`). LinkedIn requires the structural characters
 * `( ) : ,` to stay LITERAL in the URL — percent-encoding them yields HTTP 400.
 * Only individual VALUES that contain unsafe characters (e.g. a keyword with a
 * space) are encoded by the caller. So we leave `variables` verbatim here.
 */
function graphqlPath(queryId: string, variables: string): string {
  return `/graphql?queryId=${encodeURIComponent(queryId)}&variables=${variables}`;
}

/* ───────────────────────────── Identity / Profiles ──────────────────────── */

/**
 * Authenticated member's lightweight identity blob.
 * BEST-KNOWN REST-li path; stable but undocumented.
 */
export function me(): string {
  return '/me';
}

/**
 * @deprecated LinkedIn returns HTTP 410 for this legacy REST-li path (verified
 * live 2026-06-13). Use {@link dashProfile} / {@link dashProfileByUrn} instead.
 */
export function profileView(id: string): string {
  return `/identity/profiles/${encodeURIComponent(id)}/profileView`;
}

/**
 * Full profile by public identifier (vanity slug) via the DASH finder. This is
 * the current, working aggregate (header + experience + education + skills).
 * Verified live 2026-06-13: `q=memberIdentity` with the FullProfile decoration.
 *
 * @param publicId vanity slug, e.g. "williamhgates" (or the member's publicId)
 */
export function dashProfile(publicId: string): string {
  return (
    `/identity/dash/profiles?q=memberIdentity` +
    `&memberIdentity=${encodeURIComponent(publicId)}` +
    `&decorationId=${FULL_PROFILE_DECO}`
  );
}

/**
 * Full profile by `fsd_profile` URN id (the opaque id, e.g. "ACoAA...").
 * Verified live 2026-06-13 — the exact call the profile page makes.
 *
 * @param fsdProfileId the id portion of urn:li:fsd_profile:<id>
 */
export function dashProfileByUrn(fsdProfileId: string): string {
  return (
    `/identity/dash/profiles/urn:li:fsd_profile:${encodeURIComponent(fsdProfileId)}` +
    `?decorationId=${FULL_PROFILE_DECO}`
  );
}

/**
 * Profile section loaded lazily as UI components. LinkedIn keys these by the
 * `sectionType` token in the profileComponents finder; the richer sections
 * (skills/certifications/languages/honors/projects) lazy-load the same way as
 * experience/education.
 */
export type ProfileSection =
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'languages'
  | 'honors'
  | 'projects'
  | 'volunteering';

/**
 * A profile section's component cards (experience / education / skills).
 * FullProfile-76 is top-card only; these sections lazy-load via components.
 * Verified live 2026-06-13.
 *
 * @param fsdProfileId id portion of urn:li:fsd_profile:<id>
 * @param section which section to load
 */
export function profileComponents(
  fsdProfileId: string,
  section: ProfileSection,
  queryId: string = KNOWN_QUERY_IDS.profileSkills,
): string {
  // The profileUrn VALUE is itself a URN; its ':' chars must be encoded while
  // the outer (key:value,...) structure stays literal.
  const urn = encodeURIComponent(`urn:li:fsd_profile:${fsdProfileId}`);
  return graphqlPath(queryId, `(profileUrn:${urn},sectionType:${section})`);
}

/**
 * Top-level profile entity (header card: name, headline, location, picture).
 * BEST-KNOWN REST-li path.
 */
export function profile(id: string): string {
  return `/identity/profiles/${encodeURIComponent(id)}`;
}

/**
 * A member's skills sub-resource. The REST-li form below is the legacy,
 * always-available endpoint; the DASH/GraphQL equivalent
 * ({@link profileSkillsGraphql}) is richer but its queryId rotates.
 * BEST-KNOWN REST-li path.
 */
export function profileSkills(id: string): string {
  return `/identity/profiles/${encodeURIComponent(id)}/skills`;
}

/**
 * DASH/GraphQL variant of a member's skills. `queryId` ROTATES — re-capture live.
 * @param id member public identifier or URN id
 * @param queryId live persisted-query hash (defaults to a stale best-known value)
 */
export function profileSkillsGraphql(
  id: string,
  queryId: string = KNOWN_QUERY_IDS.profileSkills,
): string {
  return graphqlPath(queryId, `(profileUrn:${id})`);
}

/* ─────────────────────────────────── Search ─────────────────────────────── */

/**
 * Universal SRP "blended" cluster search via GraphQL DASH clusters — the engine
 * behind people/company/job search boxes.
 *
 * `queryId` ROTATES — re-capture live (see {@link KNOWN_QUERY_IDS.searchClusters}).
 *
 * @param keywords free-text query (percent-encoded into the variables literal)
 * @param vertical which result vertical to request
 * @param start zero-based pagination offset
 * @param count page size
 * @param queryId live persisted-query hash (defaults to a stale best-known value)
 */
export function searchClusters(
  keywords: string,
  vertical: SearchVertical = 'ALL',
  start = 0,
  count = 10,
  queryId: string = KNOWN_QUERY_IDS.searchClusters,
): string {
  const variables =
    `(start:${start},count:${count},origin:GLOBAL_SEARCH_HEADER,` +
    `query:(keywords:${encodeURIComponent(keywords)},` +
    `flagshipSearchIntent:SEARCH_SRP,` +
    `queryParameters:List((key:resultType,value:List(${RESULT_TYPE[vertical]})))))`;
  return graphqlPath(queryId, variables);
}

/* ─────────────────────────────────── Jobs ───────────────────────────────── */

/**
 * Jobs SRP search via the jobs DASH cluster collection.
 * `queryId` ROTATES — re-capture live.
 *
 * @param keywords free-text job query
 * @param locationGeoId LinkedIn geo URN id (e.g. "103644278" for the US); optional
 * @param start zero-based pagination offset
 * @param count page size
 * @param queryId live persisted-query hash (defaults to a stale best-known value)
 */
export function jobsSearch(
  keywords: string,
  locationGeoId?: string,
  start = 0,
  count = 25,
  queryId: string = KNOWN_QUERY_IDS.jobsSearch,
): string {
  const geo = locationGeoId
    ? `,locationUnion:(geoId:${encodeURIComponent(locationGeoId)})`
    : '';
  const variables =
    `(start:${start},count:${count},` +
    `query:(keywords:${encodeURIComponent(keywords)},origin:JOB_SEARCH_PAGE_QUERY_EXPANSION${geo}))`;
  return graphqlPath(queryId, variables);
}

/**
 * Jobs search via the REST-li jobs DASH cards collection (`q=jobSearch`).
 * Verified live 2026-06-13 — the exact call the jobs SRP makes.
 *
 * @param keywords free-text job query
 * @param locationGeoId optional LinkedIn geo URN id
 * @param start zero-based pagination offset
 * @param count page size
 */
export function jobCardsSearch(
  keywords: string,
  locationGeoId?: string,
  start = 0,
  count = 25,
): string {
  const deco = 'com.linkedin.voyager.dash.deco.jobs.search.JobSearchCardsCollection-220';
  const geo = locationGeoId ? `,locationUnion:(geoId:${encodeURIComponent(locationGeoId)})` : '';
  const query =
    `(origin:JOB_SEARCH_PAGE_QUERY_EXPANSION,` +
    `keywords:${encodeURIComponent(keywords)}${geo})`;
  return (
    `/voyagerJobsDashJobCards?decorationId=${deco}` +
    `&count=${count}&q=jobSearch&query=${query}&start=${start}`
  );
}

/**
 * Single job posting detail. The REST-li form is the always-available default;
 * the GraphQL card ({@link jobPostingGraphql}) carries richer apply metadata but
 * its queryId rotates.
 * BEST-KNOWN REST-li path.
 *
 * @param id numeric job posting id (the digits in /jobs/view/<id>)
 */
export function jobPosting(id: string): string {
  return `/jobs/jobPostings/${encodeURIComponent(id)}`;
}

/**
 * DASH/GraphQL variant of a single job posting card.
 * `queryId` ROTATES — re-capture live.
 */
export function jobPostingGraphql(
  id: string,
  queryId: string = KNOWN_QUERY_IDS.jobPosting,
): string {
  // The jobPostingUrn VALUE is a URN; encode its ':' chars, keep structure literal.
  const urn = encodeURIComponent(`urn:li:fsd_jobPosting:${id}`);
  return graphqlPath(queryId, `(jobPostingUrn:${urn})`);
}

/* ──────────────────────────────── Organizations ─────────────────────────── */

/**
 * Resolve a company by its universal name (the slug in /company/<name>/).
 * Voyager uses a REST-li finder: `?q=universalName&universalName=<name>`.
 * BEST-KNOWN REST-li path.
 *
 * @param name company universal name / vanity slug, e.g. "microsoft"
 */
export function companyByUniversalName(name: string): string {
  return `/organization/companies?q=universalName&universalName=${encodeURIComponent(name)}`;
}

/**
 * Company by universal name via the current DASH GraphQL op.
 * Verified live 2026-06-13: variables=(universalName:<name>).
 */
export function companyGraphql(
  name: string,
  queryId: string = KNOWN_QUERY_IDS.company,
): string {
  return graphqlPath(queryId, `(universalName:${encodeURIComponent(name)})`);
}

/**
 * Company entity by numeric organization id.
 * BEST-KNOWN REST-li path.
 */
export function companyById(id: string): string {
  return `/organization/companies/${encodeURIComponent(id)}`;
}

/* ──────────────────────────────── Messaging ─────────────────────────────── */

/**
 * The authenticated member's messaging conversations (inbox) collection.
 * BEST-KNOWN REST-li path; the DASH/GraphQL variant
 * ({@link messagingConversationsGraphql}) is richer but its queryId rotates.
 */
export function messagingConversations(): string {
  return '/messaging/conversations';
}

/**
 * A single conversation's events (messages) by conversation id.
 * BEST-KNOWN REST-li path.
 */
export function messagingConversationEvents(conversationId: string): string {
  return `/messaging/conversations/${encodeURIComponent(conversationId)}/events`;
}

/**
 * Inbox conversations via the messaging GraphQL host (a distinct base from the
 * main /graphql). Verified live 2026-06-13: variables=(mailboxUrn:<own profile urn>).
 *
 * @param ownFsdProfileId id portion of the authenticated member's urn:li:fsd_profile:<id>
 */
export function inboxConversations(
  ownFsdProfileId: string,
  queryId: string = KNOWN_QUERY_IDS.messagingConversations,
): string {
  const mailbox = encodeURIComponent(`urn:li:fsd_profile:${ownFsdProfileId}`);
  return `/voyagerMessagingGraphQL/graphql?queryId=${encodeURIComponent(queryId)}&variables=(mailboxUrn:${mailbox})`;
}

/**
 * Messages in a conversation via the messaging GraphQL host.
 * Verified shape 2026-06-13: variables=(conversationUrn:<full msg_conversation urn>).
 *
 * @param conversationUrn the full urn:li:msg_conversation:(...) (e.g. from get_inbox)
 */
export function conversationMessages(
  conversationUrn: string,
  queryId: string = KNOWN_QUERY_IDS.messagingMessages,
): string {
  const urn = encodeURIComponent(conversationUrn);
  return `/voyagerMessagingGraphQL/graphql?queryId=${encodeURIComponent(queryId)}&variables=(conversationUrn:${urn})`;
}

/**
 * DASH/GraphQL variant of the messaging conversations list.
 * `queryId` ROTATES — re-capture live.
 */
export function messagingConversationsGraphql(
  start = 0,
  count = 20,
  queryId: string = KNOWN_QUERY_IDS.messagingConversations,
): string {
  return graphqlPath(queryId, `(start:${start},count:${count})`);
}

/* ─────────────────────────────── Network / Invitations ──────────────────── */

/**
 * Pending received invitations collection (used to read the inbound queue).
 * BEST-KNOWN REST-li path.
 */
export function invitationsReceived(start = 0, count = 50): string {
  return `/relationships/invitationViews?q=receivedInvitation&start=${start}&count=${count}`;
}

/**
 * Sent invitations the member has issued (used to measure the outstanding
 * pending-invite ceiling).
 * BEST-KNOWN REST-li path.
 */
export function invitationsSent(start = 0, count = 50): string {
  return `/relationships/sentInvitationViewsV2?start=${start}&count=${count}`;
}

/* ───────────────────────────────── Writes ───────────────────────────────── */
/* BEST-KNOWN write endpoints (linkedin-api lineage). UNVERIFIED against current
 * Voyager — payloads may need a live tune on a throwaway account. All write
 * tools are gated behind an explicit confirm flag + the daily-cap safety layer. */

/** Send a connection invitation. POST. */
export function normInvitations(): string {
  return '/growth/normInvitations';
}
/**
 * Create a NEW conversation (first message to a member). POST.
 * The `?action=create` query is REQUIRED — REST-li dispatches the create action
 * on it; omitting it (the prior bug) hits the collection finder and 400s.
 */
export function messagingCreate(): string {
  return '/messaging/conversations?action=create';
}
/**
 * Reply into an EXISTING conversation thread. POST. This is the fix for the
 * "every reply spawns a new thread" bug (#483/#434): when the caller has a
 * conversation/thread id, target its events sub-collection instead of creating
 * a fresh conversation.
 *
 * @param conversationId the thread id (e.g. "2-abc…" from get_inbox's urn tail)
 */
export function messagingEventCreate(conversationId: string): string {
  return `/messaging/conversations/${encodeURIComponent(conversationId)}/events?action=create`;
}
/** Create a share/post. POST. */
export function normShares(): string {
  return '/contentcreation/normShares';
}
/** Delete a share/post by its urn (cleanup after a verification post). POST/DELETE. */
export function deleteShare(shareUrn: string): string {
  return `/contentcreation/normShares/${encodeURIComponent(shareUrn)}`;
}
/** React to a post. POST (threadUrn = the activity/share urn). */
export function reactions(threadUrn: string): string {
  return `/voyagerSocialDashReactions?threadUrn=${encodeURIComponent(threadUrn)}`;
}
/** Comment on a post. POST. */
export function comments(): string {
  return '/feed/comments';
}

/* ─────────────────────────────── Notifications ──────────────────────────── */

/**
 * The member's notifications feed (cards collection).
 * Verified live 2026-06-13 — the exact call the notifications page makes.
 */
export function notificationCards(start = 0, count = 20): string {
  const deco = 'com.linkedin.voyager.dash.deco.identity.notifications.CardsCollection-80';
  return (
    `/voyagerIdentityDashNotificationCards?decorationId=${deco}` +
    `&count=${count}&q=notifications&start=${start}`
  );
}

/* ──────────────────────────────────── Feed ──────────────────────────────── */

/**
 * Home feed updates (DASH GraphQL). `queryId` ROTATES — re-capture live.
 */
export function mainFeed(
  start = 0,
  count = 10,
  queryId: string = KNOWN_QUERY_IDS.mainFeed,
): string {
  // Verified live 2026-06-13: variables=(start,count,sortOrder:MEMBER_SETTING).
  return graphqlPath(queryId, `(start:${start},count:${count},sortOrder:MEMBER_SETTING)`);
}

/**
 * Internal helper exported for tests: encode a list of values into a REST-li
 * `List(...)` literal. Kept here so the encoding contract is verifiable.
 */
export { restliList as encodeRestliList };
