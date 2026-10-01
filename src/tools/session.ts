/**
 * Session & utility tools: whoami, health_check, close_session.
 * These describe and control the browser engine itself, and surface a live
 * Voyager probe + the safety budget state so a client can see *before* acting
 * whether the session really works and how much daily headroom remains.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BrowserEngine } from '../browser/engine.js';
import { VoyagerClient, VoyagerError } from '../browser/voyager.js';
import type { BudgetTracker } from '../safety/budgets.js';
import * as ep from '../browser/endpoints.js';
import { ownPublicId, type NormalizedResponse } from '../browser/normalize.js';
import type { Logger } from '../types.js';
import { VERSION } from '../version.js';
import { ok, run } from './result.js';
import { assertReadResponse } from './provider-shape.js';
import { registerTool } from './register.js';
import { capabilityManifest, type CapabilityPolicy } from './capabilities.js';
import { registeredToolNames } from './register.js';
import { Guard, ACTIONS } from '../browser/guard.js';
import type { CircuitBreaker } from '../safety/circuit-breaker.js';
import { SafetyStateError } from '../safety/state-lock.js';
import { BrowserSafetyError } from '../browser/safety.js';
import { type AccountBinding, verifiedAccountKey } from '../browser/account.js';

export function registerSessionTools(
  server: McpServer,
  engine: BrowserEngine,
  voyager: VoyagerClient,
  budget: BudgetTracker,
  logger: Logger,
  toolCount: () => number,
  guard: Guard,
  breaker: CircuitBreaker,
  policy: CapabilityPolicy = { writesEnabled: false, experimentalMessagesEnabled: false },
  identity?: AccountBinding,
): void {
  registerTool(
    server,
    'whoami',
    'Report server version, browser/login status, and capabilities.',
    {},
    async () =>
      run(logger, 'whoami', async () => {
        const loggedIn = engine.hasActiveContext
          ? await engine.isLoggedIn().catch(() => null)
          : null;
        return ok(
          {
            server: 'linkedin-mcp',
            version: VERSION,
            providers: { browser: 'local_unofficial', official: 'unavailable' },
            engine: 'patchright (stealth Chrome)',
            loggedIn,
            sessionState: loggedIn === null ? 'not_checked' : loggedIn ? 'logged_in' : 'logged_out',
            accountResolved: budget.accountResolved,
            tools: toolCount(),
            capabilities: capabilityManifest(policy, registeredToolNames(server)),
            circuitOpen: breaker.isGlobalOpen(),
          },
          'engine',
        );
      }),
  );

  registerTool(
    server,
    'health_check',
    "Deep health check: cookie login state, a LIVE Voyager probe (confirms the API actually answers, not just that a cookie exists), and today's safety-budget headroom (per-action used/cap/remaining + pending invites).",
    {},
    async () =>
      run(logger, 'health_check', async () => {
        // Diagnostics remain available, but must not probe a stopped account.
        const budgetState = budget.snapshot();
        if (breaker.isGlobalOpen() || !budgetState.storageHealthy) {
          return ok(
            {
              status: 'blocked',
              version: VERSION,
              voyager: 'blocked',
              circuitOpen: breaker.isGlobalOpen(),
              reason: !budgetState.storageHealthy
                ? 'Budget storage failed; safety state needs repair.'
                : breaker.getState().globalReason,
              hint: !budgetState.storageHealthy
                ? 'Stop automation and repair safety-state storage before restarting.'
                : 'Resolve the checkpoint manually with --login, then restart the server.',
              budget: budgetState,
            },
            'engine',
          );
        }
        let loggedIn = false;
        let voyagerStatus: 'ok' | 'auth_required' | 'blocked' | 'error' = 'error';
        let publicId: string | undefined;
        let diagnosticCode: string | undefined;
        try {
          // Deliberately launch on a cold saved profile. The guard first binds
          // verified own-member identity; a cookie check alone cannot prove it.
          const response = await guard.run(ACTIONS.readGeneric, async () => {
            if (!(await engine.isLoggedIn()))
              throw new VoyagerError(
                'AUTH_REQUIRED',
                'No authenticated LinkedIn session. Run --login.',
              );
            loggedIn = true;
            return voyager.voyagerGet<NormalizedResponse>(ep.me());
          });
          assertReadResponse(response);
          verifiedAccountKey(response);
          identity?.observe(response);
          publicId = ownPublicId(response);
          voyagerStatus = 'ok';
        } catch (error) {
          diagnosticCode =
            error instanceof VoyagerError ||
            error instanceof BrowserSafetyError ||
            error instanceof SafetyStateError
              ? error.code
              : 'INTERNAL_ERROR';
          voyagerStatus =
            breaker.isGlobalOpen() || error instanceof SafetyStateError
              ? 'blocked'
              : diagnosticCode === 'AUTH_REQUIRED'
                ? 'auth_required'
                : 'error';
        }

        const status =
          voyagerStatus === 'blocked'
            ? 'blocked'
            : voyagerStatus === 'ok'
              ? 'healthy'
              : voyagerStatus === 'auth_required'
                ? 'logged_out'
                : 'degraded';

        return ok(
          {
            status,
            version: VERSION,
            loggedIn,
            ...(diagnosticCode ? { code: diagnosticCode } : {}),
            voyager: voyagerStatus,
            circuitOpen: breaker.isGlobalOpen(),
            ...(breaker.isGlobalOpen()
              ? {
                  reason: breaker.getState().globalReason,
                  hint: 'Resolve the checkpoint manually with --login, then restart the server.',
                }
              : {}),
            ...(publicId ? { publicIdentifier: publicId } : {}),
            budget: budget.snapshot(),
          },
          'engine',
        );
      }),
  );

  registerTool(
    server,
    'close_session',
    'Close Chrome while retaining this runtime’s profile ownership. Stop the server to release the profile.',
    {},
    async () =>
      run(logger, 'close_session', async () => {
        await engine.shutdown();
        return ok({ closed: true }, 'engine');
      }),
  );

  logger.debug('Session tools registered');
}
