import { ToolError } from './result.js';
import type { NormalizedResponse } from '../browser/normalize.js';
/** Reject provider errors/malformed envelopes before a permissive shaper can manufacture emptiness. */
export function assertReadResponse(raw: unknown): asserts raw is NormalizedResponse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new ToolError('RESPONSE_SHAPE_CHANGED');
  const record = raw as Record<string, unknown>;
  const pending: unknown[] = [raw];
  let inspected = 0;
  while (pending.length && inspected++ < 10000) {
    const value = pending.pop();
    if (!value || typeof value !== 'object') continue;
    const node = value as Record<string, unknown>;
    if (Array.isArray(node.errors) && node.errors.length) throw new ToolError('PROVIDER_ERROR');
    if (node.error && typeof node.error === 'object') throw new ToolError('PROVIDER_ERROR');
    pending.push(...Object.values(node).filter((v) => v && typeof v === 'object'));
  }
  if (pending.length) throw new ToolError('RESPONSE_SHAPE_CHANGED');
  if (
    record.included !== undefined &&
    (!Array.isArray(record.included) ||
      record.included.some((e) => !e || typeof e !== 'object' || Array.isArray(e)))
  )
    throw new ToolError('RESPONSE_SHAPE_CHANGED');
  if (
    record.data !== undefined &&
    (!record.data || typeof record.data !== 'object' || Array.isArray(record.data))
  )
    throw new ToolError('RESPONSE_SHAPE_CHANGED');
  if (!Array.isArray(record.included) && (!record.data || Object.keys(record.data).length === 0))
    throw new ToolError('RESPONSE_SHAPE_CHANGED');
}
export function readRows<T>(raw: NormalizedResponse, rows: T[]): T[] {
  assertReadResponse(raw);
  // Empty included is an explicit synthetic/normalized empty envelope. Unknown
  // entity types in a nonempty response require review rather than a false [].
  if (
    !rows.length &&
    ((Array.isArray(raw.data?.elements) && raw.data.elements.length > 0) ||
      (raw.included?.length &&
        !(Array.isArray(raw.data?.elements) && raw.data.elements.length === 0)))
  )
    throw new ToolError('RESPONSE_SHAPE_CHANGED');
  return rows;
}
