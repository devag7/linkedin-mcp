import { describe, expect, it } from 'vitest';
import { fixedWindowsStateCode, windowsStatePathAllowed, windowsVerifierEnvironment } from '../src/safety/windows-private-state.js';

describe('Windows private state placement', () => {
  const home = 'C:\\Users\\Example';

  it.each([
    ['C:\\Users\\Example\\.linkedin-mcp', true],
    ['c:\\users\\example\\Custom\\profile', true],
    ['C:\\Users\\Example', false],
    ['C:\\Users\\Example2\\profile', false],
    ['C:\\Users\\Example\\..\\Public\\profile', false],
    ['C:\\Users\\Public\\Documents\\profile', false],
    ['D:\\profile', false],
  ])('classifies %s as allowed=%s', (target, allowed) => {
    expect(windowsStatePathAllowed(target, home)).toBe(allowed);
  });
});

it('removes PowerShell 7 module paths only from the verifier child environment', () => {
  const parent = { Path: 'C:\\Windows', PSModulePath: 'ps7-modules', psmodulepath: 'other-ps7-modules' };
  expect(windowsVerifierEnvironment(parent, 'C:\\Users\\Example', 'C:\\Windows')).toEqual({
    Path: 'C:\\Windows', SystemRoot: 'C:\\Windows', USERPROFILE: 'C:\\Users\\Example',
  });
  expect(parent.PSModulePath).toBe('ps7-modules');
});

it('retains fixed refusal codes without retaining arbitrary error text', () => {
  expect(fixedWindowsStateCode(new Error('WINDOWS_STATE_PRIVACY_UNVERIFIED_REPARSE_POINT')))
    .toBe('WINDOWS_STATE_PRIVACY_UNVERIFIED_REPARSE_POINT');
  expect(fixedWindowsStateCode(new Error('secret C:\\Users\\Example\\profile'))).toBeUndefined();
});
