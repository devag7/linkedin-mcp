import { describe, expect, it } from 'vitest';
import { WritePreviews } from '../src/safety/write-preview.js';

describe('server-issued preview authority', () => {
  it('requires an issued opaque proof and binds operation and payload independently', () => {
    const authority = new WritePreviews();
    const first = authority.issue('operation', 'exact-action-target-content');
    const second = authority.issue('operation', 'exact-action-target-content');
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    for (const token of [undefined, 'forged', 'x'.repeat(43)])
      expect(() => authority.assert(token, 'operation', 'exact-action-target-content')).toThrow(
        'PREVIEW_REQUIRED',
      );
    expect(() => authority.assert(first.token, 'other', 'exact-action-target-content')).toThrow(
      'PREVIEW_CHANGED',
    );
    expect(() => authority.assert(first.token, 'operation', 'changed-content')).toThrow(
      'PREVIEW_CHANGED',
    );
    expect(() =>
      authority.assert(first.token, 'operation', 'exact-action-target-content'),
    ).not.toThrow();
  });
  it('expires at the boundary and forgets consumed or previous-process proofs', () => {
    let now = 0;
    const authority = new WritePreviews(() => now, 10);
    const proof = authority.issue('id', 'hash');
    now = 9;
    authority.assert(proof.token, 'id', 'hash');
    now = 10;
    expect(() => authority.assert(proof.token, 'id', 'hash')).toThrow('PREVIEW_EXPIRED');
    const next = authority.issue('id', 'hash');
    authority.consume(next.token);
    expect(() => authority.assert(next.token, 'id', 'hash')).toThrow('PREVIEW_REQUIRED');
    expect(() => new WritePreviews().assert(proof.token, 'id', 'hash')).toThrow('PREVIEW_REQUIRED');
  });
  it('bounds outstanding tokens without evicting valid approvals', () => {
    let now = 0;
    const authority = new WritePreviews(() => now, 10, 1);
    const first = authority.issue('id', 'hash');
    expect(() => authority.issue('other', 'hash')).toThrow('PREVIEW_LIMIT');
    authority.assert(first.token, 'id', 'hash');
    now = 10;
    expect(() => authority.issue('other', 'hash')).not.toThrow();
  });
});
