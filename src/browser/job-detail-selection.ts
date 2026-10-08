import type { NormalizedResponse } from './normalize.js';

/** Fixed structural classes only. Never expose a prefix, identifier, path or payload value. */
export const JOB_DETAIL_STRUCTURE_CHECKS = [
  'candidate_in_data',
  'candidate_in_included',
  'candidate_identity_absent',
  'candidate_supported_match',
  'candidate_supported_other',
  'candidate_unsupported',
  'format_missing',
  'format_non_string',
  'format_supported_legacy',
  'format_supported_dash',
  'format_supported_after_trim',
  'format_known_prefix_empty',
  'format_known_prefix_non_numeric',
  'format_known_prefix_numeric_over_limit',
  'format_other_linkedin_urn',
  'format_other_urn',
  'format_non_urn',
  'format_boundary_whitespace',
  'selection_unique',
  'selection_no_job',
  'selection_no_match',
  'selection_ambiguous',
] as const;
export type JobDetailStructureCheck = (typeof JOB_DETAIL_STRUCTURE_CHECKS)[number];
export class JobDetailSelectionError extends Error {
  constructor(
    readonly reason:
      | 'title_missing'
      | 'identity_absent'
      | 'identity_unsupported'
      | 'identity_mismatch'
      | 'identity_ambiguous'
      | 'selection_traversal_limit',
  ) {
    super('JOB_DETAIL_SELECTION_REJECTED');
  }
}

const supportedId = (urn: unknown) => {
  if (typeof urn !== 'string') return undefined;
  const match = /^urn:li:(?:fsd_)?jobPosting:([0-9]{1,20})$/.exec(urn);
  // JavaScript's $ also matches before a final newline. Require the whole value.
  return match?.[0] === urn ? match[1] : undefined;
};

/** Classify without normalizing or accepting unsupported identifiers. */
function formatClass(urn: unknown): JobDetailStructureCheck {
  if (urn === undefined || urn === null || urn === '') return 'format_missing';
  if (typeof urn !== 'string') return 'format_non_string';
  if (supportedId(urn) !== undefined)
    return urn.startsWith('urn:li:fsd_jobPosting:')
      ? 'format_supported_dash'
      : 'format_supported_legacy';
  if (supportedId(urn.trim()) !== undefined) return 'format_supported_after_trim';
  const known = /^urn:li:(?:fsd_)?jobPosting:([\s\S]*)$/.exec(urn);
  if (known) {
    if (!known[1]) return 'format_known_prefix_empty';
    return /^[0-9]+$/.test(known[1])
      ? 'format_known_prefix_numeric_over_limit'
      : 'format_known_prefix_non_numeric';
  }
  if (urn.startsWith('urn:li:')) return 'format_other_linkedin_urn';
  if (urn.startsWith('urn:')) return 'format_other_urn';
  return 'format_non_urn';
}

/** Exactly one matching job-like object. Other objects never supply facts or identity. */
export function selectJobDetailNode(
  response: NormalizedResponse,
  requestedId: string,
  observer?: (check: JobDetailStructureCheck) => void,
): Record<string, unknown> {
  const emit = (check: JobDetailStructureCheck) => {
    try {
      observer?.(check);
    } catch {
      // Diagnostic failure cannot change a selection or identity decision.
    }
  };
  const pending: { value: unknown; origin: 'data' | 'included' }[] = [
    { value: response.included, origin: 'included' },
    { value: response.data, origin: 'data' },
  ];
  const seen = new WeakSet<object>();
  const matches: Record<string, unknown>[] = [];
  let inspected = 0;
  let candidates = 0;
  let unsupported = 0;
  let other = 0;
  while (pending.length) {
    const { value, origin } = pending.pop()!;
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    if (++inspected > 10000) throw new JobDetailSelectionError('selection_traversal_limit');
    seen.add(value);
    const node = value as Record<string, unknown>;
    if (
      !Array.isArray(value) &&
      typeof node.title === 'string' &&
      ['description', 'jobState', 'companyDetails', 'formattedLocation', 'workRemoteAllowed'].some(
        (key) => key in node,
      )
    ) {
      candidates++;
      emit(origin === 'data' ? 'candidate_in_data' : 'candidate_in_included');
      const urn = node.entityUrn;
      emit(formatClass(urn));
      if (typeof urn === 'string' && urn.trim() !== urn) emit('format_boundary_whitespace');
      const id = supportedId(urn);
      if (id !== undefined && id === requestedId) {
        matches.push(node);
        emit('candidate_supported_match');
      } else if (id !== undefined) {
        other++;
        emit('candidate_supported_other');
      } else if (typeof urn !== 'string' || !urn) {
        emit('candidate_identity_absent');
      } else {
        unsupported++;
        emit('candidate_unsupported');
      }
    }
    // Iterative traversal avoids recursion depth failures. Object aliases count once.
    for (const child of Object.values(node).reverse())
      if (child && typeof child === 'object') pending.push({ value: child, origin });
  }
  if (matches.length === 1) {
    emit('selection_unique');
    return matches[0]!;
  }
  if (matches.length > 1) {
    emit('selection_ambiguous');
    throw new JobDetailSelectionError('identity_ambiguous');
  }
  if (!candidates) {
    emit('selection_no_job');
    throw new JobDetailSelectionError('title_missing');
  }
  emit('selection_no_match');
  throw new JobDetailSelectionError(
    unsupported ? 'identity_unsupported' : other ? 'identity_mismatch' : 'identity_absent',
  );
}
