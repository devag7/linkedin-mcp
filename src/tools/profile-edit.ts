/**
 * Profile-edit write tools (headline + About).
 *
 * These drive the real LinkedIn editor UI (see src/browser/profileedit.ts for
 * why a replayed HTTP call cannot work here) and are gated exactly like the
 * other alpha writes: a preview first, then `confirm:true` with the issued
 * operation id and preview token. The transaction is journalled by the guard,
 * so retrying with the same operation id returns the stored outcome instead of
 * editing the profile twice.
 */

import { createHash } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { BrowserEngine } from '../browser/engine.js';
import type { VoyagerClient } from '../browser/voyager.js';
import type { RawPostResult } from '../browser/voyager.js';
import type { Guard } from '../browser/guard.js';
import { ACTIONS } from '../browser/guard.js';
import type { Logger } from '../types.js';
import { ownFsdId, type NormalizedResponse } from '../browser/normalize.js';
import { updateProfileField } from '../browser/profileedit.js';
import * as ep from '../browser/endpoints.js';
import { ok, run, ToolError } from './result.js';
import { registerTool } from './register.js';
import { confirmField, review } from './write.js';
import { CAPABILITIES, type ToolName, type CapabilityPolicy } from './capabilities.js';

/** Bridge the DOM outcome onto the write-result shape the guard journals. */
function toRaw(
  outcome: {
    saved: boolean;
    verified: boolean;
    httpStatus: number;
    previous: string;
    next: string;
    detail?: string;
  },
  urn: string,
): RawPostResult {
  const httpOk =
    outcome.httpStatus === 0
      ? outcome.saved
      : outcome.httpStatus >= 200 && outcome.httpStatus < 300;
  const okNow = httpOk && outcome.saved && outcome.verified;
  const json = {
    value: urn,
    field: 'profile',
    saved: outcome.saved,
    verified: outcome.verified,
    previous: outcome.previous,
    next: outcome.next,
    ...(outcome.detail ? { detail: outcome.detail } : {}),
  };
  return {
    status: outcome.httpStatus || (outcome.saved ? 200 : 0),
    ok: okNow,
    body: JSON.stringify(json),
    json,
    bodyReadFailed: false,
  };
}

export function registerProfileEditTools(
  server: McpServer,
  engine: BrowserEngine,
  voyager: VoyagerClient,
  guard: Guard,
  logger: Logger,
  policy: CapabilityPolicy = { writesEnabled: false, experimentalMessagesEnabled: false },
): void {
  /** Resolve the caller's own fsd_profile urn (the entity that gets edited). */
  async function ownUrn(): Promise<string> {
    const me = await voyager.voyagerGet<NormalizedResponse>(ep.me());
    const fsd = ownFsdId(me);
    if (!fsd) throw new ToolError('RESPONSE_SHAPE_CHANGED');
    return `urn:li:fsd_profile:${fsd}`;
  }

  /**
   * Shared body for both field tools. `field` names the editable surface and
   * `value` the new text; everything else (preview gate, budget, journal) is
   * identical to the other alpha writes.
   */
  async function performEdit(
    name: ToolName,
    field: 'headline' | 'about',
    value: string,
    confirm: boolean,
    operationId: string | undefined,
    previewHash: string | undefined,
    previewToken: string | undefined,
  ): ReturnType<typeof run> {
    return run(logger, name, async () => {
      const content = { [field]: value };
      const preview = review(
        name,
        'self',
        content,
        confirm,
        operationId,
        previewHash,
        policy,
        false,
        guard,
      );
      if (preview) return preview;
      if (!policy.writesEnabled) throw new ToolError('WRITE_DISABLED');
      if (!operationId) throw new ToolError('PREVIEW_REQUIRED');
      const hash = createHash('sha256')
        .update(JSON.stringify([name, 'self', content]))
        .digest('hex');
      const assert = () => guard.previews.assert(previewToken, operationId, hash);
      assert();

      const urn = await ownUrn();
      const outcome = await guard.runWrite(
        ACTIONS.profileEdit,
        'profile-edit',
        content,
        operationId,
        async (beforeDispatch) => {
          const result = await updateProfileField(
            engine,
            field,
            value,
            logger,
            beforeDispatch,
          );
          return toRaw(result, urn);
        },
        { assert, consume: () => guard.previews.consume(previewToken!) },
      );
      return ok({ ...outcome, field, urn, route: CAPABILITIES[name].route }, 'dom');
    });
  }

  registerTool(
    server,
    'update_profile_headline',
    '[ALPHA, write] Update the HEADLINE on YOUR OWN LinkedIn profile. Opens the real LinkedIn editor in the browser, sets the field, saves it and re-reads it to verify. Gated: requires confirm:true. Returns a structured status.',
    {
      headline: z
        .string()
        .min(1)
        .max(220)
        .describe('The new headline text (LinkedIn caps it at 220 characters).'),
      ...confirmField,
    },
    async ({ headline, confirm, operation_id, preview_hash, preview_token }) =>
      performEdit(
        'update_profile_headline',
        'headline',
        headline.trim(),
        confirm,
        operation_id,
        preview_hash,
        preview_token,
      ),
  );

  registerTool(
    server,
    'update_profile_about',
    '[ALPHA, write] Update the ABOUT / summary section on YOUR OWN LinkedIn profile. Opens the real LinkedIn editor in the browser, sets the field, saves it and re-reads it to verify. Gated: requires confirm:true. Returns a structured status.',
    {
      about: z
        .string()
        .min(1)
        .max(2600)
        .describe('The new About text (LinkedIn caps it at 2,600 characters).'),
      ...confirmField,
    },
    async ({ about, confirm, operation_id, preview_hash, preview_token }) =>
      performEdit(
        'update_profile_about',
        'about',
        about.trim(),
        confirm,
        operation_id,
        preview_hash,
        preview_token,
      ),
  );

  logger.debug('Profile edit tools registered');
}
