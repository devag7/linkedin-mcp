/** Opt-in projection only. Never selects a job or exposes an input string. */
import type { NormalizedResponse } from './normalize.js';
import { isJobDetailCandidate, supportedJobId } from './job-detail-selection.js';

// Exact literals only; this is a disclosure vocabulary, NOT accepted job identity.
// jobPosting/fsd_jobPosting: existing strict identity contract.
// fsd_jobPostingCard: public implementation, pinned evidence in the protocol.
// fs_normalized_jobPosting: public parsers, pinned evidence; disclosure only.
export const JOB_IDENTIFIER_NAMESPACES = Object.freeze([
  'jobPosting',
  'fsd_jobPosting',
  'fsd_jobPostingCard',
  'fs_normalized_jobPosting',
] as const);
export const IDENTIFIER_DIAGNOSTIC_SCHEMA = 'job-identifier-structure/v2';
export const IDENTIFIER_DIAGNOSTIC_LIMITS = Object.freeze({
  candidates: 4,
  responseNodes: 10000,
  identifierCharacters: 2048,
  depth: 4,
  identifierNodes: 16,
  tupleItems: 4,
  reportBytes: 8192,
});
type Namespace = (typeof JOB_IDENTIFIER_NAMESPACES)[number] | 'unrecognized';
export type RedactedIdentifier =
  | { kind: 'missing' | 'non_string' | 'opaque' | 'invalid' | 'limited' | 'number_over_limit' }
  | { kind: 'number'; comparison: 'requested_id_equal' | 'requested_id_different' }
  | { kind: 'tuple'; items: RedactedIdentifier[] }
  | { kind: 'urn'; namespace: Namespace; payload: RedactedIdentifier };
export interface JobIdentifierObservation {
  schema: typeof IDENTIFIER_DIAGNOSTIC_SCHEMA;
  diagnosticComplete: boolean;
  supportedEntityBinding: 'none' | 'unique' | 'ambiguous' | 'incomplete';
  candidates: {
    origin: 'data' | 'included';
    entityUrn: RedactedIdentifier;
    jobPostingReference: RedactedIdentifier;
    relationship: 'equal' | 'different' | 'not_comparable';
  }[];
}

function identifier(value: unknown, requested: string) {
  let complete = true;
  let nodes = 0;
  const parse = (text: string, depth: number): RedactedIdentifier => {
    if (
      ++nodes > IDENTIFIER_DIAGNOSTIC_LIMITS.identifierNodes ||
      depth > IDENTIFIER_DIAGNOSTIC_LIMITS.depth
    )
      throw new Error('LIMIT');
    if (!text || /\s/.test(text)) throw new Error('INVALID');
    if (text.startsWith('urn:li:')) {
      const boundary = text.indexOf(':', 7);
      if (boundary < 0) throw new Error('INVALID');
      // Return the code-owned literal, never the provider's namespace substring.
      const namespace = JOB_IDENTIFIER_NAMESPACES.find(
        (label) => label === text.slice(7, boundary),
      );
      if (!namespace) complete = false;
      return {
        kind: 'urn',
        namespace: namespace ?? 'unrecognized',
        payload: parse(text.slice(boundary + 1), depth + 1),
      };
    }
    if (text.startsWith('urn:')) {
      complete = false;
      return { kind: 'opaque' };
    }
    if (text.startsWith('(')) {
      if (!text.endsWith(')')) throw new Error('INVALID');
      const body = text.slice(1, -1);
      let nesting = 0;
      let start = 0;
      const parts: string[] = [];
      for (let i = 0; i < body.length; i++) {
        const char = body[i];
        if (char === '(') nesting++;
        else if (char === ')' && --nesting < 0) throw new Error('INVALID');
        else if (char === ',' && nesting === 0) {
          parts.push(body.slice(start, i));
          start = i + 1;
        }
      }
      if (nesting) throw new Error('INVALID');
      parts.push(body.slice(start));
      if (parts.length > IDENTIFIER_DIAGNOSTIC_LIMITS.tupleItems) throw new Error('LIMIT');
      return { kind: 'tuple', items: parts.map((part) => parse(part, depth + 1)) };
    }
    if (/[(),]/.test(text)) throw new Error('INVALID');
    if (/^[0-9]+$/.test(text)) {
      if (text.length > 20) {
        complete = false;
        return { kind: 'number_over_limit' };
      }
      return {
        kind: 'number',
        comparison: text === requested ? 'requested_id_equal' : 'requested_id_different',
      };
    }
    return { kind: 'opaque' };
  };
  let shape: RedactedIdentifier;
  if (value === undefined || value === null || value === '') shape = { kind: 'missing' };
  else if (typeof value !== 'string') shape = { kind: 'non_string' };
  else if (value.length > IDENTIFIER_DIAGNOSTIC_LIMITS.identifierCharacters) {
    shape = { kind: 'limited' };
    complete = false;
  } else {
    try {
      shape = parse(value, 0);
    } catch (error) {
      complete = false;
      shape = { kind: error instanceof Error && error.message === 'LIMIT' ? 'limited' : 'invalid' };
    }
  }
  return { shape, complete };
}

