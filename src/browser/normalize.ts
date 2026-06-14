/**
 * Voyager response normalizer + output shapers.
 *
 * Voyager returns normalized JSON: a `data` envelope plus a flat `included[]`
 * array of entities referenced by URN. Raw, it is a token-firehose with
 * unresolved URN pointers — useless to dump at an LLM. This module indexes
 * `included[]` and exposes resolvers + per-domain shapers that pluck only the
 * fields a tool promises, producing small, stable, human-readable objects.
 */

export interface NormalizedResponse {
  data?: Record<string, unknown>;
  included?: VoyagerEntity[];
}

export interface VoyagerEntity {
  entityUrn?: string;
  $type?: string;
  [k: string]: unknown;
}

/** Index of included[] entities by entityUrn for O(1) resolution. */
export class IncludedIndex {
  private byUrn = new Map<string, VoyagerEntity>();

  constructor(resp: NormalizedResponse) {
    for (const e of resp.included ?? []) {
      if (e.entityUrn) this.byUrn.set(e.entityUrn, e);
    }
  }

  resolve(urn?: string | null): VoyagerEntity | undefined {
    if (!urn) return undefined;
    return this.byUrn.get(urn);
  }

  resolveAll(urns?: (string | null)[] | null): VoyagerEntity[] {
    if (!urns) return [];
    return urns.map((u) => this.resolve(u)).filter((e): e is VoyagerEntity => !!e);
  }

  /** All entities whose $type matches (e.g. the profile entity). */
  findByType(typeSuffix: string): VoyagerEntity[] {
    const out: VoyagerEntity[] = [];
    for (const e of this.byUrn.values()) {
      if (typeof e.$type === 'string' && e.$type.endsWith(typeSuffix)) out.push(e);
    }
    return out;
  }

  all(): VoyagerEntity[] {
    return [...this.byUrn.values()];
  }
}

/** Collapse a Voyager vectorImage into a single best-resolution URL. */
export function vectorImageUrl(img: unknown): string | undefined {
  if (!img || typeof img !== 'object') return undefined;
  const v = img as {
    rootUrl?: string;
    artifacts?: { width?: number; fileIdentifyingUrlPathSegment?: string }[];
  };
  if (!v.rootUrl || !v.artifacts?.length) return undefined;
  const best = [...v.artifacts].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return best?.fileIdentifyingUrlPathSegment
    ? v.rootUrl + best.fileIdentifyingUrlPathSegment
    : undefined;
}

/** Voyager dates are {year,month,day}; render as ISO-ish "YYYY-MM" / "YYYY". */
export function fmtDate(d: unknown): string | undefined {
  if (!d || typeof d !== 'object') return undefined;
  const { year, month } = d as { year?: number; month?: number };
  if (!year) return undefined;
  return month ? `${year}-${String(month).padStart(2, '0')}` : `${year}`;
}

/**
 * Extract a "start"/"end" date from an entity that uses either the legacy
 * `timePeriod:{startDate,endDate}` shape or the DASH `dateRange:{start,end}` shape.
 */
function entityDates(e: Record<string, unknown>): { start?: string; end?: string } {
  const tp = e['timePeriod'] as Record<string, unknown> | undefined;
  const dr = e['dateRange'] as Record<string, unknown> | undefined;
  if (tp) return { start: fmtDate(tp['startDate']), end: fmtDate(tp['endDate']) };
  if (dr) return { start: fmtDate(dr['start']), end: fmtDate(dr['end']) };
  return {};
}

/**
 * Resolve the authenticated member's public identifier (vanity slug) from a
 * `/me` response — used to then fetch the full DASH profile.
 */
export function ownPublicId(me: NormalizedResponse): string | undefined {
  for (const e of me.included ?? []) {
    const pid = (e as Record<string, unknown>)['publicIdentifier'];
    if (typeof pid === 'string' && pid) return pid;
  }
  return undefined;
}

/**
 * Extract the `fsd_profile` URN id from a DASH profile response (the Profile
 * entity's entityUrn), needed to fetch its lazy-loaded component sections.
 */
export function fsdProfileId(resp: NormalizedResponse): string | undefined {
  const p = (resp.included ?? []).find((e) => 'firstName' in e) as
    | Record<string, unknown>
    | undefined;
  const urn = typeof p?.['entityUrn'] === 'string' ? (p['entityUrn'] as string) : undefined;
  return urn?.match(/urn:li:fsd_profile:([^,)]+)/)?.[1];
}

