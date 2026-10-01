/** Continuations use only existing endpoint offsets. No guessed URLs or implicit crawling. */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ok, ToolError, type ToolMeta } from './result.js';
export const pageFields = {
  offset: z
    .number()
    .int()
    .min(0)
    .max(1000)
    .default(0)
    .describe('Explicit zero-based offset; maximum 1000. One provider page per call.'),
  cursor: z
    .string()
    .min(1)
    .max(512)
    .optional()
    .describe('Opaque nextCursor from the same tool, query and count. Do not combine with offset.'),
};
const cursorSchema = z
  .object({
    v: z.literal(1),
    key: z.string().regex(/^[a-f0-9]{64}$/),
    offset: z.number().int().min(1).max(1000),
  })
  .strict();
const keyFor = (tool: string, query: unknown, count: number) =>
  createHash('sha256')
    .update(JSON.stringify([tool, query, count]))
    .digest('hex');
export function pageStart(
  tool: string,
  query: unknown,
  count: number,
  offset: number,
  cursor?: string,
): number {
  if (!cursor) return offset;
  try {
    if (offset !== 0 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const decoded = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );
    if (decoded.key !== keyFor(tool, query, count)) throw new Error();
    return decoded.offset;
  } catch {
    throw new ToolError('INVALID_CURSOR');
  }
}
/** A missing total means completeness is unknown, even if fewer rows were returned. */
export function pageResult<T>(
  tool: string,
  query: unknown,
  count: number,
  offset: number,
  rows: T[],
  raw: unknown,
  source: ToolMeta['source'] = 'voyager',
) {
  const pagingSchema = z.object({
    data: z.object({
      paging: z.object({
        total: z.number().int().nonnegative(),
        start: z.number().int().nonnegative(),
        count: z.number().int().positive(),
      }),
    }),
  });
  const parsed = pagingSchema.safeParse(raw);
  const paging =
    parsed.success &&
    parsed.data.data.paging.start === offset &&
    parsed.data.data.paging.count === count
      ? parsed.data.data.paging
      : undefined;
  const truncated = rows.length > count;
  const more = paging && offset + count < paging.total;
  const nextCursor =
    more && offset + count <= 1000 && !truncated
      ? Buffer.from(
          JSON.stringify({ v: 1, key: keyFor(tool, query, count), offset: offset + count }),
        ).toString('base64url')
      : undefined;
  const continuation = nextCursor ? 'available' : paging && !more && !truncated ? 'end' : 'unknown';
  return ok(rows.slice(0, count), source, continuation !== 'end', {
    nextCursor,
    pagination: { offset, count, continuation },
  });
}
export function firstPage<T>(rows: T[], count: number, source: ToolMeta['source']) {
  return ok(rows.slice(0, count), source, true, {
    pagination: { offset: 0, count, continuation: 'unsupported' },
  });
}
