/**
 * LinkedIn MCP Server — v2 core (stealth-browser engine).
 *
 * v2 drives a real Chrome via patchright to pass Cloudflare, then queries
 * LinkedIn's Voyager API from inside the authenticated page (see browser/).
 * The v1 stateless-fetch tools are removed — they returned 0 data behind
 * Cloudflare. Tools are added incrementally per the build plan (M1 → M4).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfig } from './config/env.js';
import type { ServerConfig } from './types.js';
import { Logger } from './types.js';
import { connectStdio } from './transports/stdio.js';
import { startHttpServer } from './transports/http.js';
import { BrowserEngine } from './browser/engine.js';
import { VoyagerClient } from './browser/voyager.js';
import { Guard } from './browser/guard.js';
import { SerialQueue } from './safety/queue.js';
import { HumanPacer } from './safety/pacer.js';
import { BudgetTracker } from './safety/budgets.js';
import { CircuitBreaker } from './safety/circuit-breaker.js';
import { registerSessionTools } from './tools/session.js';
import { registerProfileTools } from './tools/profile.js';
import { registerFeedTools } from './tools/feed.js';

const VERSION = '2.0.0-alpha.1';

export interface CreatedServer {
  server: McpServer;
  engine: BrowserEngine;
}

/** Create the MCP server with the browser engine and all registered tools. */
export function createServer(logger: Logger): CreatedServer {
  const server = new McpServer(
    { name: 'linkedin-mcp', version: VERSION },
    { capabilities: { tools: {} } },
  );

  const config = loadConfig();
  const engine = new BrowserEngine(config, logger);
  const voyager = new VoyagerClient(engine, logger);

  // Safety stack — every data/action call is gated through the Guard.
  const queue = new SerialQueue({ concurrency: config.LINKEDIN_CONCURRENCY, logger });
  const pacer = new HumanPacer({ logger });
  const budget = new BudgetTracker('default', { logger });
  const breaker = new CircuitBreaker({ logger });
  const guard = new Guard(queue, pacer, budget, breaker, logger);

  // Registered tool groups (grows per build milestones M1–M4).
  let count = 0;
  registerSessionTools(server, engine, logger, () => count);
  registerProfileTools(server, voyager, guard, logger);
  registerFeedTools(server, voyager, guard, logger);
  // session(3) + profile(2) + feed(2).
  count = 7;

  logger.info('MCP server created', { version: VERSION, tools: count });
  return { server, engine };
}

/** Start the MCP server with the configured transport. */
export async function startServer(config: ServerConfig): Promise<void> {
  const logger = new Logger(config.logLevel);
  logger.info('Starting LinkedIn MCP Server', {
    version: VERSION,
    transport: config.transport,
    port: config.transport === 'http' ? config.port : undefined,
  });

  const { server } = createServer(logger);

  if (config.transport === 'stdio') {
    await connectStdio(server, logger);
  } else {
    await startHttpServer(server, config.port, logger);
  }
}