/**
 * Resolve the authenticated member's fsd_profile id from a `/me` response
 * (the mini-profile URN id, shared with the fsd_profile URN).
 */
export function ownFsdId(me: NormalizedResponse): string | undefined {
  for (const e of me.included ?? []) {
    const urn = (e as Record<string, unknown>)['entityUrn'];
    const m = typeof urn === 'string' ? urn.match(/urn:li:fs[d]?_(?:mini)?[Pp]rofile:([^,)]+)/) : null;
    if (m) return m[1];
  }
  return undefined;
}

export interface ShapedConversation {
  title?: string;
  lastActivityAt?: number;
  unreadCount?: number;
  read?: boolean;
  conversationUrn?: string;
}

/** Shape an inbox conversations response into a compact list. */
export function shapeInbox(resp: NormalizedResponse): ShapedConversation[] {
  const out: ShapedConversation[] = [];
  for (const e of resp.included ?? []) {
    if (typeof e.$type !== 'string' || !e.$type.endsWith('.Conversation')) continue;
    const c = e as Record<string, unknown>;
    out.push({
      title: asText(c['title']) ?? asText(c['headlineText']) ?? asText(c['shortHeadlineText']),
      lastActivityAt: typeof c['lastActivityAt'] === 'number' ? (c['lastActivityAt'] as number) : undefined,
      unreadCount: typeof c['unreadCount'] === 'number' ? (c['unreadCount'] as number) : undefined,
      read: typeof c['read'] === 'boolean' ? (c['read'] as boolean) : undefined,
      conversationUrn: typeof c['entityUrn'] === 'string' ? (c['entityUrn'] as string) : undefined,
    });
  }
  return out;
}

export interface ShapedJobDetails {
  title?: string;
  description?: string;
  company?: string;
  location?: string;
  workplaceType?: string;
  jobUrn?: string;
  listedAt?: number;
}

/** Shape a single job posting. Deep-walks the response — the job node may live
 *  in data.data or included depending on the query — and picks the richest
 *  job-like object (has a title + job-ish fields). Tolerant by design. */
export function shapeJobDetails(resp: NormalizedResponse): ShapedJobDetails {
  let job: Record<string, unknown> | undefined;
  let company: Record<string, unknown> | undefined;

  const looksJob = (o: Record<string, unknown>): boolean =>
    typeof o['title'] === 'string' &&
    ('description' in o || 'jobState' in o || 'companyDetails' in o || 'formattedLocation' in o || 'workRemoteAllowed' in o);

  const visit = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    const o = n as Record<string, unknown>;
    const t = typeof o['$type'] === 'string' ? (o['$type'] as string) : '';
    if (!job && looksJob(o)) job = o;
    if (!company && t.endsWith('.Company') && typeof o['name'] === 'string') company = o;
    for (const v of Object.values(o)) visit(v);
  };
  visit(resp.data);
  visit(resp.included);

  const j = job ?? {};
  return {
    title: asText(j['title']),
    description: asText(j['description']),
    company: asText(company?.['name']) ?? asText((j['companyDetails'] as Record<string, unknown>)?.['name']),
    location: asText(j['formattedLocation']) ?? asText(j['location']),
    workplaceType:
      j['workRemoteAllowed'] === true ? 'Remote allowed' : asText(j['workplaceType']),
    jobUrn: typeof j['entityUrn'] === 'string' ? (j['entityUrn'] as string) : undefined,
    listedAt: typeof j['listedAt'] === 'number' ? (j['listedAt'] as number) : undefined,
  };
}

export interface ShapedMessage {
  text?: string;
  deliveredAt?: number;
}

/** Shape a conversation's messages (tolerant; field names may vary by deploy). */
export function shapeConversationMessages(resp: NormalizedResponse): ShapedMessage[] {
  const out: ShapedMessage[] = [];
  for (const e of resp.included ?? []) {
    if (typeof e.$type !== 'string' || !e.$type.endsWith('.Message')) continue;
    const m = e as Record<string, unknown>;
    out.push({
      text: asText(m['body']) ?? asText(m['previewText']),
      deliveredAt: typeof m['deliveredAt'] === 'number' ? (m['deliveredAt'] as number) : undefined,
    });
  }
  return out;
}

export interface ShapedJob {
  title?: string;
  location?: string;
  listedAt?: number;
  jobUrn?: string;
}

