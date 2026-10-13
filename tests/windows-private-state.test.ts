import { describe, expect, it } from 'vitest';
import { windowsStatePathAllowed } from '../src/safety/windows-private-state.js';

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
