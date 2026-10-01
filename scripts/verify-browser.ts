/** Real Chrome/engine lifecycle proof using an empty, temporary profile and no LinkedIn URL. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
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
function matchingProcesses(tracked: number[] = []): number[] {
  let processes: { pid: number; parent: number; command: string }[];
  if (process.platform === 'win32') {
    const text = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress',
      ],
      { encoding: 'utf8' },
    );
    const values = JSON.parse(text) as {
      ProcessId: number;
      ParentProcessId: number;
      CommandLine: string | null;
    }[];
    processes = values.map((value) => ({
      pid: value.ProcessId,
      parent: value.ParentProcessId,
      command: value.CommandLine ?? '',
    }));
  } else {
    processes = execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8' })
      .split('\n')
      .flatMap((line) => {
        const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
        return match
          ? [{ pid: Number(match[1]), parent: Number(match[2]), command: match[3] ?? '' }]
          : [];
      });
  }
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
let started: number[] = [];
try {
  if (matchingProcesses().length) throw new Error('TEMP_PROFILE_ALREADY_ACTIVE');
  const [context, sameContext] = await Promise.all([
    engine.ensureContext(),
    engine.ensureContext(),
  ]);
  if (context !== sameContext || !existsSync(`${profile}.owner.lock`))
    throw new Error('OWNERSHIP_NOT_VERIFIED');
  await context.route('**/*', (route) => route.abort());
  const page = context.pages()[0] ?? (await context.newPage());
  await page.setContent('<title>Offline lifecycle proof</title><p>Synthetic local content</p>');
  const chromeVersion = (await page.evaluate(() => navigator.userAgent)).match(
    /Chrome\/([\d.]+)/,
  )?.[1];
  started = matchingProcesses();
  if (!chromeVersion || !started.length) throw new Error('CHROME_PROCESS_NOT_OBSERVED');
  let contextClosed = false;
  context.once('close', () => {
    contextClosed = true;
  });
  await engine.dispose();
  for (let i = 0; i < 50 && matchingProcesses(started).length; i++) await delay(100);
  if (
    !contextClosed ||
    engine.hasActiveContext ||
    existsSync(`${profile}.owner.lock`) ||
    matchingProcesses(started).length
  )
    throw new Error('CHROME_CLEANUP_NOT_VERIFIED');
  cleanupVerified = true;
  console.log(
    JSON.stringify({
      browserLifecycle: 'passed',
      platform: process.platform,
      node: process.version,
      chromeVersion,
      observedProcesses: started.length,
      remainingProcesses: 0,
      contextClosed,
      ownershipReleased: true,
      linkedInRequests: 0,
    }),
  );
} catch (error) {
  console.error(
    error instanceof Error && /^[A-Z_]+$/.test(error.message)
      ? error.message
      : 'BROWSER_LIFECYCLE_FAILED',
  );
  process.exitCode = 1;
} finally {
  await engine.dispose().catch(() => {
    process.exitCode = 1;
  });
  // Keep the temporary profile/owner for diagnosis if shutdown is uncertain.
  if (cleanupVerified) rmSync(directory, { recursive: true, force: true });
}
