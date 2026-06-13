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
import { registerSessionTools } from './tools/session.js';
import { registerProfileTools } from './tools/profile.js';

const VERSION = '2.0.0';

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

  // Registered tool groups (grows per build milestones M1–M4).
  let count = 0;
  registerSessionTools(server, engine, logger, () => count);
  registerProfileTools(server, voyager, logger);
  // session(3) + profile(2). Update as groups are added.
  count = 5;

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
