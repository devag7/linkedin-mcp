import { describe, expect, it } from 'vitest';
import { buildReport, normalizeSeries } from '../scripts/github-traffic-ledger.mjs';

const day = (date: string, count: number, uniques: number) => ({
  timestamp: date + 'T00:00:00Z',
  count,
  uniques,
});

describe('private GitHub traffic ledger', () => {
  it('uses the latest observation for overlapping UTC days without summing unique people', () => {
    const ledger = {
      schemaVersion: 1,
      repository: 'devag7/linkedin-mcp',
      captures: [
        {
          capturedAt: '2026-10-18T12:00:00.000Z',
          stars: 10,
          views: { count: 5, uniques: 4, days: [day('2026-10-17', 3, 2), day('2026-10-18', 2, 2)] },
          clones: { count: 7, uniques: 5, days: [day('2026-10-17', 4, 3), day('2026-10-18', 3, 2)] },
        },
        {
          capturedAt: '2026-10-19T12:00:00.000Z',
          stars: 12,
          views: { count: 7, uniques: 5, days: [day('2026-10-18', 4, 3), day('2026-10-19', 3, 2)] },
          clones: { count: 8, uniques: 6, days: [day('2026-10-18', 5, 4), day('2026-10-19', 3, 2)] },
        },
      ],
    };
    const report = buildReport(ledger);
    expect(report.starChangeSinceFirstCapture).toBe(2);
    expect(report.latest14DayWindow).toEqual({
      views: 7,
      viewUniques: 5,
      clones: 8,
      cloneUniques: 6,
    });
    expect(report.months).toContainEqual({
      month: '2026-10',
      viewsObserved: 10, // October 17:3, latest October 18:4, October 19:3
      clonesObserved: 12, // October 17:4, latest October 18:5, October 19:3
      viewsCoverageDays: 3,
      clonesCoverageDays: 3,
      expectedDays: 19,
      complete: false,
    });
  });

  it('refuses duplicate or invalid daily records instead of treating them as zero', () => {
    expect(() => normalizeSeries({
      count: 2,
      uniques: 1,
      views: [day('2026-10-18', 1, 1), day('2026-10-18', 1, 1)],
    }, 'views')).toThrow(/duplicate/);
    expect(() => normalizeSeries({
      count: 0,
      uniques: 0,
      views: [day('2026-10-18', -1, 0)],
    }, 'views')).toThrow(/nonnegative/);
  });
});