/** Shape a job-search response from the JobPosting entities (not the thin Card). */
export function shapeJobs(resp: NormalizedResponse): ShapedJob[] {
  const out: ShapedJob[] = [];
  for (const e of resp.included ?? []) {
    if (typeof e.$type !== 'string' || !e.$type.endsWith('.JobPosting')) continue;
    const j = e as Record<string, unknown>;
    out.push({
      title: asText(j['title']),
      location: asText(j['formattedLocation']) ?? asText(j['location']),
      listedAt: typeof j['listedAt'] === 'number' ? (j['listedAt'] as number) : undefined,
      jobUrn: typeof j['entityUrn'] === 'string' ? (j['entityUrn'] as string) : undefined,
    });
  }
  return out;
}

export interface ComponentEntry {
  title?: string;
  subtitle?: string;
  caption?: string;
  meta?: string;
}

/**
 * Walk a profile-components response (experience/education/skills) and collect
 * the entries. LinkedIn renders each as an `entityComponent` with title /
 * subtitle / caption text models; we recurse the whole response and pull every
 * such node, tolerant of the exact nesting (grouped roles, sub-components).
 */
export function collectComponentEntries(resp: NormalizedResponse): ComponentEntry[] {
  const out: ComponentEntry[] = [];
  const seen = new Set<string>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const v of node) visit(v);
      return;
    }
    const obj = node as Record<string, unknown>;
    const ec = obj['entityComponent'];
    if (ec && typeof ec === 'object') {
      const e = ec as Record<string, unknown>;
      const entry: ComponentEntry = {
        title: asText(e['titleV2']) ?? asText(e['title']),
        subtitle: asText(e['subtitle']),
        caption: asText(e['caption']),
        meta: asText(e['metadata']),
      };
      const key = `${entry.title}|${entry.subtitle}|${entry.caption}`;
      if ((entry.title || entry.subtitle) && !seen.has(key)) {
        seen.add(key);
        out.push(entry);
      }
    }
    for (const v of Object.values(obj)) visit(v);
  };

  // Entries live in the PagedListComponent inside included[], not only in data.
  visit(resp.data);
  visit(resp.included);
  return out;
}

export interface ShapedInvitation {
  fromName?: string;
  fromHeadline?: string;
  sentAt?: number;
  message?: string;
  invitationUrn?: string;
  sharedSecret?: string;
}

/**
 * Shape a received/sent invitations response. Voyager nests the inviter inside
 * `fromMember`/`invitation` with rotating shapes, so we deep-walk and pull every
 * invitation-like node tolerantly (name + headline + the urn/sharedSecret needed
 * to accept/withdraw later).
 */
export function shapePendingInvitations(resp: NormalizedResponse): ShapedInvitation[] {
  const out: ShapedInvitation[] = [];
  const seen = new Set<string>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const v of node) visit(v);
      return;
    }
    const o = node as Record<string, unknown>;
    const t = typeof o['$type'] === 'string' ? (o['$type'] as string) : '';
    const looksInvite =
      t.endsWith('.Invitation') ||
      ('invitationType' in o && ('fromMember' in o || 'invitationUrn' in o)) ||
      ('sharedSecret' in o && 'entityUrn' in o);
    if (looksInvite) {
      const from = (o['fromMember'] ?? o['fromMemberProfile'] ?? o['inviter']) as
        | Record<string, unknown>
        | undefined;
      const name =
        asText(from?.['firstName']) && asText(from?.['lastName'])
          ? `${asText(from?.['firstName'])} ${asText(from?.['lastName'])}`
          : asText(from?.['title']) ?? asText(o['title']);
      const urn =
        (typeof o['entityUrn'] === 'string' ? (o['entityUrn'] as string) : undefined) ??
        (typeof o['invitationUrn'] === 'string' ? (o['invitationUrn'] as string) : undefined);
      const key = urn ?? `${name}|${asText(o['sentTime'])}`;
      if ((name || urn) && !seen.has(key)) {
        seen.add(key);
        out.push({
          fromName: name?.trim(),
          fromHeadline: asText(from?.['headline']) ?? asText(from?.['occupation']),
          sentAt:
            typeof o['sentTime'] === 'number'
              ? (o['sentTime'] as number)
              : typeof o['sentAt'] === 'number'
                ? (o['sentAt'] as number)
                : undefined,
          message: asText(o['message']),
          invitationUrn: urn,
          sharedSecret: typeof o['sharedSecret'] === 'string' ? (o['sharedSecret'] as string) : undefined,
        });
      }
    }
    for (const v of Object.values(o)) visit(v);
  };
  visit(resp.data);
  visit(resp.included);
  return out;
}

