/** Disposable protocol/timeout fixtures only; no Chrome or LinkedIn account. */
import { expect, it, vi } from 'vitest';
import { VoyagerClient } from '../src/browser/voyager.js';
import {
  installSearchOnlyRequestGuard,
  monitorValidationProcesses,
  boundedValidationTeardown,
  teardownValidationSession,
} from '../scripts/search-only-validation-support.js';
import { searchOnlyObservation } from '../scripts/search-only-observation.js';
import { renderBrief } from '../src/tools/research.js';
import { ok } from '../src/tools/result.js';
import {
  PROCESS_ACCOUNTING_KEYS,
  type ProcessAccountingCounts,
} from '../scripts/validation-processes.js';

it('enforces a shared two-GET limit across identity/data instances and blocks all other methods', async () => {
  const prototype = Object.create(VoyagerClient.prototype) as typeof VoyagerClient.prototype;
  const original = vi.fn(async () => ({ synthetic: true }));
  prototype.voyagerGet = original as typeof prototype.voyagerGet;
  const guard = installSearchOnlyRequestGuard(prototype, '/me', '/search');
  const identity = Object.create(prototype) as VoyagerClient;
  const data = Object.create(prototype) as VoyagerClient;
  try {
    await identity.voyagerGet('/me');
    await data.voyagerGet('/search');
    await expect(data.voyagerGet('/search')).rejects.toThrow('SEARCH_ONLY_SCOPE_STOP');
    await expect(data.voyagerGet('/unknown-private-path')).rejects.toThrow(
      'SEARCH_ONLY_SCOPE_STOP',
    );
    await expect(data.voyagerGraphql('private', 'private')).rejects.toThrow(
      'SEARCH_ONLY_SCOPE_STOP',
    );
    await expect(data.voyagerPost('/private', {})).rejects.toThrow('SEARCH_ONLY_SCOPE_STOP');
    await expect(data.voyagerPostRaw('/private', {})).rejects.toThrow('SEARCH_ONLY_SCOPE_STOP');
    await expect(data.voyagerDeleteRaw('/private')).rejects.toThrow('SEARCH_ONLY_SCOPE_STOP');
    expect(original).toHaveBeenCalledTimes(2);
    expect(guard.attempts).toBe(2);
    expect(guard.violations).toBe(6);
  } finally {
    guard.restore();
  }
});
it('stopping before dispatch prevents any read without resetting the counter', async () => {
  const prototype = Object.create(VoyagerClient.prototype) as typeof VoyagerClient.prototype;
  const original = vi.fn(async () => ({}));
  prototype.voyagerGet = original as typeof prototype.voyagerGet;
  const guard = installSearchOnlyRequestGuard(prototype, '/me', '/search');
  try {
    guard.stop();
    await expect(prototype.voyagerGet('/me')).rejects.toThrow();
    expect(original).not.toHaveBeenCalled();
    expect(guard.attempts).toBe(0);
  } finally {
    guard.restore();
  }
});
it('latches a failed periodic inventory and stops the read even when later observations are clean', async () => {
  vi.useFakeTimers();
  let calls = 0;
  const stop = vi.fn();
  const monitor = monitorValidationProcesses(() => {
    if (++calls === 1) throw new Error('private-pid-command-and-path');
    return { remainingProcesses: 0 };
  }, stop);
  try {
    await vi.advanceTimersByTimeAsync(500);
    expect(monitor.failed).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(monitor.sample().remainingProcesses).toBe(0);
    expect(monitor.failed).toBe(true);
  } finally {
    monitor.stop();
    vi.useRealTimers();
  }
});
it('bounded teardown preserves timeout failure after a later natural completion and hides errors', async () => {
  vi.useFakeTimers();
  try {
    let finished = false;
    const result = boundedValidationTeardown(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      finished = true;
    }, 50);
    await vi.advanceTimersByTimeAsync(50);
    const receipt = await result;
    expect(receipt).toEqual({ failed: true, timedOut: true });
    await vi.advanceTimersByTimeAsync(50);
    expect(finished).toBe(true);
    expect(receipt.failed).toBe(true);
    expect(
      await boundedValidationTeardown(async () => {
        throw new Error('private-path');
      }, 50),
    ).toEqual({ failed: true, timedOut: false });
  } finally {
    vi.useRealTimers();
  }
});

it('latches successful-but-uncertain inventories even when later profile counts are zero', () => {
  let calls = 0;
  const stop = vi.fn();
  const counts = Object.fromEntries(
    PROCESS_ACCOUNTING_KEYS.map((key) => [key, 0]),
  ) as ProcessAccountingCounts;
  const monitor = monitorValidationProcesses(
    () => ({
      remainingProcesses: ++calls === 1 ? 1 : 0,
      processAccounting: { ...counts, unclassifiedProfileReferences: calls === 1 ? 1 : 0 },
    }),
    stop,
  );
  try {
    expect(() => monitor.sample()).toThrow('PROCESS_OBSERVATION_FAILED');
    expect(monitor.sample().remainingProcesses).toBe(0);
    expect(monitor.failed).toBe(true);
    expect(stop).toHaveBeenCalledTimes(1);
  } finally {
    monitor.stop();
  }
});

