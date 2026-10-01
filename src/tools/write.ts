/** Alpha browser actions. Existing wire payloads are preserved; local tests do not prove current live compatibility. */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VoyagerClient } from '../browser/voyager.js';
import type { Guard } from '../browser/guard.js';
import { ACTIONS } from '../browser/guard.js';
import type { OperationOutcome } from '../safety/write-operation.js';
import { ownFsdId, type NormalizedResponse } from '../browser/normalize.js';
import type { Logger } from '../types.js';
import * as ep from '../browser/endpoints.js';
import { ok, run, ToolError } from './result.js';
import { registerTool } from './register.js';
import { CAPABILITIES, type ToolName, type CapabilityPolicy } from './capabilities.js';

const CONFIRM_HINT =
  'Review the exact target, content and effect. Only after user approval, repeat these inputs with the preview operationId, preview_hash and confirm:true. Alpha writes also require runtime opt-in.';

function review(
  action: ToolName,
  target: string,
  content: Record<string, unknown>,
  confirm: boolean,
  operationId: string | undefined,
  approvedHash: string | undefined,
  policy: CapabilityPolicy,
  experimental = false,
) {
  const payloadHash = createHash('sha256')
    .update(JSON.stringify([action, target, content]))
    .digest('hex');
  if (approvedHash && approvedHash !== payloadHash) throw new ToolError('PREVIEW_CHANGED');
  if (!confirm)
    return ok(
      {
        refused: true,
        reason: CONFIRM_HINT,
        preview: {
          operationId: operationId ?? randomUUID(),
          payloadHash,
          action,
          target,
          content,
          route: CAPABILITIES[action].route,
          effect: `Submit one ${action} action to LinkedIn. It may be irreversible.`,
          writesEnabled: policy.writesEnabled,
          experimentalRoute: experimental,
        },
      },
      'engine',
    );
  if (!policy.writesEnabled) throw new ToolError('WRITE_DISABLED');
  if (experimental && !policy.experimentalMessagesEnabled) throw new ToolError('UNVERIFIED_ROUTE');
  return undefined;
}

const confirmField = {
  preview_hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional()
    .describe(
      'Hash returned by the reviewed preview. Rejects changed target/content before any browser action.',
    ),
  operation_id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,128}$/)
    .optional()
    .describe(
      'Caller-generated unique ID (8-128 letters, digits, _ or -). Reuse the same ID and inputs to retrieve the stored outcome without resubmitting, including after a timeout. If omitted, a new ID is generated.',
    ),
  confirm: z
    .boolean()
    .default(false)
    .describe('Must be true to actually execute. Omit/false = refuse (safety).'),
};

/** Normalize a profile id (bare `ACoAA…` or a full urn) to a fsd_profile urn. */
function toProfileUrn(id: string): string {
  return id.startsWith('urn:li:fsd_profile:') ? id : `urn:li:fsd_profile:${id}`;
}

/**
 * Extract the messaging thread id (the `2-…` tail) from either a raw thread id
 * or a full conversation urn, e.g.
 *   urn:li:msg_conversation:(urn:li:fsd_profile:ACoAA…,2-Njk…==)
 * The thread id is always the LAST comma-segment that starts with `2-`; take it
 * by structure first (robust), then fall back to a permissive token match that
 * includes every base64/base64url character (`+ / _ - =`).
 */
export function threadIdFrom(s: string): string {
  const segments = s.split(',');
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]?.trim().replace(/[()]/g, '');
    if (seg && seg.startsWith('2-')) return seg;
  }
  const m = s.match(/2-[A-Za-z0-9_/+=-]+/);
  return m ? m[0] : s;
}

/** A 16-byte tracking id as a latin1 string (the messenger createMessage shape). */
function messagingTrackingId(): string {
  return randomBytes(16).toString('latin1');
}

/**
 * Build the verified-live `createMessage` body (--writecapture 2026-06-14).
 * `mailboxUrn` is the sender's own fsd_profile urn; `conversationUrn` is the
 * full msg_conversation urn of the thread being replied into.
 */
function createMessageBody(
  text: string,
  mailboxUrn: string,
  conversationUrn: string,
): Record<string, unknown> {
  return {
    message: {
      body: { attributes: [], text },
      renderContentUnions: [],
      conversationUrn,
      originToken: randomUUID(),
    },
    mailboxUrn,
    trackingId: messagingTrackingId(),
    dedupeByClientGeneratedToken: false,
  };
}

/** Shape a classified outcome into the tool result payload. */
function outcomePayload(action: string, o: OperationOutcome): Record<string, unknown> {
  return {
    action,
    operationId: o.operationId,
    replayed: o.replayed,
    status: o.status,
    ok: o.ok,
    httpStatus: o.httpStatus,
    ...(o.detail ? { detail: o.detail } : {}),
  };
}

