/**
 * Streamable HTTP Transport — for remote, zero-install usage.
 *
 * Uses the official MCP SDK StreamableHTTPServerTransport in STATELESS mode.
 * Each request creates a fresh server + transport pair, then tears down.
 *
 * This is the simplest, most reliable approach:
 * - No session management needed
 * - No stale state
 * - Works behind load balancers
 * - Compatible with serverless (Cloudflare Workers, Vercel, etc.)
 *
 * Based on the official SDK example: simpleStatelessStreamableHttp.js
 */

import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../types.js';
import { createServer } from '../server.js';

/**
 * Start an HTTP server with Streamable HTTP transport (stateless mode).
 *
 * Each incoming POST /mcp creates a fresh McpServer + Transport pair,
 * handles the request, then tears down. This is the pattern recommended
 * by the MCP SDK for stateless deployments.
 */
export async function startHttpServer(
  _server: McpServer,
  port: number,
  logger: Logger,
): Promise<void> {
  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);

    // CORS headers for remote access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Accept, Mcp-Session-Id, Last-Event-ID',
    );
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          server: 'linkedin-pro-mcp',
          version: '1.0.0',
          transport: 'streamable-http',
          endpoint: '/mcp',
        }),
      );
      return;
    }

    // Only handle /mcp endpoint
    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. Use POST /mcp for MCP protocol.' }));
      return;
    }

    // Handle POST /mcp — stateless: create server + transport per request
    if (req.method === 'POST') {
      try {
        // Read request body
        const body = await readBody(req);

        // Create a fresh server for this request
        const server = createServer(logger);

        // Create stateless transport (sessionIdGenerator: undefined = stateless)
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });

        // Connect server to transport
        await server.connect(transport);

        // Handle the request
        await transport.handleRequest(req, res, body);

        // Cleanup when response closes
        res.on('close', () => {
          transport.close().catch(() => {});
          server.close().catch(() => {});
        });
      } catch (error) {
        logger.error('Error handling MCP request', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal server error',
              },
              id: null,
            }),
          );
        }
      }
      return;
    }

    // GET and DELETE not supported in stateless mode
    if (req.method === 'GET' || req.method === 'DELETE') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Method not allowed. This server runs in stateless mode.',
          },
          id: null,
        }),
      );
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down HTTP server...');
    httpServer.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down HTTP server...');
    httpServer.close();
    process.exit(0);
  });

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      logger.info(`LinkedIn Pro MCP Server running on http://localhost:${port}/mcp`);
      logger.info('Add this URL to your Claude Desktop config for remote access');
      resolve();
    });
  });
}

/**
 * Read the full request body as parsed JSON.
 */
function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}
