/** Exact-build, separately consented one-run validator. Never invoke as an offline probe. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifyFinalCleanup } from './validation-cleanup.js';
import { readValidationProcesses, ValidationProcessTracker } from './validation-processes.js';
import {
  teardownValidationSession,
  monitorValidationProcesses,
  installSearchOnlyRequestGuard,
} from './search-only-validation-support.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(process.env.LINKEDIN_SEARCH_ONLY_CONSENT_SHA, head, 'EXACT_BUILD_CONSENT_REQUIRED');
assert.equal(
  execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  '',
  'CLEAN_FROZEN_SOURCE_REQUIRED',
);
assert.equal(process.platform, 'darwin', 'MACOS_SCOPE_REQUIRED');
const archive = process.env.LINKEDIN_SEARCH_ONLY_ARCHIVE;
assert.ok(archive && archive.startsWith('/'), 'EXACT_ARCHIVE_REQUIRED');
const archiveSha256 = sha256(archive);
assert.equal(
  process.env.LINKEDIN_SEARCH_ONLY_ARCHIVE_SHA256,
  archiveSha256,
  'EXACT_ARCHIVE_REQUIRED',
);
const runnerSha256 = sha256(fileURLToPath(import.meta.url));
assert.equal(process.env.LINKEDIN_SEARCH_ONLY_RUNNER_SHA256, runnerSha256, 'EXACT_RUNNER_REQUIRED');
const output = process.env.LINKEDIN_SEARCH_ONLY_OUTPUT;
assert.ok(
  output && output.startsWith('/') && !existsSync(output) && !existsSync(output + '.started'),
  'NEW_PRIVATE_OUTPUT_REQUIRED',
);
// Guards precede all configuration/profile/browser/runtime imports.
const [
  { Client },
  { InMemoryTransport },
  { createRuntime, createServer },
  { loadConfig },
  { Logger },
  { inspectSetup },
  { profilePath },
  { VoyagerClient },
  endpoints,
  { searchOnlyObservation },
] = await Promise.all([
  import('@modelcontextprotocol/sdk/client/index.js'),
  import('@modelcontextprotocol/sdk/inMemory.js'),
  import('../src/server.js'),
  import('../src/config/env.js'),
  import('../src/types.js'),
  import('../src/doctor.js'),
  import('../src/safety/state-lock.js'),
  import('../src/browser/voyager.js'),
  import('../src/browser/endpoints.js'),
  import('./search-only-observation.js'),
]);
process.env.TRANSPORT = 'stdio';
process.env.LINKEDIN_PROVIDER = 'browser';
process.env.LINKEDIN_ENABLE_WRITES = 'false';
process.env.LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES = 'false';
process.env.LOG_LEVEL = 'error';
const config = loadConfig();
const profile = profilePath(config.LINKEDIN_PROFILE_DIR);
const diagnosis = inspectSetup(config, { transport: 'stdio', port: 3000, logLevel: 'error' });
assert.ok(
  diagnosis.checks.package === 'available' &&
    diagnosis.checks.chrome === 'available' &&
    diagnosis.checks.profileWritable &&
    !diagnosis.checks.profileOwned &&
    !diagnosis.checks.budgetLocked &&
    diagnosis.checks.safetyState === 'valid',
  'OFFLINE_READINESS_FAILED',
);
const tracker = new ValidationProcessTracker(profile);
const probe = () => tracker.sample(readValidationProcesses());
assert.equal(probe().remainingProcesses, 0, 'PROFILE_ALREADY_ACTIVE');
writeFileSync(
  output + '.started',
  JSON.stringify({ sourceSha: head, startedAt: new Date().toISOString() }) + '\n',
  { flag: 'wx', mode: 0o600 },
);
const requestGuard = installSearchOnlyRequestGuard(
  VoyagerClient.prototype,
  endpoints.me(),
  endpoints.jobCardsSearch('TypeScript engineer', undefined, 0, 10),
);
const logger = new Logger('error');
// Runtime error logs may include unreviewed strings; retain fixed receipt fields only.
logger.error = () => {};
const runtime = createRuntime(logger, false);
const { server } = createServer(logger, runtime);
const client = new Client({ name: 'consented-search-only-validation', version: '1' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const stop = new AbortController();
const monitor = monitorValidationProcesses(probe, () => {
  requestGuard.stop();
  stop.abort();
});
const ensureContext = runtime.engine.ensureContext.bind(runtime.engine);
runtime.engine.ensureContext = async () => {
  const context = await ensureContext();
  monitor.sample(); // Observe the launched tree before any explicit API read.
  return context;
};
const startedAt = new Date().toISOString();
let result: ReturnType<typeof searchOnlyObservation> | undefined;
let callFailed = false;
let observedProcesses: number | null = null;
let closeSession = false;
let teardownTimedOut = false;
let teardownFailed = false;
try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const incoming = await client.callTool(
    {
      name: 'research_jobs',
      arguments: {
        keywords: 'TypeScript engineer',
        count: 10,
        enrich_first: false,
      },
    },
    undefined,
    {
      timeout: 180000,
      maxTotalTimeout: 180000,
      resetTimeoutOnProgress: false,
      signal: stop.signal,
    },
  );
  result = searchOnlyObservation(incoming, Date.parse(startedAt), Date.now());
  assert.equal(result.readAttempts, requestGuard.attempts);
} catch {
  callFailed = true; /* Raw errors/results are never persisted. */
} finally {
  requestGuard.stop();
  stop.abort();
  runtime.queue.clear();
  try {
    observedProcesses = monitor.sample().remainingProcesses;
  } catch {
    teardownFailed = true;
  }
  const teardown = await teardownValidationSession({
    dispose: () => runtime.engine.dispose(),
    closeSession: async () => {
      const response = await client.callTool({ name: 'close_session', arguments: {} }, undefined, {
        timeout: 10000,
      });
      const envelope = response.structuredContent as { data?: { closed?: boolean } } | undefined;
      return response.isError !== true && envelope?.data?.closed === true;
    },
    closeClient: () => client.close(),
    closeServer: () => server.close(),
  });
  closeSession = teardown.closeSession;
  teardownFailed ||= teardown.failed;
  teardownTimedOut = teardown.timedOut;
  monitor.stop();
  const cleanup = await verifyFinalCleanup(
    () => ({
      ...monitor.sample(),
      ownershipReleased: !existsSync(profile + '.owner.lock'),
      contextInactive: !runtime.engine.hasActiveContext,
    }),
    { teardownFailed: teardownFailed || monitor.failed },
  );
  const acceptancePassed =
    !callFailed &&
    !monitor.failed &&
    requestGuard.violations === 0 &&
    !!result &&
    !result.readFailed &&
    result.usefulEntities >= 1 &&
    cleanup.verified;
  const receipt = {
    schema: 'search-only-brief-validation-v1',
    sourceSha: head,
    archiveSha256,
    runnerSha256,
    nodeVersion: process.version,
    platform: process.platform,
    transport: 'SDK in-memory production source runtime',
    startedAt,
    endedAt: new Date().toISOString(),
    toolDeadlineMs: 180000,
    teardownDeadlineMs: 30000,
    processProbeDeadlineMs: 1000,
    actualGetAttempts: requestGuard.attempts,
    scopeViolations: requestGuard.violations,
    callFailed,
    result: result ?? null,
    processObservations: monitor.checks,
    processObservationFailed: monitor.failed,
    cleanup: { closeSession, observedProcesses, teardownTimedOut, ...cleanup },
    acceptancePassed,
  };
  writeFileSync(output, JSON.stringify(receipt) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(acceptancePassed ? 'SEARCH_ONLY_VALIDATION_PASSED' : 'SEARCH_ONLY_VALIDATION_FAILED');
  process.exit(acceptancePassed ? 0 : 1);
}
