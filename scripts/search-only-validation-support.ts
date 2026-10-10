/** Local run guards and observation only; no provider requests or process termination. */
import type { VoyagerClient } from '../src/browser/voyager.js';
import { PROCESS_ACCOUNTING_KEYS, type ProcessAccountingCounts } from './validation-processes.js';

export function installSearchOnlyRequestGuard(
  prototype: typeof VoyagerClient.prototype,
  identityPath: string,
  searchPath: string,
) {
  const originals = {
    voyagerGet: prototype.voyagerGet,
    voyagerGraphql: prototype.voyagerGraphql,
    voyagerPost: prototype.voyagerPost,
    voyagerPostRaw: prototype.voyagerPostRaw,
    voyagerDeleteRaw: prototype.voyagerDeleteRaw,
  };
  let attempts = 0;
  let violations = 0;
  let stopped = false;
  const seen = new Set<string>();
  prototype.voyagerGet = async function <T>(path: string): Promise<T> {
    if (stopped || attempts >= 2 || ![identityPath, searchPath].includes(path) || seen.has(path)) {
      violations++;
      throw new Error('SEARCH_ONLY_SCOPE_STOP');
    }
    seen.add(path);
    attempts++;
    return originals.voyagerGet.call(this, path) as Promise<T>;
  };
  const forbidden = async () => {
    violations++;
    throw new Error('SEARCH_ONLY_SCOPE_STOP');
  };
  prototype.voyagerGraphql = forbidden;
  prototype.voyagerPost = forbidden;
  prototype.voyagerPostRaw = forbidden;
  prototype.voyagerDeleteRaw = forbidden;
  return {
    get attempts() {
      return attempts;
    },
    get violations() {
      return violations;
    },
    stop: () => {
      stopped = true;
    },
    restore: () => {
      Object.assign(prototype, originals);
    },
  };
}

/** Synchronous bounded inventory; every failed observation stays failed. */
export function monitorValidationProcesses<
  T extends {
    remainingProcesses: number;
    processAccounting?: ProcessAccountingCounts;
  },
>(probe: () => T, stopRead: () => void) {
  let failed = false;
  let checks = 0;
  const sample = () => {
    checks++;
    try {
      const state = probe();
      if (!Number.isSafeInteger(state.remainingProcesses) || state.remainingProcesses < 0)
        throw new Error('PROCESS_ACCOUNTING_INVALID');
      if (state.processAccounting !== undefined) {
        for (const key of PROCESS_ACCOUNTING_KEYS)
          if (
            !Number.isSafeInteger(state.processAccounting[key]) ||
            state.processAccounting[key] < 0
          )
            throw new Error('PROCESS_ACCOUNTING_INVALID');
        if (state.processAccounting.unclassifiedProfileReferences !== 0)
          throw new Error('PROCESS_OWNERSHIP_UNCERTAIN');
      }
      return state;
    } catch {
      failed = true;
      stopRead();
      throw new Error('PROCESS_OBSERVATION_FAILED');
    }
  };
  const timer = setInterval(() => {
    try {
      sample();
    } catch {
      /* Failure is latched; raw inventory/error is never logged. */
    }
  }, 500);
  return {
    sample,
    get failed() {
      return failed;
    },
    get checks() {
      return checks;
    },
    stop: () => clearInterval(timer),
  };
}

/** Does not kill or retry; timeout is permanent even if work resolves later. */
export async function boundedValidationTeardown(work: () => Promise<void>, maximumMs = 30000) {
  if (!Number.isInteger(maximumMs) || maximumMs < 1 || maximumMs > 30000)
    throw new Error('INVALID_TEARDOWN_BOUND');
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      Promise.resolve()
        .then(work)
        .then(
          () => ({ failed: false, timedOut: false }),
          () => ({ failed: true, timedOut: false }),
        ),
      new Promise<{ failed: boolean; timedOut: boolean }>((resolve) => {
        timer = setTimeout(() => resolve({ failed: true, timedOut: true }), maximumMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Shared runner sequence: dispose immediately, then session/client/server closure under one bound. */
export async function teardownValidationSession(
  operations: {
    dispose: () => Promise<void>;
    closeSession: () => Promise<boolean>;
    closeClient: () => Promise<void>;
    closeServer: () => Promise<void>;
  },
  maximumMs = 30000,
) {
  let closeSession = false;
  // Invoke before awaiting anything; production dispose marks the engine stopped synchronously.
  let disposal: Promise<boolean>;
  try {
    disposal = operations.dispose().then(
      () => true,
      () => false,
    );
  } catch {
    disposal = Promise.resolve(false);
  }
  const teardown = await boundedValidationTeardown(async () => {
    try {
      closeSession = await operations.closeSession();
    } catch {
      closeSession = false;
    }
    const outcomes = await Promise.allSettled([
      Promise.resolve().then(operations.closeClient),
      Promise.resolve().then(operations.closeServer),
      disposal,
    ]);
    if (
      !closeSession ||
      outcomes.some((outcome) => outcome.status === 'rejected') ||
      !(await disposal)
    )
      throw new Error('TEARDOWN_FAILED');
  }, maximumMs);
  // Snapshot flags; late resolution cannot change the returned failure evidence.
  return { ...teardown, closeSession };
}
