/** Opt-in per-server counts/redacted trees. Observers never receive raw identifiers or payloads. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JOB_DETAIL_STRUCTURE_CHECKS } from '../browser/job-detail-selection.js';
import {
  summarizeJobIdentifierStructure,
  type JobIdentifierObservation,
} from '../browser/job-identifier-diagnostic.js';
import type { NormalizedResponse } from '../browser/normalize.js';

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
  'identifier_diagnostic_complete',
  'identifier_diagnostic_incomplete',
  'identifier_observer_failed',
  ...JOB_DETAIL_STRUCTURE_CHECKS,
] as const;
export type JobDetailCheck = (typeof JOB_DETAIL_CHECKS)[number];
type Observer = (check: JobDetailCheck) => void;
const observers = new WeakMap<McpServer, Observer>();
const identifierObservers = new WeakMap<McpServer, (report: JobIdentifierObservation) => void>();

export function observeJobIdentifiers(
  server: McpServer,
  observer: (report: JobIdentifierObservation) => void,
): () => void {
  if (identifierObservers.has(server)) throw new Error('JOB_IDENTIFIER_OBSERVER_ALREADY_ATTACHED');
  identifierObservers.set(server, observer);
  return () => {
    if (identifierObservers.get(server) === observer) identifierObservers.delete(server);
  };
}

export function recordJobIdentifiers(
  server: McpServer,
  raw: NormalizedResponse,
  requestedId: string,
): void {
  const observer = identifierObservers.get(server);
  if (!observer) return; // No extra projection in ordinary tool/client flows.
  try {
    const report = summarizeJobIdentifierStructure(raw, requestedId);
    recordJobDetailCheck(
      server,
      report.diagnosticComplete
        ? 'identifier_diagnostic_complete'
        : 'identifier_diagnostic_incomplete',
    );
    observer(report); // Fresh value-free graph; no raw object or requested ID crosses this boundary.
  } catch {
    recordJobDetailCheck(server, 'identifier_observer_failed');
  }
}

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
