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

/** The vocabulary of write outcomes surfaced to the MCP client. */
export type WriteStatus =
  | 'ok'
  | 'duplicate'
  | 'already_connected'
  | 'restricted'
  | 'quota_exhausted'
  | 'not_allowed'
  | 'failed';

export interface WriteOutcome {
  /** Structured status — the caller returns this, never a bare `sent:true`. */
  status: WriteStatus;
  /** True only for `status === 'ok'`. Convenience for callers. */
  ok: boolean;
  /** The HTTP status code of the write POST. */
  httpStatus: number;
  /** Best server-provided detail (message/code), when present. */
  detail?: string;
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
  duplicate: /already\s*invited|already\s*sent|cant_resend_yet|can.?t\s*resend|pending\s*invitation|duplicate|already\s*exists/i,
  connected: /already\s*connected|existing\s*connection|is\s*already\s*your\s*connection/i,
  quota: /weekly\s*invitation|invitation\s*limit|quota|reached\s*the\s*(weekly|maximum)|too\s*many\s*invitations|limit\s*reached/i,
  restricted: /restrict|blocked|not\s*permitted|unauthorized\s*action|account\s*.*flag|security\s*challenge|account.*challenge|challenge.*account|verification\s*challenge/i,
  notAllowed: /not\s*allowed|cannot\s*message|out\s*of\s*network|inmail|premium\s*required|connection\s*required/i,
};

/**
 * Classify a raw write POST result into a {@link WriteOutcome}.
 *
 * @param raw the non-throwing POST result (see VoyagerClient.voyagerPostRaw)
 * @param kind which write this was — lets us bias ambiguous codes (e.g. a 409
 *   on a connect is "already_connected", on a comment it is "duplicate").
 */
export function classifyWrite(
  raw: RawPostResult,
  kind: 'connect' | 'message' | 'post' | 'react' | 'comment',
): WriteOutcome {
  const detail = errorDetail(raw.json, raw.body);
  const hay = `${detail ?? ''} ${raw.body}`;

  // 2xx — usually success, but LinkedIn can 200 with an embedded error
  // (structured JSON OR plain text). Never return a blind `ok` without looking.
  if (raw.ok) {
    if (raw.json && typeof raw.json === 'object') {
      const o = raw.json as Record<string, unknown>;
      // An explicit error object inside a 200 body.
      if (o['exceptionClass'] || (typeof o['status'] === 'number' && (o['status'] as number) >= 400)) {
        return (
          mapByBody(hay, kind, raw.status, detail) ?? {
            status: 'failed',
            ok: false,
            httpStatus: raw.status,
            detail,
          }
        );
      }
      // A JSON success object — trust it (scanning it would false-positive on
      // success payloads that merely contain an error-ish word).
      return { status: 'ok', ok: true, httpStatus: raw.status };
    }
    // No JSON object: an empty body is success; a non-empty PLAIN-TEXT 200 body
    // is unusual and is far more likely an error (e.g. "account restricted").
    if (raw.body.trim()) {
      const byBody = mapByBody(hay, kind, raw.status, detail);
      if (byBody) return byBody;
    }
    return { status: 'ok', ok: true, httpStatus: raw.status };
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
  if (raw.status === 409) {
    return {
      status: kind === 'connect' ? 'already_connected' : 'duplicate',
      ok: false,
      httpStatus: 409,
      detail,
    };
  }

  // 400 / 422 / others — the body is the only reliable signal.
  return mapByBody(hay, kind, raw.status, detail) ?? { status: 'failed', ok: false, httpStatus: raw.status, detail };
}

/** Map a failure body to a status via known signal substrings. */
function mapByBody(
  hay: string,
  kind: 'connect' | 'message' | 'post' | 'react' | 'comment',
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
