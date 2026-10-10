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
import { AccountBinding } from './browser/account.js';
import { Guard } from './browser/guard.js';
import { SerialQueue } from './safety/queue.js';
import { HumanPacer } from './safety/pacer.js';
import { BudgetTracker, type BudgetTrackerOptions } from './safety/budgets.js';
import { CircuitBreaker } from './safety/circuit-breaker.js';
import { CircuitFileStorage, circuitStatePath } from './safety/circuit-storage.js';
import { BrowserSafety } from './browser/safety.js';
import { registerSessionTools } from './tools/session.js';
import { registerProfileTools } from './tools/profile.js';
import { registerFeedTools } from './tools/feed.js';
import { registerDiscoveryTools } from './tools/discovery.js';
import { registerWriteTools } from './tools/write.js';
import { registerResearchTools } from './tools/research.js';
import { VERSION } from './version.js';
import { registeredToolNames } from './tools/register.js';
import type { CapabilityPolicy } from './tools/capabilities.js';

export interface CreatedServer {
  server: McpServer;
  engine: BrowserEngine;
}

/** Process-owned state; HTTP protocol connections must never recreate it. */
export function createRuntime(
  logger: Logger,
  manageSignals = true,
  budgetOptions: Pick<BudgetTrackerOptions, 'storagePath'> = {},
) {
  const config = loadConfig();
  const breaker = new CircuitBreaker({
    logger,
    storage: new CircuitFileStorage(circuitStatePath(config.LINKEDIN_PROFILE_DIR)),
  });
  const safety = new BrowserSafety(breaker);
  const engine = new BrowserEngine(config, logger, manageSignals, safety);
  const budget = new BudgetTracker(null, { ...budgetOptions, logger });
  const identity = new AccountBinding(engine, new VoyagerClient(engine, logger, safety), budget);
  const voyager = new VoyagerClient(engine, logger, safety, (write) => identity.ensure(write));

  // Safety stack — every data/action call is gated through the Guard.
  const queue = new SerialQueue({ concurrency: config.LINKEDIN_CONCURRENCY, logger });
  const pacer = new HumanPacer({ logger });
  const guard = new Guard(queue, pacer, budget, breaker, logger, () => identity.ensure());

  return { engine, voyager, queue, pacer, budget, breaker, guard, identity };
}

export type ServerRuntime = Omit<ReturnType<typeof createRuntime>, 'identity'> & {
  identity?: AccountBinding;
};

/** Create a protocol server, optionally using an existing process runtime. */
export function createServer(
  logger: Logger,
  runtime: ServerRuntime = createRuntime(logger),
  policy: CapabilityPolicy = {
    writesEnabled: loadConfig().LINKEDIN_ENABLE_WRITES,
    experimentalMessagesEnabled: loadConfig().LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES,
  },
): CreatedServer {
  const server = new McpServer(
    { name: 'linkedin-mcp', version: VERSION },
    { capabilities: { tools: {} } },
  );
  const { engine, voyager, budget, guard } = runtime;

  // Registered tool groups (grows per build milestones M1–M4).
  registerSessionTools(
    server,
    engine,
    voyager,
    budget,
    logger,
    () => registeredToolNames(server).length,
    guard,
    runtime.breaker,
    policy,
    runtime.identity,
  );
  registerProfileTools(server, voyager, guard, logger);
  registerFeedTools(server, voyager, guard, logger);
  registerDiscoveryTools(server, voyager, engine, guard, logger);
  registerWriteTools(server, voyager, guard, logger, policy);
  registerResearchTools(server, logger);
  logger.info('MCP server created', {
    version: VERSION,
    tools: registeredToolNames(server).length,
  });
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

  if (config.transport === 'stdio') {
    const runtime = createRuntime(logger, false);
    const { server } = createServer(logger, runtime);
    try {
      await connectStdio(server, logger, async () => {
        runtime.queue.clear();
        await runtime.engine.dispose();
      });
    } catch (error) {
      await runtime.engine.dispose();
      throw error;
    }
  } else {
    const runtime = createRuntime(logger, false);
    const listener = await startHttpServer(
      () => createServer(logger, runtime).server,
      config.port,
      logger,
      {
        token: process.env.LINKEDIN_HTTP_TOKEN,
        shutdown: async () => {
          runtime.queue.clear();
          await runtime.engine.dispose();
        },
      },
    );
    const shutdown = () => {
      runtime.queue.clear();
      void listener.close().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    process.once('SIGHUP', shutdown);
  }
}