export interface ShapedProfile {
  publicIdentifier?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  summary?: string;
  locationName?: string;
  industryName?: string;
  pictureUrl?: string;
  experience: { title?: string; company?: string; start?: string; end?: string }[];
  education: { school?: string; degree?: string; field?: string; start?: string; end?: string }[];
}

/**
 * Shape a /identity/profiles/{id}/profileView response into a compact profile.
 * Tolerant of missing sections — returns what it finds.
 */
export function shapeProfileView(resp: NormalizedResponse): ShapedProfile {
  const idx = new IncludedIndex(resp);
  // The core profile entity carries firstName + a profile URN.
  const profile =
    idx.all().find(
      (e) =>
        typeof e.entityUrn === 'string' &&
        e.entityUrn.includes('fsd_profile') &&
        'firstName' in e,
    ) ??
    idx.all().find((e) => 'firstName' in e) ??
    {};

  const experience: ShapedProfile['experience'] = [];
  const education: ShapedProfile['education'] = [];
  for (const e of idx.all()) {
    const t = typeof e.$type === 'string' ? e.$type : '';
    if (t.endsWith('Position')) {
      const tp = e as Record<string, unknown>;
      const d = entityDates(tp);
      experience.push({
        title: str(tp['title']),
        company: str(tp['companyName']),
        start: d.start,
        end: d.end,
      });
    } else if (t.endsWith('Education')) {
      const ed = e as Record<string, unknown>;
      const d = entityDates(ed);
      education.push({
        school: str(ed['schoolName']),
        degree: str(ed['degreeName']),
        field: str(ed['fieldOfStudy']),
        start: d.start,
        end: d.end,
      });
    }
  }

  const p = profile as Record<string, unknown>;
  return {
    publicIdentifier: str(p['publicIdentifier']),
    firstName: str(p['firstName'])?.trim(),
    lastName: str(p['lastName'])?.trim(),
    headline: str(p['headline'])?.trim(),
    summary: str(p['summary']),
    locationName: str(p['locationName']) ?? str(p['geoLocationName']),
    industryName: str(p['industryName']),
    pictureUrl: vectorImageUrl(
      (p['profilePicture'] as Record<string, unknown>)?.['displayImageReference'] ??
        p['profilePicture'],
    ),
    experience,
    education,
  };
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Pull display text out of LinkedIn's nested text models, tolerant of
 * `"x"`, `{text:"x"}`, and `{text:{text:"x"}}` shapes.
 */
function asText(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (v && typeof v === 'object') {
    const t = (v as { text?: unknown }).text;
    if (typeof t === 'string') return t.trim() || undefined;
    if (t && typeof t === 'object') {
      const inner = (t as { text?: unknown }).text;
      if (typeof inner === 'string') return inner.trim() || undefined;
    }
  }
  return undefined;
}

export interface ShapedNotification {
  headline?: string;
  text?: string;
  publishedAt?: number;
  read?: boolean;
}

/** Shape a notifications cards response into a compact list. */
export function shapeNotifications(resp: NormalizedResponse): ShapedNotification[] {
  const out: ShapedNotification[] = [];
  for (const e of resp.included ?? []) {
    if (typeof e.$type !== 'string' || !e.$type.endsWith('.Card')) continue;
    const c = e as Record<string, unknown>;
    out.push({
      headline: asText(c['headline']),
      text: asText(c['contentPrimaryText']) ?? asText(c['subHeadline']),
      publishedAt: typeof c['publishedAt'] === 'number' ? (c['publishedAt'] as number) : undefined,
      read: typeof c['read'] === 'boolean' ? (c['read'] as boolean) : undefined,
    });
  }
  return out;
}

export interface ShapedFeedPost {
  actor?: string;
  text?: string;
  activityUrn?: string;
}

/** Shape a home-feed response into a compact list of posts. */
export function shapeFeed(resp: NormalizedResponse): ShapedFeedPost[] {
  const out: ShapedFeedPost[] = [];
  for (const e of resp.included ?? []) {
    if (typeof e.$type !== 'string' || !e.$type.endsWith('.Update')) continue;
    const u = e as Record<string, unknown>;
    const actorObj = u['actor'] as Record<string, unknown> | undefined;
    const meta = u['metadata'] as Record<string, unknown> | undefined;
    out.push({
      actor: asText(actorObj?.['name']),
      text: asText(u['commentary']),
      activityUrn: typeof meta?.['backendUrn'] === 'string' ? (meta['backendUrn'] as string) : undefined,
    });
  }
  return out;
}
