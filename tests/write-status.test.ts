import { describe, it, expect } from 'vitest';
import { classifyWrite } from '../src/browser/write-status.js';
import type { RawPostResult } from '../src/browser/voyager.js';

function raw(status: number, body = '', json?: unknown): RawPostResult {
  return { status, ok: status >= 200 && status < 300, body, json: json ?? safe(body) };
}
function safe(body: string): unknown {
  try {
    return body ? JSON.parse(body) : undefined;
  } catch {
    return undefined;
  }
}

describe('classifyWrite — success', () => {
  it('treats a clean 2xx as ok', () => {
    const o = classifyWrite(raw(201, '{"value":"urn:li:fsd_invitation:123"}'), 'connect');
    expect(o.status).toBe('ok');
    expect(o.ok).toBe(true);
    expect(o.httpStatus).toBe(201);
  });

  it('treats an empty 200/204 as ok', () => {
    expect(classifyWrite(raw(200, ''), 'react').status).toBe('ok');
    expect(classifyWrite(raw(204, ''), 'react').status).toBe('ok');
  });

  it('catches an error object embedded in a 200 body (no false-positive success)', () => {
    const body = '{"status":429,"message":"You have reached the weekly invitation limit"}';
    const o = classifyWrite(raw(200, body), 'connect');
    expect(o.ok).toBe(false);
    expect(o.status).toBe('quota_exhausted');
  });

  it('catches a PLAIN-TEXT error in a 200 body with no JSON (the critical gap)', () => {
    // status 200, unparseable JSON, plain-text error → must NOT be ok.
    const o = classifyWrite(raw(200, 'You cannot invite this person (account restricted)'), 'connect');
    expect(o.ok).toBe(false);
    expect(o.status).toBe('restricted');
  });

  it('still treats a JSON success object as ok even if it contains an entity urn', () => {
    const o = classifyWrite(raw(200, '{"value":"urn:li:fsd_invitation:abc"}'), 'connect');
    expect(o.status).toBe('ok');
  });
});

describe('classifyWrite — HTTP-status driven', () => {
  it('maps 429 to quota_exhausted', () => {
    expect(classifyWrite(raw(429, ''), 'connect').status).toBe('quota_exhausted');
  });

  it('maps a bare 403 to restricted', () => {
    const o = classifyWrite(raw(403, ''), 'post');
    expect(o.status).toBe('restricted');
    expect(o.ok).toBe(false);
  });

  it('maps 409 on a connect to already_connected, on a comment to duplicate', () => {
    expect(classifyWrite(raw(409, ''), 'connect').status).toBe('already_connected');
    expect(classifyWrite(raw(409, ''), 'comment').status).toBe('duplicate');
  });
});

describe('classifyWrite — body-signal driven', () => {
  it('detects a duplicate invite from the body code', () => {
    const body = '{"code":"CANT_RESEND_YET","message":"You cannot resend this invitation yet"}';
    expect(classifyWrite(raw(400, body), 'connect').status).toBe('duplicate');
  });

  it('detects already-connected from a 400 body', () => {
    const body = '{"message":"This member is already connected to you"}';
    expect(classifyWrite(raw(400, body), 'connect').status).toBe('already_connected');
  });

  it('detects the weekly invitation quota from a 400 body', () => {
    const body = '{"message":"You\'ve reached the weekly invitation limit"}';
    expect(classifyWrite(raw(400, body), 'connect').status).toBe('quota_exhausted');
  });

  it('detects a messaging out-of-network restriction', () => {
    const body = '{"message":"You cannot message this member — a connection is required"}';
    expect(classifyWrite(raw(403, body), 'message').status).toBe('not_allowed');
  });

  it('falls back to failed with detail for an unrecognized 400', () => {
    const body = '{"message":"Some novel server error"}';
    const o = classifyWrite(raw(400, body), 'post');
    expect(o.status).toBe('failed');
    expect(o.detail).toContain('novel server error');
  });
});
