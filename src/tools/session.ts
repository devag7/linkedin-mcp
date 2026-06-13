/**
 * Session & utility tools: whoami, health_check, login_status, close_session.
 * These describe and control the browser engine itself.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BrowserEngine } from '../browser/engine.js';
import type { Logger } from '../types.js';
import { ok, run } from './result.js';

const VERSION = '2.0.0-alpha.1';

export function registerSessionTools(
  server: McpServer,
  engine: BrowserEngine,
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
    'Check whether the browser session exists and is authenticated. Does not guarantee Voyager access.',
    {},
    async () =>
      run(logger, 'health_check', async () => {
        const loggedIn = await engine.isLoggedIn().catch(() => false);
        return ok({ status: loggedIn ? 'authenticated' : 'logged_out', version: VERSION }, 'engine');
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
