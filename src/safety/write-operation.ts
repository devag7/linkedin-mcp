/** Content-free write journal contract shared by policy and browser layers. */
export type WriteStatus =
  | 'ok'
  | 'duplicate'
  | 'already_connected'
  | 'restricted'
  | 'quota_exhausted'
  | 'not_allowed'
  | 'failed'
  | 'unknown';

export interface WriteOutcome {
  status: WriteStatus;
  ok: boolean;
  /** Zero means no usable HTTP status reached the transaction. */
  httpStatus: number;
  detail?: string;
}

export type WriteKind = 'connect' | 'message' | 'post' | 'react' | 'comment';
export type OperationOutcome = WriteOutcome & { operationId: string; replayed: boolean };
export const UNKNOWN_WRITE_DETAIL =
  'The request may have reached LinkedIn. Inspect the target manually before considering another operation. This operation ID will not submit again.';
