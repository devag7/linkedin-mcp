/**
 * Write-result classifier.
 *
 * The single biggest correctness bug in the alpha write tools was returning
 * `{ sent: true }` straight from the POST without inspecting the response
 * (competitor #365/#448): a duplicate invite, a restricted account, or an
 * exhausted weekly-invite quota all looked like success. This module turns a
 * raw Voyager POST result into a structured, honest status the caller surfaces
 * verbatim.
 *
 * LinkedIn is inconsistent: some failures are a non-2xx HTTP status, some are a
 * 200 with an error object in the body, and the machine-readable `code` strings
 * rotate. So we classify defensively — HTTP status first, then a scan of the
 * body for known signal substrings — and always carry the server detail through
 * so a novel failure is still legible rather than silently "failed".
 */

import type { RawPostResult } from './voyager.js';

import {
  UNKNOWN_WRITE_DETAIL,
  type WriteKind,
  type WriteOutcome,
  type WriteStatus,
} from '../safety/write-operation.js';
export type { WriteOutcome, WriteStatus } from '../safety/write-operation.js';

/**
 * GraphQL mutations (create_post, …) return HTTP 200 with a nested
 * `errors:[{message,extensions:{exceptionClass,classification}}]` array on
 * failure (and a null result). Deep-walk for the first such non-empty errors
 * array and return its message — so a 200-with-errors is never read as success.
 */
function findGraphqlErrors(node: unknown, depth = 0): string | undefined {
  if (!node || typeof node !== 'object' || depth > 6) return undefined;
  if (Array.isArray(node)) {
    for (const v of node) {
      const r = findGraphqlErrors(v, depth + 1);
      if (r) return r;
    }
    return undefined;
  }
  const o = node as Record<string, unknown>;
  const errs = o['errors'];
  if (Array.isArray(errs) && errs.length > 0) {
    const first = errs[0] as Record<string, unknown> | undefined;
    if (first && typeof first === 'object') {
      if (typeof first['message'] === 'string' && first['message'])
        return first['message'] as string;
      const ext = first['extensions'] as Record<string, unknown> | undefined;
      if (ext && typeof ext === 'object') {
        for (const k of ['exceptionClass', 'code', 'classification'] as const) {
          if (typeof ext[k] === 'string' && ext[k]) return ext[k] as string;
        }
      }
      if (typeof first['classification'] === 'string' && first['classification'])
        return first['classification'] as string;
    }
    return 'GraphQL mutation returned errors';
  }
  for (const v of Object.values(o)) {
    const r = findGraphqlErrors(v, depth + 1);
    if (r) return r;
  }
  return undefined;
}

/** Pull a human-ish error detail (message or code) out of a Voyager error body. */
function errorDetail(json: unknown, body: string): string | undefined {
  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>;
    const msg = o['message'] ?? o['code'] ?? (o['data'] as Record<string, unknown>)?.['message'];
    if (typeof msg === 'string' && msg) return msg;
    const exc = o['exceptionClass'];
    if (typeof exc === 'string' && exc) return exc;
  }
  const trimmed = body.trim();
  if (trimmed && trimmed.length <= 300 && !trimmed.startsWith('<')) return trimmed;
  return undefined;
}

const RE = {
  duplicate:
    /already\s*invited|already\s*sent|cant_resend_yet|can.?t\s*resend|pending\s*invitation|duplicate|already\s*exists/i,
  connected: /already\s*connected|existing\s*connection|is\s*already\s*your\s*connection/i,
  quota:
    /weekly\s*invitation|invitation\s*limit|quota|reached\s*the\s*(weekly|maximum)|too\s*many\s*(?:invitations|requests)|rate[_\s-]*limit|limit\s*reached|\b429\b/i,
  restricted:
    /restrict|blocked|not\s*permitted|unauthorized\s*action|account\s*.*flag|security\s*challenge|account.*challenge|challenge.*account|verification\s*challenge/i,
  notAllowed:
    /not\s*allowed|cannot\s*(?:be\s*)?messag|out\s*of\s*network|inmail|premium\s*required|connection\s*required|not\s*a\s*connection|NOT_FIRST_DEGREE/i,
};

/**
 * Classify a raw write POST result into a {@link WriteOutcome}.
 *
 * @param raw the non-throwing POST result (see VoyagerClient.voyagerPostRaw)
 * @param kind which write this was — used to interpret explicit already-connected signals.
 */