it.each(['dispose', 'session', 'client', 'server'] as const)(
  'the shared runner sequence fails a hanging %s closure without repeating dispose',
  async (stage) => {
    vi.useFakeTimers();
    try {
      const pending = () => new Promise<void>(() => {});
      const dispose = vi.fn(stage === 'dispose' ? pending : async () => {});
      const closeSession = vi.fn(
        stage === 'session' ? () => new Promise<boolean>(() => {}) : async () => true,
      );
      const closeClient = vi.fn(stage === 'client' ? pending : async () => {});
      const closeServer = vi.fn(stage === 'server' ? pending : async () => {});
      const result = teardownValidationSession(
        { dispose, closeSession, closeClient, closeServer },
        50,
      );
      expect(dispose).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(50);
      expect(await result).toMatchObject({ failed: true, timedOut: true });
      expect(dispose).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  },
);
it('the shared runner sequence retains closure failure even with successful dispose and client/server exit', async () => {
  const result = await teardownValidationSession({
    dispose: async () => {},
    closeSession: async () => false,
    closeClient: async () => {},
    closeServer: async () => {},
  });
  expect(result).toEqual({ failed: true, timedOut: false, closeSession: false });
});
it.each([-1, NaN, Infinity, 0.5])(
  'fails malformed process counters without certifying clean: %s',
  (count) => {
    const stop = vi.fn();
    const monitor = monitorValidationProcesses(() => ({ remainingProcesses: count }), stop);
    try {
      expect(() => monitor.sample()).toThrow('PROCESS_OBSERVATION_FAILED');
      expect(monitor.failed).toBe(true);
      expect(stop).toHaveBeenCalledTimes(1);
    } finally {
      monitor.stop();
    }
  },
);

function fixture(titleOnly = false) {
  const time = new Date().toISOString();
  const sourceUrl = 'https://www.linkedin.com/jobs/view/123456789/';
  const facts = [
    {
      field: 'title' as const,
      value: 'PRIVATE_TITLE',
      sourceUrl,
      fetchedAt: time,
      sourceTool: 'search_jobs' as const,
      truncated: false,
    },
    ...(titleOnly
      ? []
      : [
          {
            field: 'location' as const,
            value: 'PRIVATE_LOCATION',
            sourceUrl,
            fetchedAt: time,
            sourceTool: 'search_jobs' as const,
            truncated: false,
          },
        ]),
  ];
  const brief = {
    topic: 'Synthetic',
    query: { keywords: 'Synthetic', count: 10, enrichFirst: false as const },
    generatedAt: time,
    status: 'partial' as const,
    comparisonEvidence: {
      sufficientEntities: titleOnly ? 0 : 1,
      insufficientEntities: titleOnly ? 1 : 0,
    },
    scope: 'One first-page job search only. Source observations, not recommendations.' as const,
    bounds: {
      maxReadAttempts: 2 as const,
      readAttempts: 2,
      maxEntities: 10 as const,
      maxToolCalls: 1 as const,
      toolCalls: 1,
    },
    entities: [{ sourceUrl, facts, unknownFields: ['listedAt'] }],
    reads: [{ tool: 'search_jobs' as const, status: 'partial' as const, fetchedAt: time }],
    gaps: ['Partial page'],
    nextSteps: ['Inspect manually'],
  };
  return ok({ ...brief, markdown: renderBrief(brief) }, 'engine', true, { status: 'partial' });
}
it('retains only counts/status/field-presence while verifying source-linked useful partial facts', () => {
  const now = Date.now();
  const observed = searchOnlyObservation(fixture(), now - 1000, now + 1000);
  expect(observed).toMatchObject({
    usefulEntities: 1,
    fieldPresence: { title: 1, location: 1, listedAt: 0 },
    dataStatus: 'partial',
    metaStatus: 'partial',
    readAttempts: 2,
    toolCalls: 1,
    readFailed: false,
  });
  expect(JSON.stringify(observed)).not.toMatch(
    /PRIVATE_|123456789|linkedin\.com|sourceUrl|fetchedAt|markdown/,
  );
  expect(searchOnlyObservation(fixture(true), now - 1000, now + 1000).usefulEntities).toBe(0);
});
it('fails validation for broken source attribution, stale fetches and contradictory status', () => {
  const now = Date.now();
  for (const kind of ['source', 'freshness', 'status'] as const) {
    const incoming = fixture();
    const structured = incoming.structuredContent as any;
    if (kind === 'source')
      structured.data.entities[0].facts[0].sourceUrl = 'https://www.linkedin.com/jobs/view/999/';
    if (kind === 'freshness')
      structured.data.entities[0].facts[0].fetchedAt = '2000-01-01T00:00:00.000Z';
    if (kind === 'status') structured.meta.status = 'ok';
    incoming.content[0]!.text = JSON.stringify(structured);
    expect(() => searchOnlyObservation(incoming, now - 1000, now + 1000)).toThrow();
  }
});
