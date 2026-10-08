/** Local verification only: poll counts/ownership, never kill, relaunch or access a provider. */
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { PROCESS_ACCOUNTING_KEYS, type ProcessAccountingCounts } from './validation-processes.js';

export interface CleanupState {
  remainingProcesses: number;
  ownershipReleased: boolean;
  contextInactive: boolean;
  processAccounting?: ProcessAccountingCounts;
}
export async function verifyFinalCleanup(
  probe: () => CleanupState,
  options: {
    maximumMs?: number;
    intervalMs?: number;
    teardownFailed?: boolean;
    now?: () => number;
    wait?: (milliseconds: number) => Promise<void>;
  } = {},
) {
  const maximumMs = options.maximumMs ?? 5000;
  const intervalMs = options.intervalMs ?? 100;
  if (
    !Number.isInteger(maximumMs) ||
    maximumMs < 0 ||
    maximumMs > 5000 ||
    !Number.isInteger(intervalMs) ||
    intervalMs < 1 ||
    intervalMs > 5000
  )
    throw new Error('INVALID_CLEANUP_BOUND');
  const now = options.now ?? (() => performance.now());
  const wait = options.wait ?? delay;
  const started = now();
  let checks = 0;
  let probeFailed = false;
  const sample = () => {
    checks++;
    try {
      const state = probe();
      if (
        !Number.isInteger(state.remainingProcesses) ||
        state.remainingProcesses < 0 ||
        typeof state.ownershipReleased !== 'boolean' ||
        typeof state.contextInactive !== 'boolean'
      )
        throw new Error('INVALID_CLEANUP_STATE');
      let accounting: ProcessAccountingCounts | undefined;
      if (state.processAccounting !== undefined) {
        accounting = Object.fromEntries(
          PROCESS_ACCOUNTING_KEYS.map((key) => {
            const count = state.processAccounting![key];
            if (!Number.isSafeInteger(count) || count < 0)
              throw new Error('INVALID_PROCESS_ACCOUNTING');
            return [key, count];
          }),
        ) as ProcessAccountingCounts;
      }
      return {
        ...(accounting ? { processAccounting: accounting } : {}),
        remainingProcesses: state.remainingProcesses,
        ownershipReleased: state.ownershipReleased,
        contextInactive: state.contextInactive,
        probeFailed: false,
        checkedAfterMs: Math.round(now() - started),
      };
    } catch {
      probeFailed = true;
      return {
        processAccounting: undefined,
        remainingProcesses: null,
        ownershipReleased: null,
        contextInactive: null,
        probeFailed: true,
        checkedAfterMs: Math.round(now() - started),
      };
    }
  };
  const clean = (state: ReturnType<typeof sample>) =>
    !state.probeFailed &&
    (state.processAccounting?.unclassifiedProfileReferences ?? 0) === 0 &&
    state.remainingProcesses === 0 &&
    state.ownershipReleased === true &&
    state.contextInactive === true;
  const immediate = sample();
  // Always take a separate final sample, even if immediate teardown looked clean.
  let final;
  do {
    const remaining = maximumMs - (now() - started);
    if (remaining > 0) await wait(Math.min(intervalMs, remaining));
    final = sample();
  } while (!probeFailed && !clean(final) && now() - started < maximumMs);
  return {
    maximumWaitMs: maximumMs,
    checks,
    elapsedMs: Math.round(now() - started),
    immediate,
    final,
    teardownFailed: options.teardownFailed ?? false,
    verified: !options.teardownFailed && !probeFailed && clean(final),
  };
}
