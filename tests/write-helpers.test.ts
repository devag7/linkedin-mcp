import { describe, it, expect } from 'vitest';
import { threadIdFrom } from '../src/tools/write.js';

describe('threadIdFrom', () => {
  it('extracts the thread id tail from a full conversation urn', () => {
    expect(
      threadIdFrom('urn:li:msg_conversation:(urn:li:fsd_profile:ACoAAabc,2-Njk5OWE==)'),
    ).toBe('2-Njk5OWE==');
  });

  it('keeps base64 chars (+ and /) intact in the thread id', () => {
    expect(threadIdFrom('urn:li:msg_conversation:(urn:li:fsd_profile:X,2-6UU6ZA3xz/gplV+vWXS7cQ==)')).toBe(
      '2-6UU6ZA3xz/gplV+vWXS7cQ==',
    );
  });

  it('returns a raw thread id unchanged', () => {
    expect(threadIdFrom('2-abcDEF123==')).toBe('2-abcDEF123==');
  });

  it('takes the LAST 2- segment (the thread id), not a participant', () => {
    // Contrived: a participant-ish 2- token earlier, real thread id last.
    expect(threadIdFrom('(2-decoy,2-real==)')).toBe('2-real==');
  });

  it('falls back to the input when there is no thread id', () => {
    expect(threadIdFrom('nonsense')).toBe('nonsense');
  });

  it('normalizes a full conversation urn ending in )', () => {
    expect(threadIdFrom('urn:li:msg_conversation:(urn:li:fsd_profile:ACoAAX,2-Zm9v==)')).toBe('2-Zm9v==');
  });
});
