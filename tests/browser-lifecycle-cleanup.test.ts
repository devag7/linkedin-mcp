import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { finalizeBrowserLifecycle } from '../scripts/browser-lifecycle-cleanup.js';
import { monitorValidationProcesses } from '../scripts/search-only-validation-support.js';
import { offlineLifecycleFailureCode } from '../scripts/validation-windows-processes.js';

beforeEach(() => {
  vi.useFakeTimers();
  // Drive the verifier's monotonic clock and timers together; no wall-time tolerance.
  vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const clean = () => ({
  remainingProcesses: 0,
  ownershipReleased: true,
  contextInactive: true,
});

it('records both cleanup observations after a held monitor fails, without erasing its failure', async () => {
  const stopRead = vi.fn();
  const monitor = monitorValidationProcesses(() => {
    throw new Error('PRIVATE_PROCESS_COMMAND_PATH');
  }, stopRead);
  expect(() => monitor.sample()).toThrow('PROCESS_OBSERVATION_FAILED');
  expect(monitor.failed).toBe(true);
  expect(stopRead).toHaveBeenCalledOnce();
  const dispose = vi.fn(async () => {});
  let observations = 0;
  const pending = finalizeBrowserLifecycle({
    dispose,
    monitor,
    priorFailure: true,
    probe: () => ({ ...clean(), remainingProcesses: ++observations === 1 ? 2 : 0 }),
  });
  await vi.advanceTimersByTimeAsync(100);
  const result = await pending;
  expect(dispose).toHaveBeenCalledOnce();
  expect(result.teardown).toEqual({ failed: false, timedOut: false });
  expect(result.cleanup.immediate.remainingProcesses).toBe(2);
  expect(result.cleanup.final.remainingProcesses).toBe(0);
  expect(result.cleanup.checks).toBe(2);
  expect(result.processObservationFailed).toBe(true);
  expect(result.cleanup.verified).toBe(false);
  expect(result.verified).toBe(false);
  expect(offlineLifecycleFailureCode(new Error('PROCESS_OBSERVATION_FAILED'))).toBe(
    'PROCESS_OBSERVATION_FAILED',
  );
  expect(JSON.stringify(result)).not.toContain('PRIVATE_PROCESS_COMMAND_PATH');
  // Monitoring must have stopped; later timer ticks cannot add probes or errors.
  const checks = monitor.checks;
  await vi.advanceTimersByTimeAsync(1000);
  expect(monitor.checks).toBe(checks);
});

it('keeps an earlier non-monitor lifecycle failure even when disposal and both observations pass', async () => {
  const pending = finalizeBrowserLifecycle({
    dispose: async () => {},
    probe: clean,
    priorFailure: true,
  });
  await vi.advanceTimersByTimeAsync(100);
  const result = await pending;
  expect(result.cleanup.verified).toBe(true);
  expect(result.verified).toBe(false);
  expect(result.cleanup.checks).toBe(2);
});

it('allows an ordinary known delayed exit under the unchanged cleanup bound', async () => {
  let observations = 0;
  const pending = finalizeBrowserLifecycle({
    dispose: async () => {},
    priorFailure: false,
    probe: () => ({ ...clean(), remainingProcesses: ++observations === 1 ? 1 : 0 }),
  });
  await vi.advanceTimersByTimeAsync(100);
  const result = await pending;
  expect(result.verified).toBe(true);
  expect(result.cleanup.maximumWaitMs).toBe(5000);
  expect(result.cleanup.immediate.remainingProcesses).toBe(1);
  expect(result.cleanup.final.remainingProcesses).toBe(0);
});

it('records final observations after a disposal exception and retains failure', async () => {
  const pending = finalizeBrowserLifecycle({
    dispose: async () => {
      throw new Error('PRIVATE_TEARDOWN');
    },
    probe: clean,
    priorFailure: false,
  });
  await vi.advanceTimersByTimeAsync(100);
  const result = await pending;
  expect(result.teardown).toEqual({ failed: true, timedOut: false });
  expect(result.cleanup.checks).toBe(2);
  expect(result.verified).toBe(false);
  expect(JSON.stringify(result)).not.toContain('PRIVATE_TEARDOWN');
});

it('preserves the thirty-second teardown ceiling and still observes after timeout', async () => {
  const pending = finalizeBrowserLifecycle({
    dispose: () => new Promise<void>(() => {}),
    probe: clean,
    priorFailure: false,
  });
  await vi.advanceTimersByTimeAsync(30100);
  const result = await pending;
  expect(result.teardown).toEqual({ failed: true, timedOut: true });
  expect(result.cleanup.checks).toBe(2);
  expect(result.verified).toBe(false);
});

it('retains a failed immediate cleanup probe even if the final observation is clean', async () => {
  let observations = 0;
  const pending = finalizeBrowserLifecycle({
    dispose: async () => {},
    priorFailure: false,
    probe: () => {
      if (++observations === 1) throw new Error('PRIVATE_INVENTORY');
      return clean();
    },
  });
  await vi.advanceTimersByTimeAsync(100);
  const result = await pending;
  expect(result.cleanup.immediate.remainingProcesses).toBe(null);
  expect(result.cleanup.final.remainingProcesses).toBe(0);
  expect(result.verified).toBe(false);
  expect(JSON.stringify(result)).not.toContain('PRIVATE_INVENTORY');
});

it('fails persistent survivors at the original five-second polling bound', async () => {
  const pending = finalizeBrowserLifecycle({
    dispose: async () => {},
    priorFailure: false,
    probe: () => ({ ...clean(), remainingProcesses: 2 }),
  });
  await vi.advanceTimersByTimeAsync(5000);
  const result = await pending;
  expect(result.cleanup.elapsedMs).toBe(5000);
  expect(result.cleanup.maximumWaitMs).toBe(5000);
  expect(result.cleanup.immediate.remainingProcesses).toBe(2);
  expect(result.cleanup.final.remainingProcesses).toBe(2);
  expect(result.verified).toBe(false);
});
