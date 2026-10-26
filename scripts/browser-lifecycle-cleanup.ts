/** Offline lifecycle evidence only. Never kills a process or changes an ownership decision. */
import { verifyFinalCleanup, type CleanupState } from './validation-cleanup.js';
import { boundedValidationTeardown } from './search-only-validation-support.js';

export async function finalizeBrowserLifecycle(options: {
  dispose: () => Promise<void>;
  monitor?: { stop: () => void; readonly failed: boolean };
  probe: () => CleanupState;
  priorFailure: boolean;
}) {
  // Use the same teardown and observation bounds on both success and failure.
  const teardown = await boundedValidationTeardown(options.dispose);
  options.monitor?.stop();
  const processObservationFailed = options.monitor?.failed ?? false;
  const cleanup = await verifyFinalCleanup(options.probe, {
    teardownFailed: teardown.failed || processObservationFailed,
  });
  return {
    teardown,
    processObservationFailed,
    cleanup,
    // A clean later sample cannot erase the earlier lifecycle/monitor failure.
    verified: !options.priorFailure && !processObservationFailed && cleanup.verified,
  };
}
