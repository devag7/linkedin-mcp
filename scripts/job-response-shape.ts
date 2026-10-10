/** Diagnostic reduction only. No account access, raw values, dynamic keys or persistence. */
const keys = new Set([
  'data',
  'included',
  'elements',
  'paging',
  'total',
  'start',
  'count',
  '$type',
  'entityUrn',
  '*jobPosting',
  '*company',
  'jobPosting',
  'jobPostingCard',
  'jobCard',
  'jobSearchCard',
  'title',
  'text',
  'description',
  'formattedLocation',
  'location',
  'locationName',
  'company',
  'companyDetails',
  'name',
  'listedAt',
  'originalListedAt',
  'workRemoteAllowed',
  'workplaceType',
  'jobState',
  'primaryDescription',
  'secondaryDescription',
  'caption',
  'bullet',
  'error',
  'errors',
  'message',
  'code',
  'status',
  'extensions',
  'path',
  'locations',
]);
// Only these literal machine codes may survive reduction. Messages never do.
const errorCodes = new Set([
  'PERSISTED_QUERY_NOT_FOUND',
  'PERSISTED_QUERY_NOT_SUPPORTED',
  'PersistedQueryNotFound',
  'PersistedQueryNotSupported',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'BAD_USER_INPUT',
  'INTERNAL_SERVER_ERROR',
]);
const kind = (value: unknown) =>
  value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;

export function jobResponseShape(raw: unknown) {
  const paths = new Map<
    string,
    { types: Set<string>; observations: number; nonemptyStrings: number }
  >();
  const codes = new Set<string>();
  const entities = { jobPosting: 0, jobCard: 0, company: 0, otherTyped: 0 };
  const pending = [{ value: raw, path: '$', depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let unknownKeys = 0;
  let truncated = false;
  while (pending.length && nodes < 10000) {
    const next = pending.pop()!;
    nodes++;
    const entry = paths.get(next.path) ?? {
      types: new Set<string>(),
      observations: 0,
      nonemptyStrings: 0,
    };
    entry.types.add(kind(next.value));
    entry.observations++;
    if (typeof next.value === 'string' && next.value.trim()) entry.nonemptyStrings++;
    paths.set(next.path, entry);
    if (!next.value || typeof next.value !== 'object') continue;
    if (seen.has(next.value) || next.depth >= 12) {
      truncated = true;
      continue;
    }
    seen.add(next.value);
    if (Array.isArray(next.value)) {
      for (const value of next.value.slice(0, 100))
        pending.push({ value, path: `${next.path}[]`, depth: next.depth + 1 });
      if (next.value.length > 100) truncated = true;
      continue;
    }
    const record = next.value as Record<string, unknown>;
    const type = record.$type;
    if (typeof type === 'string') {
      if (type.endsWith('.JobPosting')) entities.jobPosting++;
      else if (type.endsWith('.JobCard')) entities.jobCard++;
      else if (type.endsWith('.Company')) entities.company++;
      else entities.otherTyped++;
    }
    const code = record.code;
    if (typeof code === 'string') codes.add(errorCodes.has(code) ? code : 'unrecognized');
    const entries = Object.entries(record);
    if (entries.length > 100) truncated = true;
    for (const [key, value] of entries.slice(0, 100)) {
      const known = keys.has(key);
      if (!known) unknownKeys++;
      pending.push({
        value,
        path: `${next.path}.${known ? key : '<other>'}`,
        depth: next.depth + 1,
      });
    }
  }
  if (pending.length) truncated = true;
  return {
    schemaVersion: 1,
    scope:
      'Shape only; no values, raw entity types, identities, URLs, query IDs or dynamic keys retained.',
    nodes,
    unknownKeys,
    truncated,
    entities,
    providerCodeClasses: [...codes].sort(),
    paths: [...paths.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, entry]) => ({
        path,
        types: [...entry.types].sort(),
        observations: entry.observations,
        nonemptyStrings: entry.nonemptyStrings,
      })),
  };
}
