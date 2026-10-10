/** Disposable Node processes only. No Chrome, real profile or provider requests. */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { verifyFinalCleanup } from '../scripts/validation-cleanup.js';

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'linkedin-cleanup-fixture-'));
  const lock = join(dir, 'fixture.owner.lock');
  writeFileSync(lock, 'synthetic');
  const child = spawn(
    process.execPath,
    [
      '-e',
      `
    process.stdout.write('ready');
    process.on('message', milliseconds => setTimeout(() => process.exit(0), milliseconds));
    setInterval(() => {}, 10000);
  `,
    ],
    { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
  );
  const exited = once(child, 'exit');
  child.once('exit', () => rmSync(lock, { force: true }));
  await once(child.stdout!, 'data');
  return {
    child,
    probe: () => ({
      remainingProcesses: child.exitCode === null && child.signalCode === null ? 1 : 0,
      ownershipReleased: !existsSync(lock),
      contextInactive: true,
    }),
    close: async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await exited;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

it('reproduces immediate teardown failure and verifies a delayed process exit within the final bound', async () => {
  const f = await fixture();
  try {
    f.child.send(200);
    const report = await verifyFinalCleanup(f.probe, { maximumMs: 2000, intervalMs: 25 });
    expect(report.immediate).toMatchObject({
      remainingProcesses: 1,
      ownershipReleased: false,
      contextInactive: true,
    });
    // The old one-shot runner would have failed at this immediate observation.
    expect(report.final).toMatchObject({
      remainingProcesses: 0,
      ownershipReleased: true,
      contextInactive: true,
    });
    expect(report.verified).toBe(true);
    expect(report.checks).toBeGreaterThan(1);
    expect(report.elapsedMs).toBeLessThan(2500);
    expect(JSON.stringify(report)).not.toMatch(/pid|ready|synthetic|fixture.owner|command/);
  } finally {
    await f.close();
  }
});

it('fails at the bound when a disposable process remains and leaves termination to the fixture owner', async () => {
  const f = await fixture();
  try {
    const report = await verifyFinalCleanup(f.probe, { maximumMs: 60, intervalMs: 10 });
    expect(report.verified).toBe(false);
    expect(report.final.remainingProcesses).toBe(1);
    expect(f.child.exitCode).toBe(null); // Verification must not kill or retry anything.
  } finally {
    await f.close();
  }
});

it('preserves failed immediate and final counts for two processes that exit after the bound', async () => {
  const fixtures = await Promise.all([fixture(), fixture()]);
  try {
    const exited = fixtures.map((f) => once(f.child, 'exit'));
    for (const f of fixtures) f.child.send(1500);
    const report = await verifyFinalCleanup(
      () => ({
        remainingProcesses: fixtures.reduce((sum, f) => sum + f.probe().remainingProcesses, 0),
        ownershipReleased: fixtures.every((f) => f.probe().ownershipReleased),
        contextInactive: true,
      }),
      { maximumMs: 60, intervalMs: 10 },
    );
    expect(report.immediate.remainingProcesses).toBe(2);
    expect(report.final.remainingProcesses).toBe(2);
    expect(report.verified).toBe(false);
    await Promise.all(exited);
    expect(fixtures.every((f) => f.probe().remainingProcesses === 0)).toBe(true);
    expect(report.final.remainingProcesses).toBe(2);
    expect(report.verified).toBe(false);
  } finally {
    await Promise.all(fixtures.map((f) => f.close()));
  }
});

it.each([
  { remainingProcesses: 0, ownershipReleased: false, contextInactive: true },
  { remainingProcesses: 0, ownershipReleased: true, contextInactive: false },
])('fails on retained ownership or active context even when processes are zero', async (state) => {
  const report = await verifyFinalCleanup(() => state, { maximumMs: 0 });
  expect(report.verified).toBe(false);
  expect(report.checks).toBe(2);
});

it('never launders a teardown exception into success when the final snapshot is clean', async () => {
  const report = await verifyFinalCleanup(
    () => ({ remainingProcesses: 0, ownershipReleased: true, contextInactive: true }),
    { teardownFailed: true, maximumMs: 0 },
  );
  expect(report.final.probeFailed).toBe(false);
  expect(report.verified).toBe(false);
});

it('takes a separate final sample and catches ownership appearing after immediate teardown', async () => {
  let checks = 0;
  const report = await verifyFinalCleanup(
    () => ({ remainingProcesses: 0, ownershipReleased: ++checks === 1, contextInactive: true }),
    { maximumMs: 0 },
  );
  expect(report.immediate.ownershipReleased).toBe(true);
  expect(report.final.ownershipReleased).toBe(false);
  expect(report.verified).toBe(false);
});

it('redacts probe exceptions and extra fields, while failing an unknown immediate observation', async () => {
  let checks = 0;
  const secret = 'private-path-identifier-and-command';
  const report = await verifyFinalCleanup(
    () => {
      if (++checks === 1) throw new Error(secret);
      return { remainingProcesses: 0, ownershipReleased: true, contextInactive: true, secret };
    },
    { maximumMs: 0 },
  );
  expect(report.immediate.remainingProcesses).toBe(null);
  expect(report.final.remainingProcesses).toBe(0);
  expect(report.verified).toBe(false);
  expect(JSON.stringify(report)).not.toContain(secret);
});

it('uses a monotonic bounded wait and fails invalid process counts', async () => {
  let now = 0;
  const report = await verifyFinalCleanup(
    () => ({ remainingProcesses: 1, ownershipReleased: false, contextInactive: true }),
    {
      maximumMs: 250,
      intervalMs: 100,
      now: () => now,
      wait: async (milliseconds) => {
        now += milliseconds;
      },
    },
  );
  expect(report.elapsedMs).toBe(250);
  expect(report.checks).toBe(4);
  expect(report.verified).toBe(false);
  const invalid = await verifyFinalCleanup(
    () => ({ remainingProcesses: -1, ownershipReleased: true, contextInactive: true }),
    { maximumMs: 0 },
  );
  expect(invalid.verified).toBe(false);
  expect(invalid.final.probeFailed).toBe(true);
  await expect(
    verifyFinalCleanup(
      () => ({ remainingProcesses: 0, ownershipReleased: true, contextInactive: true }),
      { maximumMs: 5001 },
    ),
  ).rejects.toThrow('INVALID_CLEANUP_BOUND');
});
