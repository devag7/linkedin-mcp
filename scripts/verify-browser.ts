/** Real Chrome/engine lifecycle proof using an empty, temporary profile and no LinkedIn URL. */
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finalizeBrowserLifecycle } from './browser-lifecycle-cleanup.js';
import { monitorValidationProcesses } from './search-only-validation-support.js';
import { readValidationProcesses, ValidationProcessTracker } from './validation-processes.js';
import {
  readWindowsValidationProcesses,
  WindowsValidationProcessTracker,
  offlineLifecycleFailureCode,
} from './validation-windows-processes.js';
import { BrowserEngine } from '../src/browser/engine.js';
import { loadConfig } from '../src/config/env.js';
import { Logger } from '../src/types.js';

const directory = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-browser-proof-')));
const profile = join(directory, 'profile');
const config = {
  ...loadConfig(),
  LINKEDIN_PROFILE_DIR: profile,
  LINKEDIN_HEADLESS: process.env.VERIFY_BROWSER_HEADED !== 'true',
  LINKEDIN_IDLE_TIMEOUT_MS: 0,
  LINKEDIN_ENABLE_WRITES: false,
  LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: false,
};
const engine = new BrowserEngine(config, new Logger('error'), false);
let cleanupVerified = false;
let contextClosed = false;
let chromeVersion: string | undefined;
let observedProcesses: number | undefined;
let failure: { stage: string; code: string } | undefined;
const tracker = new ValidationProcessTracker(profile);
const windowsTracker = new WindowsValidationProcessTracker(profile);
const processProbeDeadlineMs = process.platform === 'win32' ? 5000 : 1000;
let processProbeFailure: string | undefined;
function observeProcesses(phase: 'preflight' | 'runtime' = 'runtime') {
  try {
    if (process.platform !== 'win32') return tracker.sample(readValidationProcesses());
    return windowsTracker.sample(readWindowsValidationProcesses(undefined, phase));
  } catch (error) {
    // The verifier catches probe errors; retain only a fixed code, never the cause.
    processProbeFailure ??= offlineLifecycleFailureCode(error);
    throw error;
  }
}
let stage = 'process_preflight';
let monitor:
  | ReturnType<typeof monitorValidationProcesses<ReturnType<typeof observeProcesses>>>
  | undefined;
try {
  if (observeProcesses('preflight').remainingProcesses)
    throw new Error('TEMP_PROFILE_ALREADY_ACTIVE');
  monitor = monitorValidationProcesses(observeProcesses, () => {});
  stage = 'browser_launch';
  const [context, sameContext] = await Promise.all([
    engine.ensureContext(),
    engine.ensureContext(),
  ]);
  context.once('close', () => {
    contextClosed = true;
  });
  if (context !== sameContext || !existsSync(`${profile}.owner.lock`))
    throw new Error('OWNERSHIP_NOT_VERIFIED');
  stage = 'local_page';
  await context.route('**/*', (route) => route.abort());
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setContent('<title>Offline lifecycle proof</title><p>Synthetic local content</p>');
  chromeVersion = (await page.evaluate(() => navigator.userAgent)).match(/Chrome\/([\d.]+)/)?.[1];
  stage = 'process_observation';
  observedProcesses = observeProcesses().remainingProcesses;
  if (!chromeVersion || !observedProcesses) throw new Error('CHROME_PROCESS_NOT_OBSERVED');
  stage = 'held_local_session';
  // Representative held lifecycle; only the synthetic local page is displayed.
  await new Promise((resolve) => setTimeout(resolve, 20000));
  if (monitor.failed) throw new Error('PROCESS_OBSERVATION_FAILED');
} catch (error) {
  failure = { stage, code: offlineLifecycleFailureCode(error) };
  process.exitCode = 1;
} finally {
  // Every attempted lifecycle, including a failed held monitor, gets the same
  // bounded teardown plus immediate/final observations. Preserve its first failure.
  const { teardown, processObservationFailed, cleanup, verified } = await finalizeBrowserLifecycle({
    dispose: () => engine.dispose(),
    monitor,
    probe: () => ({
      ...observeProcesses(),
      ownershipReleased: !existsSync(`${profile}.owner.lock`),
      contextInactive: contextClosed && !engine.hasActiveContext,
    }),
    priorFailure: failure !== undefined,
  });
  cleanupVerified = verified;
  console.log(
    JSON.stringify({
      browserLifecycle: cleanupVerified ? 'passed' : 'failed',
      ...(failure ? { failure } : {}),
      platform: process.platform,
      node: process.version,
      chromeVersion,
      observedProcesses,
      remainingProcesses: cleanup.final.remainingProcesses,
      contextClosed,
      engineContextInactive: !engine.hasActiveContext,
      ownershipReleased: cleanup.final.ownershipReleased,
      linkedInRequests: 0,
      processAccountingMethod:
        process.platform === 'win32'
          ? 'Windows PID and UTC creation stamp'
          : 'POSIX PID and start stamp',
      processProbeDeadlineMs,
      heldSessionMs: 20000,
      teardownDeadlineMs: 30000,
      teardownTimedOut: teardown.timedOut,
      processObservations: monitor?.checks ?? 0,
      processObservationFailed,
      ...(processProbeFailure ? { processProbeFailure } : {}),
      cleanup,
    }),
  );
  if (!cleanupVerified) {
    console.error(
      JSON.stringify({
        browserLifecycle: 'failed',
        ...(failure ?? { stage: 'cleanup_verification', code: 'CHROME_CLEANUP_NOT_VERIFIED' }),
      }),
    );
    process.exitCode = 1;
  }
  // Keep the temporary profile/owner for diagnosis if shutdown is uncertain.
  if (cleanupVerified) rmSync(directory, { recursive: true, force: true });
}

if (!cleanupVerified) process.exit(1);
