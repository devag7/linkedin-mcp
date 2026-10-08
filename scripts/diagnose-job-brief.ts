/** Run only after fresh consent to docs/JOB_BRIEF_REST_VALIDATION_PROTOCOL_2026-10-02.md. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRuntime, createServer } from '../src/server.js';
import { loadConfig } from '../src/config/env.js';
import { Logger } from '../src/types.js';
import { briefObservation } from './job-brief-observation.js';
import { inspectSetup } from '../src/doctor.js';
import { profilePath } from '../src/safety/state-lock.js';
import { JOB_DETAIL_CHECKS, observeJobDetailChecks } from '../src/tools/job-detail-diagnostic.js';
import { verifyFinalCleanup } from './validation-cleanup.js';

// This is an accidental-run guard, not proof of human approval. The agent must
// obtain explicit consent for this exact source, query, bounds and retention first.
const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
const head = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: sourceRoot,
  encoding: 'utf8',
}).trim();
assert.equal(process.env.LINKEDIN_JOB_SHAPE_CONSENT_SHA, head, 'FRESH_SOURCE_CONSENT_REQUIRED');
assert.equal(
  execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    cwd: sourceRoot,
    encoding: 'utf8',
  }).trim(),
  '',
  'CLEAN_FROZEN_SOURCE_REQUIRED',
);
assert.equal(process.platform, 'darwin', 'PROTOCOL_IS_MACOS_ONLY');
const output = process.env.LINKEDIN_JOB_SHAPE_OUTPUT;
assert.ok(output && output.startsWith('/') && !existsSync(output), 'NEW_PRIVATE_OUTPUT_REQUIRED');
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
// Process command lines are read locally for cleanup only; never written out.
function processes(tracked: number[] = []) {
  const rows = execFileSync('ps', ['-eo', 'pid=,ppid=,args='], {
    encoding: 'utf8',
    timeout: 1000,
    maxBuffer: 2 * 1024 * 1024,
  })
    .split('\n')
    .flatMap((line) => {
      const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
      return match ? [{ pid: Number(match[1]), parent: Number(match[2]), command: match[3]! }] : [];
    });
  const selected = new Set(tracked);
  for (const row of rows) if (row.command.includes(profile)) selected.add(row.pid);
  for (let changed = true; changed; ) {
    changed = false;
    for (const row of rows)
      if (selected.has(row.parent) && !selected.has(row.pid)) {
        selected.add(row.pid);
        changed = true;
      }
  }
  return rows.filter((row) => selected.has(row.pid)).map((row) => row.pid);
}
assert.equal(processes().length, 0, 'PROFILE_ALREADY_ACTIVE');
// Preserve an exclusive start marker even if the process crashes before its receipt.
// A marker prevents an accidental retry at the same output path; it is not consent.
writeFileSync(
  `${output}.started`,
  JSON.stringify({ sourceSha: head, startedAt: new Date().toISOString() }) + '\n',
  {
    mode: 0o600,
    flag: 'wx',
  },
);
const logger = new Logger('error');
const runtime = createRuntime(logger, false);
const { server } = createServer(logger, runtime);
const detailChecks = Object.fromEntries(JOB_DETAIL_CHECKS.map((check) => [check, 0])) as Record<
  (typeof JOB_DETAIL_CHECKS)[number],
  number
>;
const stopObserving = observeJobDetailChecks(server, (check) => {
  detailChecks[check]++;
});
const client = new Client({ name: 'consented-shape-diagnostic', version: '1' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const record: Record<string, unknown> = {
  sourceSha: head,
  nodeVersion: process.version,
  platform: process.platform,
  transport: 'SDK in-memory, actual production runtime',
  scope:
    'One separately consented count-one brief with value-free detail stage counts; not installed-client or general provider compatibility evidence.',
  startedAt: new Date().toISOString(),
};
let startedProcesses: number[] = [];
let failure = false;
try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const { tools } = await client.listTools();
  assert.equal(tools.length, 23);
  assert.ok(tools.some((tool) => tool.name === 'research_jobs'));
  const result = await client.callTool(
    {
      name: 'research_jobs',
      arguments: {
        keywords: 'TypeScript engineer',
        count: 1,
        enrich_first: true,
      },
    },
    undefined,
    { timeout: 180000, maxTotalTimeout: 180000, resetTimeoutOnProgress: false },
  );
  const observation = briefObservation(result, Date.parse(record.startedAt as string), Date.now());
  if (typeof observation.entities === 'number')
    assert.ok(observation.entities <= 1, 'COUNT_ONE_BOUND_FAILED');
  record.result = observation;
  record.usefulBriefPassed = observation.usefulEntities >= 1;
  if (observation.usefulEntities < 1) failure = true;
} catch {
  // Do not persist exception messages, stacks, provider payloads or URLs.
  record.failure = 'DIAGNOSIS_OR_CONTRACT_FAILED';
  failure = true;
} finally {
  let teardownFailed = false;
  try {
    startedProcesses = processes();
  } catch {
    teardownFailed = true;
  }
  let closed = false;
  try {
    const response = await client.callTool({ name: 'close_session', arguments: {} }, undefined, {
      timeout: 30000,
    });
    const envelope = response.structuredContent;
    const data =
      envelope && typeof envelope === 'object' && 'data' in envelope ? envelope.data : undefined;
    closed =
      response.isError !== true &&
      !!data &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      'closed' in data &&
      data.closed === true;
  } catch {
    teardownFailed = true;
  }
  await client.close().catch(() => {
    teardownFailed = true;
  });
  await server.close().catch(() => {
    teardownFailed = true;
  });
  runtime.queue.clear();
  await runtime.engine.dispose().catch(() => {
    teardownFailed = true;
  });
  const verification = await verifyFinalCleanup(
    () => ({
      remainingProcesses: processes(startedProcesses).length,
      ownershipReleased: !existsSync(`${profile}.owner.lock`),
      contextInactive: !runtime.engine.hasActiveContext,
    }),
    { teardownFailed: teardownFailed || !closed },
  );
  record.cleanup = {
    closeSession: closed,
    observedProcesses: startedProcesses.length,
    processProbeDeadlineMs: 1000,
    ...verification,
  };
  if (!verification.verified) failure = true;
  stopObserving();
  record.detailValidationCounts = detailChecks;
  record.endedAt = new Date().toISOString();
  record.acceptancePassed = !failure;
  writeFileSync(output!, JSON.stringify(record, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
// Emit a fixed result only; the private redacted receipt is inspected separately.
console.log(failure ? 'DIAGNOSTIC_STOPPED' : 'DIAGNOSTIC_RECORDED');
process.exit(failure ? 1 : 0);
