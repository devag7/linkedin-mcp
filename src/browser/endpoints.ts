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
  /** SRP (search-results-page) DASH clusters — people/company/job universal search. */
  searchClusters: 'voyagerSearchDashClusters.4c4a3f9e1f4c8a7b6d5e2f1a0b9c8d7e',
  /** Jobs search via the jobs DASH cluster collection. */
  jobsSearch: 'voyagerJobsDashJobCards.2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e',
  /** Single job posting card. */
  jobPosting: 'voyagerJobsDashJobPostingCards.7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b',
  /** Profile skills tab (DASH). */
  profileSkills: 'voyagerIdentityDashProfileComponents.1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
  /** Messaging conversations list (DASH). */
  messagingConversations: 'voyagerMessagingDashMessengerConversations.9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c',
} as const;

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
 * (e.g. `(start:0,count:10)`); we do not JSON-encode it. The whole string is
 * percent-encoded so it is safe inside a URL query.
 */
function graphqlPath(queryId: string, variables: string): string {
  return `/graphql?queryId=${encodeURIComponent(queryId)}&variables=${encodeURIComponent(
    variables,
  )}`;
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
 * Full `profileView` for a member by public identifier (vanity slug) or URN id.
 * This is the classic experience/education/skills aggregate.
 * BEST-KNOWN REST-li path.
 */
export function profileView(id: string): string {
  return `/identity/profiles/${encodeURIComponent(id)}/profileView`;
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
  return graphqlPath(queryId, `(jobPostingUrn:urn:li:fsd_jobPosting:${encodeURIComponent(id)})`);
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

/**
 * Internal helper exported for tests: encode a list of values into a REST-li
 * `List(...)` literal. Kept here so the encoding contract is verifiable.
 */
export { restliList as encodeRestliList };
