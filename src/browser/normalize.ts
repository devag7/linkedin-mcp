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
