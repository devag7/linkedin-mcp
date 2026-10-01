/** Run only after fresh consent to docs/JOB_BRIEF_SHAPE_CAPTURE_PROTOCOL_2026-10-02.md. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRuntime, createServer } from '../src/server.js';
import { loadConfig } from '../src/config/env.js';
import { Logger } from '../src/types.js';
import { outputSchema } from '../src/tools/contracts.js';
import { briefSchema } from '../src/tools/research-contract.js';
import { inspectSetup } from '../src/doctor.js';
import { profilePath } from '../src/safety/state-lock.js';
import { jobResponseShape } from './job-response-shape.js';

// This is an accidental-run guard, not proof of human approval. The agent must
// obtain explicit consent for this exact source, query, bounds and retention first.
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(process.env.LINKEDIN_JOB_SHAPE_CONSENT_SHA, head, 'FRESH_SOURCE_CONSENT_REQUIRED');
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
  const rows = execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8' })
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
const logger = new Logger('error');
const runtime = createRuntime(logger, false);
const { server } = createServer(logger, runtime);
const client = new Client({ name: 'consented-shape-diagnostic', version: '1' });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const shapes: { route: 'search' | 'detail'; shape: ReturnType<typeof jobResponseShape> }[] = [];
const originalGet = runtime.voyager.voyagerGet.bind(runtime.voyager);
runtime.voyager.voyagerGet = async <T>(path: string): Promise<T> => {
  const raw = await originalGet<T>(path);
  // Only responses of the two reads already requested by the brief. No /me
  // response, requests, headers, raw values or background traffic are captured.
  const route = path.includes('voyagerJobsDashJobCards')
    ? 'search'
    : path.includes('jobPostingUrn')
      ? 'detail'
      : null;
  if (route) shapes.push({ route, shape: jobResponseShape(raw) });
  return raw;
};
const record: Record<string, unknown> = {
  sourceSha: head,
  nodeVersion: process.version,
  platform: process.platform,
  transport: 'SDK in-memory, actual production runtime',
  scope: 'One diagnosis; not installed-client or general provider compatibility evidence.',
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
        count: 3,
        enrich_first: true,
      },
    },
    undefined,
    { timeout: 180000, maxTotalTimeout: 180000, resetTimeoutOnProgress: false },
  );
  const envelope = outputSchema('research_jobs').parse(result.structuredContent);
  const text = (result.content as { type: string; text: string }[])[0];
  assert.equal(text?.type, 'text');
  assert.deepEqual(JSON.parse(text!.text), envelope);
  if (envelope.data === null)
    record.result = { metaStatus: envelope.meta.status, code: envelope.code };
  assert.ok(envelope.data);
  const brief = briefSchema.parse(envelope.data);
  assert.equal(brief.status, envelope.meta.status);
  assert.ok(
    brief.entities.length <= 3 && brief.bounds.readAttempts <= 3 && brief.bounds.toolCalls <= 2,
  );
  const end = Date.now();
  const start = Date.parse(record.startedAt as string);
  for (const entity of brief.entities) {
    assert.match(entity.sourceUrl, /^https:\/\/www\.linkedin\.com\/jobs\/view\/[0-9]{1,20}\/$/);
    for (const fact of entity.facts) {
      assert.equal(fact.sourceUrl, entity.sourceUrl);
      assert.ok(
        brief.reads.some(
          (read) =>
            read.tool === fact.sourceTool &&
            read.fetchedAt === fact.fetchedAt &&
            read.status !== 'error',
        ),
      );
      assert.ok(Date.parse(fact.fetchedAt) >= start && Date.parse(fact.fetchedAt) <= end);
      assert.ok(brief.markdown.includes(`[source](${fact.sourceUrl})`));
    }
  }
  record.result = {
    dataStatus: brief.status,
    metaStatus: envelope.meta.status,
    entities: brief.entities.length,
    facts: brief.entities.reduce((n, entity) => n + entity.facts.length, 0),
    usefulEntities: brief.entities.filter(
      (entity) =>
        entity.facts.some((fact) => fact.field === 'title') &&
        entity.facts.some((fact) =>
          ['location', 'company', 'description', 'listedAt'].includes(fact.field),
        ),
    ).length,
    reads: brief.reads.map((read) => ({ tool: read.tool, status: read.status, code: read.code })),
    bounds: brief.bounds,
  };
} catch {
  // Do not persist exception messages, stacks, provider payloads or URLs.
  record.failure = 'DIAGNOSIS_OR_CONTRACT_FAILED';
  failure = true;
} finally {
  startedProcesses = processes();
  let closed = false;
  try {
    const response = await client.callTool({ name: 'close_session', arguments: {} }, undefined, {
      timeout: 30000,
    });
    closed = response.isError !== true;
  } catch {
    failure = true;
  }
  await client.close().catch(() => {
    failure = true;
  });
  await server.close().catch(() => {
    failure = true;
  });
  runtime.queue.clear();
  await runtime.engine.dispose().catch(() => {
    failure = true;
  });
  const remaining = processes(startedProcesses).length;
  const ownerReleased = !existsSync(`${profile}.owner.lock`);
  record.cleanup = {
    closeSession: closed,
    observedProcesses: startedProcesses.length,
    remainingProcesses: remaining,
    ownershipReleased: ownerReleased,
    verified: closed && remaining === 0 && ownerReleased && !runtime.engine.hasActiveContext,
  };
  if (!closed || remaining || !ownerReleased) failure = true;
  record.endedAt = new Date().toISOString();
  record.shapes = shapes;
  writeFileSync(output!, JSON.stringify(record, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
// Emit a fixed result only; the private redacted receipt is inspected separately.
console.log(failure ? 'DIAGNOSTIC_STOPPED' : 'DIAGNOSTIC_RECORDED');
process.exitCode = failure ? 1 : 0;
