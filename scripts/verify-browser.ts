/** Real Chrome/engine lifecycle proof using an empty, temporary profile and no LinkedIn URL. */
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserEngine } from '../src/browser/engine.js';
import { loadConfig } from '../src/config/env.js';
import { Logger } from '../src/types.js';
import { verifyFinalCleanup, type CleanupState } from './validation-cleanup.js';
import { readValidationProcesses, ValidationProcessTracker } from './validation-processes.js';
import {
  readWindowsValidationProcesses,
  WindowsValidationProcessTracker,
  offlineLifecycleFailureCode,
} from './validation-windows-processes.js';

const directory = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-browser-proof-')));
const profile = join(directory, 'profile');
const config = {
  ...loadConfig(),
  LINKEDIN_PROFILE_DIR: profile,
  LINKEDIN_HEADLESS: true,
  LINKEDIN_IDLE_TIMEOUT_MS: 0,
  LINKEDIN_ENABLE_WRITES: false,
  LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: false,
};
const engine = new BrowserEngine(config, new Logger('error'), false);
const posixTracker = new ValidationProcessTracker(profile);
const windowsTracker = new WindowsValidationProcessTracker(profile);
let processProbeFailure: string | undefined;
function observeProcesses(phase: 'preflight' | 'runtime' = 'runtime') {
  try {
    return process.platform === 'win32'
      ? windowsTracker.sample(readWindowsValidationProcesses(undefined, phase))
      : posixTracker.sample(readValidationProcesses());
  } catch (error) {
    processProbeFailure ??= offlineLifecycleFailureCode(error);
    throw error;
  }
}
let cleanupVerified = false;
let disposalAttempted = false;
let contextClosed = false;
let stage = 'process_preflight';
let cleanup: Awaited<ReturnType<typeof verifyFinalCleanup>> | undefined;
try {
  if (observeProcesses('preflight').remainingProcesses) throw new Error('TEMP_PROFILE_ALREADY_ACTIVE');
  stage = 'browser_launch';
  const [context, sameContext] = await Promise.all([
    engine.ensureContext(),
    engine.ensureContext(),
  ]);
  if (context !== sameContext || !existsSync(`${profile}.owner.lock`))
    throw new Error('OWNERSHIP_NOT_VERIFIED');
  stage = 'local_page';
  await context.route('**/*', (route) => route.abort());
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setContent('<title>Offline lifecycle proof</title><p>Synthetic local content</p>');
  const chromeVersion = (await page.evaluate(() => navigator.userAgent)).match(
    /Chrome\/([\d.]+)/,
  )?.[1];
  stage = 'process_observation';
  const observedProcesses = observeProcesses().remainingProcesses;
  if (!chromeVersion || !observedProcesses) throw new Error('CHROME_PROCESS_NOT_OBSERVED');
  context.once('close', () => {
    contextClosed = true;
  });
  stage = 'teardown';
  disposalAttempted = true;
  let teardownFailed = false;
  try {
    await engine.dispose();
  } catch {
    teardownFailed = true;
  }
  stage = 'cleanup_verification';
  cleanup = await verifyFinalCleanup(
    (): CleanupState => ({
      ...observeProcesses(),
      ownershipReleased: !existsSync(`${profile}.owner.lock`),
      contextInactive: contextClosed && !engine.hasActiveContext,
    }),
    { teardownFailed },
  );
  cleanupVerified = cleanup.verified;
  if (!cleanupVerified) throw new Error('CHROME_CLEANUP_NOT_VERIFIED');
  // eslint-disable-next-line no-console -- fixed-label offline verification receipt
  console.log(
    JSON.stringify({
      browserLifecycle: 'passed',
      platform: process.platform,
      node: process.version,
      chromeVersion,
      observedProcesses,
      remainingProcesses: cleanup.final.remainingProcesses,
      contextClosed,
      ownershipReleased: cleanup.final.ownershipReleased,
      linkedInRequests: 0,
      processAccountingMethod:
        process.platform === 'win32'
          ? 'Windows PID and UTC creation stamp'
          : 'POSIX PID and start stamp',
      cleanup,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      browserLifecycle: 'failed',
      stage,
      code: offlineLifecycleFailureCode(error),
      contextClosed,
      contextActive: engine.hasActiveContext,
      ownerLockPresent: existsSync(`${profile}.owner.lock`),
      ...(processProbeFailure ? { processProbeFailure } : {}),
      ...(cleanup ? { cleanup } : {}),
    }),
  );
  process.exitCode = 1;
} finally {
  if (!disposalAttempted)
    await engine.dispose().catch(() => {
      process.exitCode = 1;
    });
  // Keep the temporary profile/owner for diagnosis if shutdown is uncertain.
  if (cleanupVerified) rmSync(directory, { recursive: true, force: true });
}
