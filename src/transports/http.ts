/**
 * Streamable HTTP Transport — for remote, zero-install usage.
 *
 * Uses the official MCP SDK StreamableHTTPServerTransport in STATELESS mode.
 * Each request creates a fresh server + transport pair, but SHARES the
 * underlying LinkedInClient (with rate limiting and caching) across requests.
 *
 * Architecture:
 * - Shared: AuthManager, LinkedInClient, RateLimiter, Cache
 * - Per-request: McpServer, StreamableHTTPServerTransport
 *
 * This ensures rate limiting and caching work correctly while maintaining
 * the stateless HTTP semantics required by the MCP SDK.
 *
 * Based on the official SDK example: simpleStatelessStreamableHttp.js
 */

import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../types.js';
import { createServer, createSharedDependencies, VERSION } from '../server.js';

/** Maximum request body size (1 MB) */
const MAX_BODY_SIZE = 1 * 1024 * 1024;

/**
 * Start an HTTP server with Streamable HTTP transport (stateless mode).
 *
 * Creates shared dependencies (auth, client with rate limiter + cache) once,
 * then reuses them across all requests. Each request gets a fresh MCP server
 * and transport for stateless semantics, but they share the LinkedIn client.
 */
export async function startHttpServer(
  _server: McpServer,
  port: number,
  logger: Logger,
): Promise<void> {
  // Create shared dependencies ONCE — rate limiter and cache persist across requests
  const shared = createSharedDependencies(logger);

  // Read CORS origin from environment, default to restrictive localhost
  const corsOrigin = process.env['CORS_ORIGIN'] ?? `http://localhost:${port}`;

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);

    // CORS headers — configurable via CORS_ORIGIN env var
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
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
          server: 'linkedin-mcp',
          version: VERSION,
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

    // Handle POST /mcp — stateless: create server + transport per request, reuse shared deps
    if (req.method === 'POST') {
      try {
        // Read request body with size limit
        const body = await readBody(req, MAX_BODY_SIZE);

        // Create a fresh MCP server that reuses shared auth + client
        const server = createServer(logger, shared);

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
        const message = error instanceof Error ? error.message : String(error);

        // Handle body too large
        if (message === 'Request body too large') {
          if (!res.headersSent) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32600,
                  message: 'Request body too large (max 1 MB)',
                },
                id: null,
              }),
            );
          }
          return;
        }

        logger.error('Error handling MCP request', { error: message });
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
      logger.info(`LinkedIn MCP Server running on http://localhost:${port}/mcp`);
      logger.info('Add this URL to your Claude Desktop config for remote access');
      resolve();
    });
  });
}

/**
 * Read the full request body as parsed JSON, with size limit.
 */
function readBody(req: http.IncomingMessage, maxSize: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let totalSize = 0;
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });

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
