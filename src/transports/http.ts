/** Local-only Streamable HTTP. Protocol connections share a process runtime. */
import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../types.js';
import { VERSION } from '../version.js';

export interface HttpOptions {
  token?: string;
  shutdown: () => Promise<void>;
  /** Internal test seams; the CLI uses the bounded defaults. */
  maxBodyBytes?: number;
  bodyTimeoutMs?: number;
  requestTimeoutMs?: number;
}

export interface HttpListener {
  server: http.Server;
  close: () => Promise<void>;
}

class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function reply(res: http.ServerResponse, status: number, message: string): void {
  if (res.destroyed || res.writableEnded) return;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
  res.end(JSON.stringify({ error: message }));
}

/** No remote-bind option: a static local token is not a remote auth product. */
export async function startHttpServer(
  createProtocolServer: () => McpServer,
  port: number,
  logger: Logger,
  options: HttpOptions,
): Promise<HttpListener> {
  const token = options.token;
  if (!token || !/^[A-Za-z0-9_-]{32,256}$/.test(token)) {
    throw new Error(
      'HTTP requires LINKEDIN_HTTP_TOKEN (32–256 letters, digits, _ or -). Use a randomly generated secret.',
    );
  }
  const expectedAuth = Buffer.from(`Bearer ${token}`);
  const maxBodyBytes = options.maxBodyBytes ?? 1024 * 1024;
  const bodyTimeoutMs = options.bodyTimeoutMs ?? 10_000;
  const requestTimeoutMs = options.requestTimeoutMs ?? 180_000;
  const connections = new Set<() => Promise<void>>();
  let closing: Promise<void> | undefined;
  let boundPort = port;

  const httpServer = http.createServer({ maxHeaderSize: 16 * 1024 }, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    for (const name of ['host', 'origin', 'authorization']) {
      let count = 0;
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        if (req.rawHeaders[i]?.toLowerCase() === name) count++;
      }
      if (count > 1) {
        reply(res, 400, 'Duplicate security header.');
        return;
      }
    }
    // Never trust Forwarded/X-Forwarded-* to authorize a request.
    if (
      req.socket.remoteAddress !== '127.0.0.1' ||
      ![`127.0.0.1:${boundPort}`, `localhost:${boundPort}`].includes(req.headers.host ?? '')
    ) {
      reply(res, 403, 'Only direct loopback requests are supported.');
      return;
    }
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== `http://${req.headers.host}`) {
      reply(res, 403, 'Origin is not allowed.');
      return;
    }
    const auth = Buffer.from(req.headers.authorization ?? '');
    if (auth.length !== expectedAuth.length || !timingSafeEqual(auth, expectedAuth)) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="linkedin-mcp-local"');
      reply(res, 401, 'A valid local HTTP bearer token is required.');
      return;
    }
    if (closing) {
      reply(res, 503, 'Server is shutting down.');
      return;
    }
    // Exact paths also reject absolute-form URLs and credential-bearing queries.
    if ((req.url === '/health' || req.url === '/') && req.method === 'GET') {
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
    if (req.url !== '/mcp') {
      reply(res, 404, 'Not found. Use POST /mcp.');
      return;
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      reply(res, 405, 'Only POST is supported; browser CORS and remote access are unsupported.');
      return;
    }
    if (
      req.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json' ||
      (req.headers['content-encoding'] !== undefined &&
        req.headers['content-encoding'] !== 'identity')
    ) {
      reply(res, 415, 'An uncompressed application/json body is required.');
      return;
    }
    if (connections.size >= 16) {
      reply(res, 503, 'Too many active HTTP requests.');
      return;
    }

    let server: McpServer | undefined;
    let transport: StreamableHTTPServerTransport | undefined;
    let cleaned = false;
    const cleanup = async () => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(deadline);
      connections.delete(cleanup);
      // Close only this protocol connection; the browser belongs to the process.
      await Promise.allSettled([server?.close(), transport?.close()]);
    };
    const deadline = setTimeout(() => {
      reply(
        res,
        504,
        'Request deadline exceeded. An action may still complete; check its outcome before retrying.',
      );
      void cleanup();
    }, requestTimeoutMs);
    deadline.unref();
    connections.add(cleanup);
    // Register BEFORE dispatch: handleRequest may finish the response itself.
    res.once('close', () => void cleanup());
    res.once('finish', () => void cleanup());
    try {
      const body = await readBody(req, res, maxBodyBytes, bodyTimeoutMs);
      if (cleaned || res.destroyed) return;
      server = createProtocolServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await server.connect(transport);
      if (cleaned) {
        await server.close();
        return;
      }
      await transport.handleRequest(req, res, body);
    } catch (error) {
      // Do not log request contents, auth headers, or SDK error messages.
      if (error instanceof RequestError) reply(res, error.status, error.message);
      else {
        logger.error('HTTP request failed');
        reply(res, 500, 'Internal server error');
      }
      await cleanup();
    }
  });
  httpServer.headersTimeout = 10_000;
  httpServer.requestTimeout = bodyTimeoutMs;
  httpServer.timeout = requestTimeoutMs;
  httpServer.keepAliveTimeout = 5_000;
  httpServer.maxConnections = 32;
  httpServer.on('timeout', (socket) => socket.destroy());

  const close = (): Promise<void> => {
    closing ??= (async () => {
      const stopped = new Promise<void>((resolve) => httpServer.close(() => resolve()));
      httpServer.closeAllConnections();
      await Promise.allSettled([...connections].map((cleanup) => cleanup()));
      await stopped;
      await options.shutdown();
    })();
    return closing;
  };
  try {
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, '127.0.0.1', () => {
        httpServer.off('error', reject);
        const address = httpServer.address();
        if (address && typeof address !== 'string') boundPort = address.port;
        resolve();
      });
    });
  } catch (error) {
    await close();
    throw error;
  }
  logger.info(`LinkedIn MCP HTTP listening locally at http://127.0.0.1:${boundPort}/mcp`);
  return { server: httpServer, close };
}

function readBody(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  maxBytes: number,
  timeoutMs: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (error?: RequestError, value?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('aborted', onError);
      res.off('close', onError);
      if (error) {
        req.resume();
        reject(error);
      } else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) finish(new RequestError(413, 'Request body is too large.'));
      else chunks.push(chunk);
    };
    const onEnd = () => {
      try {
        finish(undefined, JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        finish(new RequestError(400, 'Invalid JSON body.'));
      }
    };
    const onError = () => finish(new RequestError(400, 'Request interrupted.'));
    const timer = setTimeout(
      () => finish(new RequestError(408, 'Request body deadline exceeded.')),
      timeoutMs,
    );
    timer.unref();
    req.on('data', onData);
    req.once('end', onEnd);
    req.once('error', onError);
    req.once('aborted', onError);
    res.once('close', onError);
    const length = Number(req.headers['content-length']);
    if (Number.isFinite(length) && length > maxBytes)
      finish(new RequestError(413, 'Request body is too large.'));
  });
}