export function classifyWrite(raw: RawPostResult, kind: WriteKind): WriteOutcome {
  const detail = errorDetail(raw.json, raw.body);
  const hay = `${detail ?? ''} ${raw.body}`;
  const unknown = (): WriteOutcome => ({
    status: 'unknown',
    ok: false,
    httpStatus: raw.status,
    detail: UNKNOWN_WRITE_DETAIL,
  });
  // A server error/timeout can arrive after the mutation committed.
  if (raw.status === 0 || raw.status === 408 || raw.status >= 500) return unknown();
  if (raw.bodyReadFailed && raw.ok) return unknown();

  // 2xx — usually success, but LinkedIn can 200 with an embedded error
  // (structured JSON OR plain text). Never return a blind `ok` without looking.
  if (raw.ok) {
    if (raw.json && typeof raw.json === 'object') {
      const o = raw.json as Record<string, unknown>;
      // A GraphQL mutation that 200'd but carries a nested errors[] array failed.
      const gqlErr = findGraphqlErrors(raw.json);
      if (gqlErr) {
        if (hasEntityResult(o)) return unknown();
        const hay2 = `${gqlErr} ${raw.body}`;
        return (
          mapByBody(hay2, kind, raw.status, gqlErr) ?? {
            status: 'failed',
            ok: false,
            httpStatus: raw.status,
            detail: gqlErr,
          }
        );
      }
      if (o['status'] === 408 || (typeof o['status'] === 'number' && o['status'] >= 500))
        return unknown();
      if (o['status'] === 429)
        return { status: 'quota_exhausted', ok: false, httpStatus: raw.status, detail };
      if (o['status'] === 403)
        return (
          mapByBody(hay, kind, raw.status, detail) ?? {
            status: 'restricted',
            ok: false,
            httpStatus: raw.status,
            detail,
          }
        );
      // An explicit error object inside a 200 body.
      if (
        o['exceptionClass'] ||
        (typeof o['status'] === 'number' && (o['status'] as number) >= 400)
      ) {
        return (
          mapByBody(hay, kind, raw.status, detail) ?? {
            status: 'failed',
            ok: false,
            httpStatus: raw.status,
            detail,
          }
        );
      }
      const semanticError = mapByBody(
        [o['code'], o['message'], (o['data'] as Record<string, unknown> | undefined)?.['message']]
          .filter((value): value is string => typeof value === 'string')
          .join(' '),
        kind,
        raw.status,
        detail,
      );
      if (semanticError) return hasEntityResult(o) ? unknown() : semanticError;
      if (o['error'] != null) return unknown();
      // Only recognize an entity result, not an arbitrary object/error envelope.
      // Do not scan successful content for error words (a post may contain them).
      return hasEntityResult(o) ? { status: 'ok', ok: true, httpStatus: raw.status } : unknown();
    }
    // Unrecognized plain text may be a semantic error or an uncertain response.
    if (raw.body.trim()) {
      const byBody = mapByBody(hay, kind, raw.status, detail);
      if (byBody) return byBody;
    }
    // Existing reaction fixtures allow empty 200/204. Other empty 2xx
    // responses lack a demonstrated success signal and need manual inspection.
    if (!raw.body.trim() && kind === 'react' && (raw.status === 200 || raw.status === 204)) {
      return { status: 'ok', ok: true, httpStatus: raw.status };
    }
    return unknown();
  }

  // Non-2xx: HTTP status gives the first signal, body refines it.
  if (raw.status === 429) {
    return { status: 'quota_exhausted', ok: false, httpStatus: 429, detail };
  }
  if (raw.status === 403) {
    // 403 on a write is a restriction far more often than a dead session.
    const byBody = mapByBody(hay, kind, 403, detail);
    return byBody ?? { status: 'restricted', ok: false, httpStatus: 403, detail };
  }
  // A bare conflict does not prove a previous invitation or connection.

  // 400 / 422 / others — the body is the only reliable signal.
  return (
    mapByBody(hay, kind, raw.status, detail) ?? {
      status: 'failed',
      ok: false,
      httpStatus: raw.status,
      detail,
    }
  );
}

/** Map a failure body to a status via known signal substrings. */
function mapByBody(
  hay: string,
  kind: WriteKind,
  httpStatus: number,
  detail?: string,
): WriteOutcome | undefined {
  const out = (status: WriteStatus): WriteOutcome => ({ status, ok: false, httpStatus, detail });
  if (RE.connected.test(hay) && kind === 'connect') return out('already_connected');
  if (RE.quota.test(hay)) return out('quota_exhausted');
  if (RE.duplicate.test(hay)) return out('duplicate');
  if (RE.notAllowed.test(hay)) return out('not_allowed');
  if (RE.restricted.test(hay)) return out('restricted');
  return undefined;
}

/** Recognize result positions already represented by fixtures, not echoed input. */
function hasEntityResult(node: Record<string, unknown>, depth = 0): boolean {
  if (depth > 6) return false;
  for (const key of ['value', 'entityUrn', 'result']) {
    const value = node[key];
    if (typeof value === 'string' && value.startsWith('urn:li:')) return true;
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      hasEntityResult(value as Record<string, unknown>, depth + 1)
    )
      return true;
  }
  // Normalized REST and GraphQL wrap the mutation result in data.
  const data = node['data'];
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (hasEntityResult(data as Record<string, unknown>, depth + 1)) return true;
    for (const [key, value] of Object.entries(data)) {
      if (
        key.startsWith('create') &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        hasEntityResult(value as Record<string, unknown>, depth + 1)
      )
        return true;
    }
  }
  return false;
}
