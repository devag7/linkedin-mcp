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

export function registerSessionTools(
  server: McpServer,
  engine: BrowserEngine,
  voyager: VoyagerClient,
  budget: BudgetTracker,
  logger: Logger,
  toolCount: () => number,
): void {
  server.tool(
    'whoami',
    'Report server version, browser/login status, and capabilities.',
    {},
    async () =>
      run(logger, 'whoami', async () => {
        const loggedIn = await engine.isLoggedIn().catch(() => false);
        return ok(
          {
            server: 'linkedin-mcp',
            version: VERSION,
            engine: 'patchright (stealth Chrome)',
            loggedIn,
            tools: toolCount(),
          },
          'engine',
        );
      }),
  );

  server.tool(
    'health_check',
    'Deep health check: cookie login state, a LIVE Voyager probe (confirms the API actually answers, not just that a cookie exists), and today\'s safety-budget headroom (per-action used/cap/remaining + pending invites).',
    {},
    async () =>
      run(logger, 'health_check', async () => {
        const loggedIn = await engine.isLoggedIn().catch(() => false);

        // Live Voyager probe — the part a cookie check cannot tell you: does the
        // API answer right now, or is the session silently dead / challenged?
        let voyagerStatus: 'ok' | 'auth_required' | 'cloudflare_blocked' | 'error' | 'skipped' = 'skipped';
        let publicId: string | undefined;
        if (loggedIn) {
          try {
            const me = await voyager.voyagerGet<NormalizedResponse>(ep.me());
            publicId = ownPublicId(me);
            voyagerStatus = publicId ? 'ok' : 'error';
          } catch (err) {
            voyagerStatus =
              err instanceof VoyagerError && err.code === 'AUTH_REQUIRED'
                ? 'auth_required'
                : err instanceof VoyagerError && err.code === 'CLOUDFLARE_BLOCKED'
                  ? 'cloudflare_blocked'
                  : 'error';
          }
        }

        const status =
          voyagerStatus === 'ok' ? 'healthy' : loggedIn ? 'degraded' : 'logged_out';

        return ok(
          {
            status,
            version: VERSION,
            loggedIn,
            voyager: voyagerStatus,
            ...(publicId ? { publicIdentifier: publicId } : {}),
            budget: budget.snapshot(),
          },
          'engine',
        );
      }),
  );

  server.tool(
    'close_session',
    'Close the browser context and release resources (kills the Chrome process).',
    {},
    async () =>
      run(logger, 'close_session', async () => {
        await engine.shutdown();
        return ok({ closed: true }, 'engine');
      }),
  );

  logger.debug('Session tools registered');
}
