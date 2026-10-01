/** Redacted, read-only setup diagnosis. Live probing is explicitly selected. */
import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { dirname, win32 } from 'node:path';
import { createRequire } from 'node:module';
import { VERSION } from './version.js';
import type { EnvConfig } from './config/env.js';
import type { ServerConfig } from './types.js';
import { Logger } from './types.js';
import { profilePath, SafetyStateError } from './safety/state-lock.js';
import { CircuitFileStorage, circuitStatePath } from './safety/circuit-storage.js';
import { BudgetTracker, budgetStatePath } from './safety/budgets.js';
import { createRuntime } from './server.js';
import { ACTIONS } from './browser/guard.js';
import { BrowserSafetyError } from './browser/safety.js';
import { VoyagerError } from './browser/voyager.js';
import { requestCancellation } from './tools/cancellation.js';
import { assertReadResponse } from './tools/provider-shape.js';
import { me } from './browser/endpoints.js';

/** Paths mirror the installed Patchright 1.60.2 Chrome channel registry. */
export function chromeCandidates(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  explicit?: string,
): string[] {
  if (explicit) return [explicit];
  if (platform === 'darwin')
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  if (platform === 'linux') return ['/opt/google/chrome/chrome'];
  if (platform === 'win32') {
    const roots = [
      env.LOCALAPPDATA,
      env.PROGRAMFILES,
      env['PROGRAMFILES(X86)'],
      ...(env.HOMEDRIVE
        ? [`${env.HOMEDRIVE}\\Program Files`, `${env.HOMEDRIVE}\\Program Files (x86)`]
        : []),
    ];
    return [
      ...new Set(
        roots
          .filter((root): root is string => !!root)
          .map((root) => win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      ),
    ];
  }
  return [];
}

class DiagnosticTimeout extends Error {}

export interface DoctorReport {
  version: string;
  node: string;
  platform: string;
  transport: ServerConfig['transport'];
  checks: {
    package: 'available' | 'missing';
    chrome: 'available' | 'missing' | 'unsupported_platform';
    profile: 'exists' | 'not_created' | 'invalid';
    profileWritable: boolean;
    profileOwned: boolean;
    budgetLocked: boolean;
    safetyState: 'valid' | 'blocked' | 'invalid';
    httpToken: 'not_required' | 'configured' | 'missing_or_invalid';
  };
  session:
    | 'not_checked'
    | 'healthy'
    | 'auth_required'
    | 'blocked'
    | 'profile_in_use'
    | 'timeout'
    | 'error';
  api: 'not_checked' | 'ok' | 'blocked' | 'failed';
  nextSteps: string[];
}

export function inspectSetup(
  config: EnvConfig,
  server: ServerConfig,
  storagePath?: string,
): DoctorReport {
  const report: DoctorReport = {
    version: VERSION,
    node: process.version,
    platform: process.platform,
    transport: server.transport,
    checks: {
      package: 'available',
      chrome: 'missing',
      profile: 'not_created',
      profileWritable: false,
      profileOwned: false,
      budgetLocked: false,
      safetyState: 'valid',
      httpToken:
        server.transport === 'http'
          ? /^[A-Za-z0-9_-]{32,256}$/.test(process.env.LINKEDIN_HTTP_TOKEN ?? '')
            ? 'configured'
            : 'missing_or_invalid'
          : 'not_required',
    },
    session: 'not_checked',
    api: 'not_checked',
    nextSteps: [],
  };
  try {
    createRequire(import.meta.url).resolve('patchright');
  } catch {
    report.checks.package = 'missing';
  }
  const candidates = chromeCandidates(process.platform, process.env, config.LINKEDIN_CHROME_PATH);
  if (!candidates.length) report.checks.chrome = 'unsupported_platform';
  for (const candidate of candidates) {
    try {
      accessSync(candidate, process.platform === 'win32' ? constants.R_OK : constants.X_OK);
      if (statSync(candidate).isFile()) report.checks.chrome = 'available';
    } catch {
      /* A missing candidate contains no printable diagnostic details. */
    }
  }
  try {
    const profile = profilePath(config.LINKEDIN_PROFILE_DIR);
    if (existsSync(profile)) {
      if (!statSync(profile).isDirectory()) throw new Error('invalid profile');
      report.checks.profile = 'exists';
    }
    let parent = profile;
    while (!existsSync(parent)) parent = dirname(parent);
    try {
      accessSync(parent, constants.W_OK | constants.X_OK);
      report.checks.profileWritable = true;
    } catch {
      /* Read-only diagnosis. */
    }
    report.checks.profileOwned = existsSync(`${profile}.owner.lock`);
    try {
      const stop = new CircuitFileStorage(circuitStatePath(profile)).load();
      if (stop?.globalOpen) report.checks.safetyState = 'blocked';
    } catch {
      report.checks.safetyState = 'invalid';
    }
  } catch {
    report.checks.profile = 'invalid';
    report.checks.safetyState = 'invalid';
  }
  try {
    new BudgetTracker(null, { storagePath }).verifyStorage();
    report.checks.budgetLocked = existsSync(`${budgetStatePath(storagePath)}.lock`);
  } catch {
    report.checks.safetyState = 'invalid';
  }
  if (report.checks.package === 'missing')
    report.nextSteps.push('Reinstall linkedin-mcp-tools from the packed package or npm.');
  if (report.checks.chrome !== 'available')
    report.nextSteps.push(
      'Install Google Chrome or set LINKEDIN_CHROME_PATH to an installed executable. Diagnosis does not install software.',
    );
  if (!report.checks.profileWritable || report.checks.profile === 'invalid')
    report.nextSteps.push(
      'Repair LINKEDIN_PROFILE_DIR: choose an accessible directory, fix broken symlink/junction targets or parent aliases, and check permissions. Stop profile owners first; do not delete safety history. Regenerate client configuration after repair.',
    );
  if (report.checks.budgetLocked)
    report.nextSteps.push(
      'Budget state is currently locked. Wait for the transaction to finish; repair only a confirmed orphan after stopping all owners.',
    );
  if (report.checks.profileOwned)
    report.nextSteps.push(
      'Stop the process that owns this browser profile. Never remove a lock while its owner or Chrome is running.',
    );
  if (report.checks.safetyState === 'blocked')
    report.nextSteps.push('Resolve the checkpoint manually with --login, then restart.');
  if (report.checks.safetyState === 'invalid')
    report.nextSteps.push(
      'Stop automation and restore or repair safety state; do not delete budget or journal files.',
    );
  if (report.checks.httpToken === 'missing_or_invalid')
    report.nextSteps.push(
      'Set a random LINKEDIN_HTTP_TOKEN of 32–256 letters, digits, underscores or hyphens for local HTTP.',
    );
  report.nextSteps.push(
    'Login and API status have not been checked. After --login, use --doctor --live or the MCP health_check tool for a live read.',
  );
  return report;
}

export async function diagnose(
  config: EnvConfig,
  server: ServerConfig,
  options: {
    live?: boolean;
    timeoutMs?: number;
    storagePath?: string;
    /** Injected fixture probe for deterministic offline tests. */
    probe?: () => Promise<void>;
  } = {},
): Promise<DoctorReport> {
  const report = inspectSetup(config, server, options.storagePath);
  if (!options.live) return report;
  if (report.checks.safetyState !== 'valid' || report.checks.budgetLocked) {
    report.session = 'blocked';
    report.api = 'blocked';
    return report;
  }
  if (report.checks.profileOwned) {
    report.session = 'profile_in_use';
    report.api = 'blocked';
    return report;
  }
  if (
    !options.probe &&
    (report.checks.chrome !== 'available' ||
      !report.checks.profileWritable ||
      report.checks.package !== 'available')
  ) {
    report.session = 'error';
    report.api = 'failed';
    return report;
  }
  let runtime: ReturnType<typeof createRuntime> | undefined;
  let timer: NodeJS.Timeout | undefined;
  const cancellation = new AbortController();
  try {
    const probe =
      options.probe ??
      (async () => {
        runtime = createRuntime(new Logger('error'), false, { storagePath: options.storagePath });
        await runtime.guard.run(ACTIONS.readGeneric, async () => {
          const response = await runtime!.voyager.voyagerGet(me());
          assertReadResponse(response);
          runtime!.identity.observe(response);
        });
      });
    await Promise.race([
      requestCancellation.run(cancellation.signal, probe),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new DiagnosticTimeout());
          cancellation.abort();
        }, options.timeoutMs ?? 30000);
      }),
    ]);
    report.session = 'healthy';
    report.api = 'ok';
    report.nextSteps = report.nextSteps.filter((step) => !step.startsWith('Login and API'));
    report.nextSteps.push(
      'The live identity read succeeded. Configure your client with the installed package or built entry you just diagnosed; see SETUP_GUIDE.md.',
    );
  } catch (error) {
    const code =
      error instanceof SafetyStateError ||
      error instanceof BrowserSafetyError ||
      error instanceof VoyagerError
        ? error.code
        : 'UNKNOWN';
    report.session =
      code === 'PROFILE_IN_USE'
        ? 'profile_in_use'
        : code === 'AUTH_REQUIRED'
          ? 'auth_required'
          : code === 'CIRCUIT_OPEN' || code === 'CHECKPOINT_REQUIRED'
            ? 'blocked'
            : error instanceof DiagnosticTimeout
              ? 'timeout'
              : 'error';
    report.api =
      report.session === 'blocked' || report.session === 'profile_in_use' ? 'blocked' : 'failed';
    report.nextSteps.push(
      report.session === 'auth_required'
        ? 'Run --login to sign in, then repeat --doctor --live.'
        : report.session === 'blocked'
          ? 'Stop automation, resolve the checkpoint manually with --login, then restart.'
          : 'Live diagnosis failed. Check local ownership, Chrome availability and session health before retrying.',
    );
  } finally {
    cancellation.abort();
    if (timer) clearTimeout(timer);
    runtime?.queue.clear();
    if (runtime) {
      try {
        await runtime.engine.dispose();
      } catch {
        report.session = 'blocked';
        report.api = 'blocked';
        report.nextSteps.push(
          'Browser cleanup failed. Ownership remains locked; stop Chrome and repair the lock manually.',
        );
      }
    }
  }
  return report;
}
