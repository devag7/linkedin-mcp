/** Real Chrome/engine lifecycle proof using an empty, temporary profile and no LinkedIn URL. */
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyFinalCleanup } from './validation-cleanup.js';
import { readValidationProcesses, ValidationProcessTracker } from './validation-processes.js';
import {
  readWindowsValidationProcesses,
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
  LINKEDIN_HEADLESS: true,
  LINKEDIN_IDLE_TIMEOUT_MS: 0,
  LINKEDIN_ENABLE_WRITES: false,
  LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: false,
};
const engine = new BrowserEngine(config, new Logger('error'), false);
// Windows retains its existing PID inventory; it is not birth-identity or ACL proof.
function matchingWindowsProcesses(tracked: number[] = []): number[] {
  const values = readWindowsValidationProcesses();
  const processes = values.map((value) => ({
    pid: value.ProcessId,
    parent: value.ParentProcessId,
    command: value.CommandLine ?? '',
  }));
  const normalized = profile.replace(/\\/g, '/').toLowerCase();
  const selected = new Set(tracked);
  for (const value of processes)
    if (value.command.replace(/\\/g, '/').toLowerCase().includes(normalized))
      selected.add(value.pid);
  for (let changed = true; changed; ) {
    changed = false;
    for (const value of processes)
      if (selected.has(value.parent) && !selected.has(value.pid)) {
        selected.add(value.pid);
        changed = true;
      }
  }
  return processes.filter((value) => selected.has(value.pid)).map((value) => value.pid);
}
let cleanupVerified = false;
const tracker = new ValidationProcessTracker(profile);
const windowsTracked = new Set<number>();
const processProbeDeadlineMs = process.platform === 'win32' ? 5000 : 1000;
let processProbeFailure: string | undefined;
function observeProcesses() {
  try {
    if (process.platform !== 'win32') return tracker.sample(readValidationProcesses());
    const current = matchingWindowsProcesses([...windowsTracked]);
    for (const pid of current) windowsTracked.add(pid);
    if (windowsTracked.size > 10000) throw new Error('PROCESS_TRACKING_LIMIT');
    return { remainingProcesses: current.length };
  } catch (error) {
    // The verifier catches probe errors; retain only a fixed code, never the cause.
    processProbeFailure ??= offlineLifecycleFailureCode(error);
    throw error;
  }
}
let stage = 'process_preflight';
try {
  if (observeProcesses().remainingProcesses) throw new Error('TEMP_PROFILE_ALREADY_ACTIVE');
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
  let contextClosed = false;
  context.once('close', () => {
    contextClosed = true;
  });
  stage = 'teardown';
  let teardownFailed = false;
  await engine.dispose().catch(() => {
    teardownFailed = true;
  });
  stage = 'cleanup_verification';
  const cleanup = await verifyFinalCleanup(
    () => ({
      ...observeProcesses(),
      ownershipReleased: !existsSync(`${profile}.owner.lock`),
      contextInactive: contextClosed && !engine.hasActiveContext,
    }),
    { teardownFailed },
  );
  cleanupVerified = cleanup.verified;
  console.log(
    JSON.stringify({
      browserLifecycle: cleanupVerified ? 'passed' : 'failed',
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
        process.platform === 'win32' ? 'legacy Windows PID inventory' : 'POSIX PID and start stamp',
      processProbeDeadlineMs,
      ...(processProbeFailure ? { processProbeFailure } : {}),
      cleanup,
    }),
  );
  if (!cleanupVerified) throw new Error('CHROME_CLEANUP_NOT_VERIFIED');
} catch (error) {
  console.error(
    JSON.stringify({ browserLifecycle: 'failed', stage, code: offlineLifecycleFailureCode(error) }),
  );
  process.exitCode = 1;
} finally {
  if (!cleanupVerified)
    await engine.dispose().catch(() => {
      process.exitCode = 1;
    });
  // Keep the temporary profile/owner for diagnosis if shutdown is uncertain.
  if (cleanupVerified) rmSync(directory, { recursive: true, force: true });
}
