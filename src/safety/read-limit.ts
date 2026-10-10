/** Request-local ceiling for explicit Voyager reads, including identity preflight. */
import { AsyncLocalStorage } from 'node:async_hooks';
export interface ReadLimit {
  maximum: number;
  attempts: number;
}
export const readLimit = new AsyncLocalStorage<ReadLimit | undefined>();
export class ReadLimitError extends Error {
  readonly code = 'READ_LIMIT_REACHED';
  constructor() {
    super('Explicit read attempt limit reached. No further read was started.');
  }
}
export function reserveReadAttempt(): void {
  const state = readLimit.getStore();
  if (!state) return;
  if (state.attempts >= state.maximum) throw new ReadLimitError();
  state.attempts++;
}
