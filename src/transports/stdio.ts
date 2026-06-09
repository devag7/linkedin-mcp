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
export async function connectStdio(server: McpServer, logger: Logger): Promise<void> {
  const transport = new StdioServerTransport();

  logger.info('Connecting via stdio transport');

  await server.connect(transport);

  logger.info('LinkedIn MCP Server running on stdio');

  // Keep the process alive
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await server.close();
    process.exit(0);
  });
}
