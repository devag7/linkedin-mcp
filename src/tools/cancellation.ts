import { AsyncLocalStorage } from 'node:async_hooks';
import { ToolError } from './result.js';
export const requestCancellation = new AsyncLocalStorage<AbortSignal | undefined>();
/** Queue schedulers may run a stored callback from another request's async context. */
export function bindCancellation<T>(fn: () => Promise<T>): () => Promise<T> {
  const signal = requestCancellation.getStore();
  return () => requestCancellation.run(signal, fn);
}
/** Cancel before dispatch; cancellation after a write dispatch retains journal unknown semantics. */
export function assertNotCancelled() {
  if (requestCancellation.getStore()?.aborted) throw new ToolError('CANCELLED');
}