export function registerWriteTools(
  server: McpServer,
  voyager: VoyagerClient,
  guard: Guard,
  logger: Logger,
  policy: CapabilityPolicy = { writesEnabled: false, experimentalMessagesEnabled: false },
): void {
  registerTool(
    server,
    'connect_with_person',
    '[ALPHA, write] Send a connection request. Gated: requires confirm:true. Returns a structured status (ok | duplicate | already_connected | restricted | quota_exhausted | failed | unknown). Counts against the daily connect cap.',
    {
      profile_id: z
        .string()
        .regex(/^(?:urn:li:fsd_profile:)?[A-Za-z0-9_-]{1,256}$/)
        .describe('The fsd_profile id (the ACoAA… part of the profile URN)'),
      message: z.string().max(300).optional().describe('Optional note (max 300 chars)'),
      ...confirmField,
    },
    async ({ profile_id, message, confirm, operation_id, preview_hash }) =>
      run(logger, 'connect_with_person', async () => {
        const preview = review(
          'connect_with_person',
          toProfileUrn(profile_id),
          { message: message ?? '' },
          confirm,
          operation_id,
          preview_hash,
          policy,
        );
        if (preview) return preview;
        // Verified-live payload (--writecapture 2026-06-14): the relationships-dash
        // invite action, invitee addressed by fsd_profile urn under inviteeUnion.
        const body: Record<string, unknown> = {
          invitee: { inviteeUnion: { memberProfile: toProfileUrn(profile_id) } },
        };
        if (message) body['customMessage'] = message.slice(0, 300);
        const outcome = await guard.runWrite(
          ACTIONS.connect,
          'connect',
          body,
          operation_id,
          (beforeDispatch) =>
            voyager.voyagerPostRaw(ep.memberRelationshipsInvite(), body, beforeDispatch),
        );
        return ok(outcomePayload('connect_with_person', outcome));
      }),
  );

  registerTool(
    server,
    'send_message',
    '[ALPHA, write] Send a message. Pass thread_id / conversation_urn to REPLY into an existing conversation; new threads require a separate experimental opt-in and lack current live success evidence. Gated: requires confirm:true. Returns a structured status. Counts against the daily message cap.',
    {
      recipient_urn: z
        .string()
        .regex(/^urn:li:fsd_profile:[A-Za-z0-9_-]{1,256}$/)
        .optional()
        .describe(
          'Recipient member URN (urn:li:fsd_profile:ACoAA…). Required when starting a NEW thread.',
        ),
      thread_id: z
        .string()
        .min(1)
        .max(1024)
        .optional()
        .describe(
          'Existing thread id (2-…) or full msg_conversation urn to reply into (preferred over recipient_urn).',
        ),
      message: z.string().min(1).max(10000).describe('Message body (multiline supported)'),
      ...confirmField,
    },
    async ({ recipient_urn, thread_id, message, confirm, operation_id, preview_hash }) =>
      run(logger, 'send_message', async () => {
        const preview = review(
          'send_message',
          thread_id ?? recipient_urn ?? 'missing_target',
          { message, mode: thread_id ? 'reply' : 'new_thread' },
          confirm,
          operation_id,
          preview_hash,
          policy,
          !thread_id,
        );
        if (preview) return preview;
        if (!thread_id && !recipient_urn) {
          return ok(
            {
              action: 'send_message',
              status: 'failed',
              ok: false,
              detail: 'Provide thread_id (reply) or recipient_urn (new thread).',
            },
            'engine',
          );
        }
        if (!thread_id && recipient_urn && !recipient_urn.startsWith('urn:li:fsd_profile:')) {
          return ok(
            {
              action: 'send_message',
              status: 'failed',
              ok: false,
              detail:
                'recipient_urn must be a profile URN (urn:li:fsd_profile:ACoAA…). Get it from search_people / get_profile.',
            },
            'engine',
          );
        }

        const outcome = await guard.runWrite(
          ACTIONS.message,
          'message',
          { recipient_urn, thread_id, message },
          operation_id,
          async (beforeDispatch) => {
            // The createMessage action needs the sender's own mailbox urn.
            const me = await voyager.voyagerGet<NormalizedResponse>(ep.me());
            const ownId = ownFsdId(me);
            if (!ownId) throw new Error('Could not resolve own mailbox id from /me.');
            const mailboxUrn = `urn:li:fsd_profile:${ownId}`;

            // Reply into an existing conversation (VERIFIED-live shape).
            if (thread_id) {
              const conversationUrn = thread_id.includes('msg_conversation')
                ? thread_id
                : `urn:li:msg_conversation:(${mailboxUrn},${threadIdFrom(thread_id)})`;
              return voyager.voyagerPostRaw(
                ep.messengerMessagesCreate(),
                createMessageBody(message, mailboxUrn, conversationUrn),
                beforeDispatch,
              );
            }

            // Start a NEW thread (BEST-KNOWN: hostRecipientUrns instead of a
            // conversationUrn — not capture-verified yet).
            const body = {
              message: {
                body: { attributes: [], text: message },
                renderContentUnions: [],
                originToken: randomUUID(),
              },
              hostRecipientUrns: [recipient_urn],
              mailboxUrn,
              trackingId: messagingTrackingId(),
              dedupeByClientGeneratedToken: false,
            };
            return voyager.voyagerPostRaw(ep.messengerMessagesCreate(), body, beforeDispatch);
          },
        );
        return ok(outcomePayload('send_message', outcome));
      }),
  );

  registerTool(
    server,
    'create_post',
    '[ALPHA, write] Publish a text post to your feed. Gated: requires confirm:true. Returns a structured status.',
    {
      text: z.string().min(1).max(3000).describe('Post text'),
      visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC').describe('Audience'),
      ...confirmField,
    },
    async ({ text, visibility, confirm, operation_id, preview_hash }) =>
      run(logger, 'create_post', async () => {
        const preview = review(
          'create_post',
          'self',
          { text, visibility },
          confirm,
          operation_id,
          preview_hash,
          policy,
        );
        if (preview) return preview;
        // Verified-live GraphQL share mutation (--writecapture 2026-06-14). The
        // queryId must appear BOTH in the path and the body.
        const queryId = ep.KNOWN_QUERY_IDS.createShare;
        const body = {
          variables: {
            post: {
              allowedCommentersScope: 'ALL',
              intendedShareLifeCycleState: 'PUBLISHED',
              origin: 'FEED',
              visibilityDataUnion: {
                visibilityType: visibility === 'CONNECTIONS' ? 'CONNECTIONS_ONLY' : 'ANYONE',
              },
              commentary: { text, attributesV2: [] },
            },
          },
          queryId,
          includeWebMetadata: true,
        };
        const outcome = await guard.runWrite(
          ACTIONS.comment,
          'post',
          { text, visibility },
          operation_id,
          (beforeDispatch) =>
            voyager.voyagerPostRaw(ep.createShareMutation(queryId), body, beforeDispatch),
        );
        return ok(outcomePayload('create_post', outcome));
      }),
  );

  registerTool(
    server,
    'react_to_post',
    '[ALPHA, write] React to a post. Gated: requires confirm:true. Returns a structured status.',
    {
      post_urn: z
        .string()
        .regex(/^urn:li:activity:[A-Za-z0-9_-]{1,128}$/)
        .describe('The post ACTIVITY urn, e.g. urn:li:activity:7472… (not the share urn)'),
      reaction: z
        .enum(['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT'])
        .default('LIKE'),
      ...confirmField,
    },
    async ({ post_urn, reaction, confirm, operation_id, preview_hash }) =>
      run(logger, 'react_to_post', async () => {
        const preview = review(
          'react_to_post',
          post_urn,
          { reaction },
          confirm,
          operation_id,
          preview_hash,
          policy,
        );
        if (preview) return preview;
        // Verified-live social-dash reactions GraphQL mutation (--writecapture).
        const queryId = ep.KNOWN_QUERY_IDS.reactions;
        const body = {
          variables: { entity: { reactionType: reaction }, threadUrn: post_urn },
          queryId,
          includeWebMetadata: true,
        };
        const outcome = await guard.runWrite(
          ACTIONS.like,
          'react',
          { post_urn, reaction },
          operation_id,
          (beforeDispatch) =>
            voyager.voyagerPostRaw(ep.reactionsMutation(queryId), body, beforeDispatch),
        );
        return ok(outcomePayload('react_to_post', outcome));
      }),
  );

  registerTool(
    server,
    'comment_on_post',
    '[ALPHA, write] Comment on a post. Gated: requires confirm:true. Returns a structured status.',
    {
      post_urn: z
        .string()
        .regex(/^urn:li:activity:[A-Za-z0-9_-]{1,128}$/)
        .describe('The post ACTIVITY urn, e.g. urn:li:activity:7472… (not the share urn)'),
      text: z.string().min(1).max(1250).describe('Comment text'),
      ...confirmField,
    },
    async ({ post_urn, text, confirm, operation_id, preview_hash }) =>
      run(logger, 'comment_on_post', async () => {
        const preview = review(
          'comment_on_post',
          post_urn,
          { text },
          confirm,
          operation_id,
          preview_hash,
          policy,
        );
        if (preview) return preview;
        // Verified-live social-dash NormComments collection (--writecapture).
        const body = {
          commentary: {
            text,
            attributesV2: [],
            $type: 'com.linkedin.voyager.dash.common.text.TextViewModel',
          },
          threadUrn: post_urn,
        };
        const outcome = await guard.runWrite(
          ACTIONS.comment,
          'comment',
          { post_urn, text },
          operation_id,
          (beforeDispatch) => voyager.voyagerPostRaw(ep.normCommentsCreate(), body, beforeDispatch),
        );
        return ok(outcomePayload('comment_on_post', outcome));
      }),
  );

  logger.debug('Write tools registered');
}
