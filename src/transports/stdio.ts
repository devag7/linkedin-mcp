/**
 * stdio Transport — for local/CLI usage.
 *
 * Uses the official MCP SDK StdioServerTransport.
 * This is the simplest transport — reads JSON-RPC from stdin, writes to stdout.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../types.js';

/**
 * Connect the MCP server to stdio transport.
 * This blocks until the process is terminated.
 */
export async function connectStdio(
  server: McpServer,
  logger: Logger,
  cleanup: () => Promise<void> = async () => {},
): Promise<void> {
  const transport = new StdioServerTransport();

  logger.info('Connecting via stdio transport');

  await server.connect(transport);

  logger.info('LinkedIn MCP Server running on stdio');

  let stopping: Promise<void> | undefined;
  const stop = (): Promise<void> =>
    (stopping ??= (async () => {
      await cleanup();
      await server.close();
    })());
  server.server.onclose = () => {
    void stop().catch(() => {
      process.exitCode = 1;
    });
  };
  const signal = () => {
    void stop().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.once('SIGINT', signal);
  process.once('SIGTERM', signal);
  process.once('SIGHUP', signal);
  process.once('beforeExit', () => {
    void stop().catch(() => {
      process.exitCode = 1;
    });
  });
}
