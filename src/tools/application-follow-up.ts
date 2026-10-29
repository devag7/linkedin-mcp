/** Pure, user-supplied timing classification. No clock, scheduler or storage. */
import { z } from 'zod';

const indices = z.array(z.number().int().min(0).max(49)).max(50);
export const followUpPlanSchema = z.object({
  referenceTime: z.string().datetime(),
  basis: z.literal('user_supplied_dates'),
  notificationsScheduled: z.literal(false),
  overdueRecordIndices: indices,
  dueNowRecordIndices: indices,
  upcomingRecordIndices: indices,
  unscheduledRecordIndices: indices,
  closedRecordIndices: indices,
});

// UTC inputs are schema-validated. Keep fractional precision beyond milliseconds
// rather than letting Date.parse silently turn a future instant into due-now.
function compareTimes(a: string, b: string): number {
  const seconds = (value: string) => Date.parse(value.replace(/\.\d+Z$/, 'Z'));
  const difference = seconds(a) - seconds(b);
  if (difference !== 0) return difference;
  const fraction = (value: string) => /\.(\d+)Z$/.exec(value)?.[1] ?? '';
  const left = fraction(a);
  const right = fraction(b);
  const width = Math.max(left.length, right.length);
  const paddedLeft = left.padEnd(width, '0');
  const paddedRight = right.padEnd(width, '0');
  return paddedLeft === paddedRight ? 0 : paddedLeft < paddedRight ? -1 : 1;
}

export function buildFollowUpPlan(
  records: ReadonlyArray<{ status: string; followUpAt: string | null }>,
  referenceTime: string,
): z.infer<typeof followUpPlanSchema> {
  const plan: z.infer<typeof followUpPlanSchema> = {
    referenceTime,
    basis: 'user_supplied_dates',
    notificationsScheduled: false,
    overdueRecordIndices: [],
    dueNowRecordIndices: [],
    upcomingRecordIndices: [],
    unscheduledRecordIndices: [],
    closedRecordIndices: [],
  };
  const ordered = records.map((record, index) => ({ ...record, index }));
  // Preserve input order on equal timestamps; never reorder the exported rows.
  ordered.sort((a, b) => {
    if (a.followUpAt === null) return b.followUpAt === null ? a.index - b.index : 1;
    if (b.followUpAt === null) return -1;
    return compareTimes(a.followUpAt, b.followUpAt) || a.index - b.index;
  });
  for (const record of ordered) {
    const { index, status, followUpAt } = record;
    if (status === 'rejected' || status === 'withdrawn') plan.closedRecordIndices.push(index);
    else if (followUpAt === null) plan.unscheduledRecordIndices.push(index);
    else {
      const comparison = compareTimes(followUpAt, referenceTime);
      if (comparison < 0) plan.overdueRecordIndices.push(index);
      else if (comparison === 0) plan.dueNowRecordIndices.push(index);
      else plan.upcomingRecordIndices.push(index);
    }
  }
  plan.unscheduledRecordIndices.sort((a, b) => a - b);
  plan.closedRecordIndices.sort((a, b) => a - b);
  return plan;
}