export function summarizeJobIdentifierStructure(
  response: NormalizedResponse,
  requested: string,
): JobIdentifierObservation {
  if (/^[0-9]{1,20}$/.exec(requested)?.[0] !== requested) throw new Error('INVALID_REQUESTED_ID');
  const observation: JobIdentifierObservation = {
    schema: IDENTIFIER_DIAGNOSTIC_SCHEMA,
    diagnosticComplete: true,
    supportedEntityBinding: 'none',
    candidates: [],
  };
  const pending: { value: unknown; origin: 'data' | 'included' }[] = [
    { value: response.included, origin: 'included' },
    { value: response.data, origin: 'data' },
  ];
  const seen = new WeakSet<object>();
  let seenSize = 0;
  let matches = 0;
  while (pending.length) {
    const { value, origin } = pending.pop()!;
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    if (seenSize++ >= IDENTIFIER_DIAGNOSTIC_LIMITS.responseNodes) {
      observation.diagnosticComplete = false;
      break;
    }
    seen.add(value);
    if (isJobDetailCandidate(value)) {
      if (observation.candidates.length >= IDENTIFIER_DIAGNOSTIC_LIMITS.candidates) {
        observation.diagnosticComplete = false;
        break;
      }
      const entity = identifier(value.entityUrn, requested);
      const reference = identifier(value['*jobPosting'], requested);
      observation.diagnosticComplete &&= entity.complete && reference.complete;
      if (supportedJobId(value.entityUrn) === requested) matches++;
      const comparable =
        entity.complete &&
        reference.complete &&
        typeof value.entityUrn === 'string' &&
        typeof value['*jobPosting'] === 'string' &&
        value.entityUrn.startsWith('urn:li:') &&
        value['*jobPosting'].startsWith('urn:li:');
      observation.candidates.push({
        origin,
        entityUrn: entity.shape,
        jobPostingReference: reference.shape,
        relationship: comparable
          ? value.entityUrn === value['*jobPosting']
            ? 'equal'
            : 'different'
          : 'not_comparable',
      });
    }
    for (const child of Object.values(value).reverse()) {
      if (child && typeof child === 'object') pending.push({ value: child, origin });
      if (pending.length > IDENTIFIER_DIAGNOSTIC_LIMITS.responseNodes) {
        observation.diagnosticComplete = false;
        break;
      }
    }
    if (pending.length > IDENTIFIER_DIAGNOSTIC_LIMITS.responseNodes) break;
  }
  observation.supportedEntityBinding = !observation.diagnosticComplete
    ? 'incomplete'
    : matches > 1
      ? 'ambiguous'
      : matches === 1
        ? 'unique'
        : 'none';
  if (
    Buffer.byteLength(JSON.stringify(observation), 'utf8') >
    IDENTIFIER_DIAGNOSTIC_LIMITS.reportBytes
  )
    return {
      schema: IDENTIFIER_DIAGNOSTIC_SCHEMA,
      diagnosticComplete: false,
      supportedEntityBinding: 'incomplete',
      candidates: [],
    };
  return observation;
}
