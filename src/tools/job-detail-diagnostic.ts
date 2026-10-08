/** Opt-in, per-server stage counts. Never observes payloads, identifiers or messages. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JOB_DETAIL_STRUCTURE_CHECKS } from '../browser/job-detail-selection.js';

export const JOB_DETAIL_CHECKS = [
  'envelope_accepted',
  'envelope_shape_rejected',
  'envelope_provider_error',
  'envelope_unclassified_error',
  'title_present',
  'title_missing',
  'identity_match',
  'identity_absent',
  'identity_unsupported',
  'identity_mismatch',
  'identity_ambiguous',
  'selection_traversal_limit',
  'output_accepted',
  'output_shape_rejected',
  'output_null_data',
  'composition_envelope_rejected',
  ...JOB_DETAIL_STRUCTURE_CHECKS,
] as const;
export type JobDetailCheck = (typeof JOB_DETAIL_CHECKS)[number];
type Observer = (check: JobDetailCheck) => void;
const observers = new WeakMap<McpServer, Observer>();

export function observeJobDetailChecks(server: McpServer, observer: Observer): () => void {
  if (observers.has(server)) throw new Error('JOB_DETAIL_OBSERVER_ALREADY_ATTACHED');
  observers.set(server, observer);
  return () => {
    if (observers.get(server) === observer) observers.delete(server);
  };
}

export function recordJobDetailCheck(server: McpServer, check: JobDetailCheck): void {
  if (!JOB_DETAIL_CHECKS.includes(check)) return;
  try {
    observers.get(server)?.(check);
  } catch {
    // An observer must never turn a rejected response into success or change a read.
  }
}
