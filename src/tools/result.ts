import { ReadLimitError } from '../safety/read-limit.js';
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
import { BrowserSafetyError } from '../browser/safety.js';
import { SafetyStateError } from '../safety/state-lock.js';
import { PreviewError } from '../safety/write-preview.js';
import { GuardBlockedError } from '../browser/guard.js';

export interface ToolMeta {
  fetchedAt: string;
  source: 'voyager' | 'dom' | 'engine';
  contractVersion: 1;
  partial: boolean;
  status: 'ok' | 'empty' | 'partial';
  nextCursor?: string;
  pagination?: {
    offset: number;
    count: number;
    continuation: 'available' | 'end' | 'unknown' | 'unsupported';
  };
}

type McpText = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

/** Wrap shaped data + provenance metadata into an MCP text result. */
export function ok(
  data: unknown,
  source: ToolMeta['source'] = 'voyager',
  partial = false,
  extra: Pick<ToolMeta, 'nextCursor' | 'pagination'> & Partial<Pick<ToolMeta, 'status'>> = {},
): McpText {
  const { status, ...pagination } = extra;
  const meta: ToolMeta = {
    contractVersion: 1,
    fetchedAt: new Date().toISOString(),
    source,
    partial,
    status: partial
      ? 'partial'
      : (status ?? (Array.isArray(data) && data.length === 0 ? 'empty' : 'ok')),
    ...pagination,
  };
  const structuredContent = { data, meta };
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export class ToolError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
const messages: Record<string, string> = {
  READ_LIMIT_REACHED:
    'The bounded brief stopped at its explicit read attempt ceiling. No automatic retry or further page was requested.',
  INTERNAL_ERROR:
    'The tool failed. Check local setup and safety-state storage; unreadable or invalid state must be repaired before retrying.',
  RESPONSE_SHAPE_CHANGED:
    'The provider response did not match the supported contract. Stop and review compatibility evidence.',
  CANCELLED: 'The request was cancelled before execution.',
  INVALID_CURSOR: 'The cursor is invalid or does not match this tool, query and page size.',
  UNSUPPORTED_PAGINATION:
    'This route has no verified continuation. Only a bounded first page is supported.',
  PROVIDER_ERROR: 'The provider returned an error instead of usable data.',
  PREVIEW_REQUIRED:
    'Request a preview, show its exact action to the human, and use its operationId and token after explicit approval. Retained operation IDs can still be looked up without a token.',
  PREVIEW_EXPIRED: 'The five-minute preview expired. Review a new preview before submitting.',
  PREVIEW_LIMIT: 'Too many outstanding previews. Wait for expiry before requesting more.',
  PREVIEW_CHANGED:
    'The target or content differs from the reviewed preview. Review a new preview before approval.',
  WRITE_DISABLED:
    'Browser writes are disabled. Review the preview and enable LINKEDIN_ENABLE_WRITES only for deliberately approved alpha actions.',
  UNVERIFIED_ROUTE:
    'Starting new message threads has no current successful integration evidence. It requires the separate experimental opt-in.',
};
export function failure(tool: string, code: string, hint?: string): McpText {
  const structuredContent = {
    data: null,
    meta: {
      contractVersion: 1,
      fetchedAt: new Date().toISOString(),
      source: 'engine',
      partial: false,
      status: 'error',
    },
    error:
      messages[code] ?? `The tool stopped (${code}). Check health_check for recovery guidance.`,
    tool,
    code,
    ...(hint ? { hint } : {}),
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
    isError: true,
  };
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
    const code =
      err instanceof ReadLimitError ||
      err instanceof PreviewError ||
      err instanceof ToolError ||
      err instanceof VoyagerError ||
      err instanceof BrowserSafetyError ||
      err instanceof GuardBlockedError ||
      err instanceof SafetyStateError
        ? err.code
        : 'INTERNAL_ERROR';
    // Exception messages can contain request URLs, provider payloads or browser paths.
    logger.error(`Tool ${tool} failed`, { code });

    const hint =
      code === 'CHECKPOINT_REQUIRED' || code === 'CIRCUIT_OPEN'
        ? 'Stop automation. Resolve the checkpoint manually with --login, then restart the server. A restart alone does not clear the stop.'
        : code === 'AUTH_REQUIRED'
          ? 'Run `linkedin-mcp --login` (a real Chrome window opens; log in once).'
          : code === 'CLOUDFLARE_BLOCKED'
            ? 'Stop automation and resolve the challenge manually with --login.'
            : code === 'RATE_LIMITED'
              ? 'Slow down — LinkedIn rate-limited the request. Wait before retrying.'
              : undefined;

    return failure(tool, code, hint);
  }
}
