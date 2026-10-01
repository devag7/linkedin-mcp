/** Separate-process fixtures only. No browser launch or network traffic. */
import { BudgetTracker } from '../../src/safety/budgets.js';
import { Guard, ACTIONS } from '../../src/browser/guard.js';
import { SerialQueue } from '../../src/safety/queue.js';
import { HumanPacer } from '../../src/safety/pacer.js';
import { CircuitBreaker } from '../../src/safety/circuit-breaker.js';
import { SafetyStateError } from '../../src/safety/state-lock.js';
import { BrowserEngine } from '../../src/browser/engine.js';
import { loadConfig } from '../../src/config/env.js';
import { Logger } from '../../src/types.js';
import { chromium, type BrowserContext } from 'patchright';
const [mode, file, account = 'shared', prefix = 'worker'] = process.argv.slice(2);
if (!file) throw new Error('Missing fixture path');
if (mode === 'profile') {
  chromium.launchPersistentContext = async () =>
    ({ close: async () => {}, browser: () => null }) as unknown as BrowserContext;
  const engine = new BrowserEngine(
    { ...loadConfig(), LINKEDIN_PROFILE_DIR: file, LINKEDIN_IDLE_TIMEOUT_MS: 0 },
    new Logger('error'),
    false,
    null,
  );
  try {
    await engine.ensureContext();
    await engine.shutdown(); // Ownership must survive idle/close_session.
    process.send?.({ ready: true });
    process.once('message', async () => {
      await engine.dispose();
      process.exit(0);
    });
  } catch (error) {
    process.send?.({ code: error instanceof SafetyStateError ? error.code : 'FAILED' });
    process.exitCode = 1;
  }
} else {
  const budget = new BudgetTracker(account, {
    storagePath: file,
    dailyCaps: { likesComments: 5 },
    combinedWriteCap: 5,
  });
  const guard = new Guard(
    new SerialQueue(),
    { waitBefore: async () => {} } as HumanPacer,
    budget,
    new CircuitBreaker(),
  );
  let submitted = 0;
  process.send?.({ ready: true });
  process.once('message', async () => {
    for (let i = 0; i < 12; i++) {
      const id = mode === 'same-id' ? 'same-operation' : `${prefix}-operation-${i}`;
      for (let retry = 0; retry < 100; retry++) {
        try {
          await guard.runWrite(
            ACTIONS.like,
            'react',
            { target: 'fixture' },
            id,
            async (reserve) => {
              reserve();
              submitted++;
              return { status: 204, ok: true, body: '', type: 'basic' };
            },
          );
          break;
        } catch (error) {
          if (error instanceof SafetyStateError && error.code === 'STATE_BUSY') {
            // Offline contention retry only, never retry a submitted provider request.
            await new Promise((resolve) => setTimeout(resolve, 2));
            continue;
          }
          break;
        }
      }
    }
    process.send?.({ submitted });
    process.disconnect();
  });
}
