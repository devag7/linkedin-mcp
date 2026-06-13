/**
 * Shared MCP tool-result helpers for v2 tools.
 *
 * Every tool returns a compact, shaped object wrapped in `{ data, meta }` so the
 * Voyager-API path and the DOM-fallback path are interchangeable to the client.
 * Errors are surfaced as structured, actionable JSON (never raw stack dumps),
 * and the server never crashes on a tool failure.
 */

import type { Logger } from '../types.js';
import { VoyagerError } from '../browser/voyager.js';

export interface ToolMeta {
  fetchedAt: string;
  source: 'voyager' | 'dom' | 'engine';
  partial?: boolean;
}

type McpText = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

/** Wrap shaped data + provenance metadata into an MCP text result. */
export function ok(data: unknown, source: ToolMeta['source'] = 'voyager', partial = false): McpText {
  const meta: ToolMeta = { fetchedAt: new Date().toISOString(), source };
  if (partial) meta.partial = true;
  return { content: [{ type: 'text', text: JSON.stringify({ data, meta }, null, 2) }] };
}

/**
 * Run a tool body with structured error handling. VoyagerError codes map to
 * actionable messages; anything else is reported without crashing the server.
 */
export async function run(
  logger: Logger,
  tool: string,
  fn: () => Promise<McpText>,
): Promise<McpText> {
  try {
    return await fn();
  } catch (err) {
    const isVoyager = err instanceof VoyagerError;
    const code = isVoyager ? err.code : 'INTERNAL_ERROR';
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Tool ${tool} failed`, { code, error: message });

    const hint =
      code === 'AUTH_REQUIRED'
        ? 'Run `linkedin-mcp --login` (a real Chrome window opens; log in once).'
        : code === 'CLOUDFLARE_BLOCKED'
          ? 'LinkedIn served a challenge. Re-run --login headful on a clean residential IP and try again.'
          : code === 'RATE_LIMITED'
            ? 'Slow down — LinkedIn rate-limited the request. Wait before retrying.'
            : undefined;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: message, tool, code, ...(hint ? { hint } : {}) }),
        },
      ],
      isError: true,
    };
  }
}
