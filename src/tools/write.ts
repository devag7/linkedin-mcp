/**
 * Write/action tools (connect, message, post, react, comment).
 *
 * ⚠️ ALPHA — these perform REAL, often irreversible actions on your account and
 * are the most ban-sensitive surface. They are:
 *   - hard-gated behind an explicit `confirm: true` (never fire by accident),
 *   - run through the safety Guard (daily caps + human pacing + circuit breaker),
 *   - built on Voyager in-page POSTs (NOT DOM clicking — this immunizes us
 *     against the whole competitor connect-button/composer DOM-bug cluster),
 *   - and — the key hardening — they parse the Voyager response and return a
 *     STRUCTURED status (ok / duplicate / already_connected / restricted /
 *     quota_exhausted / not_allowed / failed) instead of a blind `sent:true`.
 *
 * Payload verification status (via `--writecapture` / `--writeprobe` on a warmed
 * burner, 2026-06-14/15) — all 5 endpoints CAPTURE/LIVE-VERIFIED:
 *   - connect_with_person — request shape VERIFIED (matches the live SPA exactly:
 *     voyagerRelationshipsDashMemberRelationships?action=verifyQuotaAndCreateV2).
 *   - create_post — VERIFIED LIVE (HTTP 200 `ok`, post created) via the GraphQL
 *     share mutation. NB: brand-new/unverified accounts are posting-restricted;
 *     LinkedIn returns an HTTP-200 GraphQL error the classifier reports as
 *     `failed` (the SPA itself hits the same restriction on a fresh account).
 *   - react_to_post — VERIFIED LIVE (HTTP 200 `ok`) via the social-dash reactions
 *     GraphQL mutation. Target is the post's ACTIVITY urn.
 *   - comment_on_post — VERIFIED LIVE (HTTP 201 `ok`) via the social-dash
 *     NormComments collection. Target is the post's ACTIVITY urn.
 *   - send_message — REPLY path VERIFIED LIVE (HTTP 200 `ok`) via the
 *     messenger-messages createMessage action. The NEW-thread path
 *     (hostRecipientUrns) is STRUCTURALLY VERIFIED: a live fire to a
 *     non-connection returned HTTP 422 RECIPIENT_NOT_FIRST_DEGREE_CONNECTION —
 *     i.e. the server parsed hostRecipientUrns + the body and rejected only on
 *     the business rule (recipient must be a 1st-degree connection), confirming
 *     the request shape. A clean 200 just needs an accepted connection.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VoyagerClient } from '../browser/voyager.js';
import type { Guard } from '../browser/guard.js';
import { ACTIONS } from '../browser/guard.js';
import { classifyWrite, type WriteOutcome } from '../browser/write-status.js';
import { ownFsdId, type NormalizedResponse } from '../browser/normalize.js';
import type { Logger } from '../types.js';
import * as ep from '../browser/endpoints.js';
import { ok, run } from './result.js';

const CONFIRM_HINT =
  'This performs a real action on your LinkedIn account. Re-call with confirm:true to proceed. Use a secondary account — these write tools are alpha and unverified.';

const confirmField = {
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
function createMessageBody(text: string, mailboxUrn: string, conversationUrn: string): Record<string, unknown> {
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
function outcomePayload(action: string, o: WriteOutcome): Record<string, unknown> {
  return {
    action,
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
): void {
  server.tool(
    'connect_with_person',
    '[ALPHA, write] Send a connection request. Gated: requires confirm:true. Returns a structured status (ok | duplicate | already_connected | restricted | quota_exhausted | failed). Counts against the daily connect cap.',
    {
      profile_id: z.string().min(1).describe('The fsd_profile id (the ACoAA… part of the profile URN)'),
      message: z.string().max(300).optional().describe('Optional note (max 300 chars)'),
      ...confirmField,
    },
    async ({ profile_id, message, confirm }) =>
      run(logger, 'connect_with_person', async () => {
        if (!confirm) return ok({ refused: true, reason: CONFIRM_HINT }, 'engine');
        // Verified-live payload (--writecapture 2026-06-14): the relationships-dash
        // invite action, invitee addressed by fsd_profile urn under inviteeUnion.
        const body: Record<string, unknown> = {
          invitee: { inviteeUnion: { memberProfile: toProfileUrn(profile_id) } },
        };
        if (message) body['customMessage'] = message.slice(0, 300);
        const raw = await guard.run(ACTIONS.connect, () =>
          voyager.voyagerPostRaw(ep.memberRelationshipsInvite(), body),
        );
        return ok(outcomePayload('connect_with_person', classifyWrite(raw, 'connect')));
      }),
  );

  server.tool(
    'send_message',
    '[ALPHA, write] Send a message. Pass thread_id / conversation_urn to REPLY into an existing conversation (verified); otherwise a new thread is started to recipient_urn (best-known). Gated: requires confirm:true. Returns a structured status. Counts against the daily message cap.',
    {
      recipient_urn: z
        .string()
        .optional()
        .describe('Recipient member URN (urn:li:fsd_profile:ACoAA…). Required when starting a NEW thread.'),
      thread_id: z
        .string()
        .optional()
        .describe('Existing thread id (2-…) or full msg_conversation urn to reply into (preferred over recipient_urn).'),
      message: z.string().min(1).describe('Message body (multiline supported)'),
      ...confirmField,
    },
    async ({ recipient_urn, thread_id, message, confirm }) =>
      run(logger, 'send_message', async () => {
        if (!confirm) return ok({ refused: true, reason: CONFIRM_HINT }, 'engine');
        if (!thread_id && !recipient_urn) {
          return ok(
            { action: 'send_message', status: 'failed', ok: false, detail: 'Provide thread_id (reply) or recipient_urn (new thread).' },
            'engine',
          );
        }
        if (!thread_id && recipient_urn && !recipient_urn.startsWith('urn:li:fsd_profile:')) {
          return ok(
            {
              action: 'send_message',
              status: 'failed',
              ok: false,
              detail: 'recipient_urn must be a profile URN (urn:li:fsd_profile:ACoAA…). Get it from search_people / get_profile.',
            },
            'engine',
          );
        }

        const raw = await guard.run(ACTIONS.message, async () => {
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
          return voyager.voyagerPostRaw(ep.messengerMessagesCreate(), body);
        });
        return ok(outcomePayload('send_message', classifyWrite(raw, 'message')));
      }),
  );

  server.tool(
    'create_post',
    '[ALPHA, write] Publish a text post to your feed. Gated: requires confirm:true. Returns a structured status.',
    {
      text: z.string().min(1).max(3000).describe('Post text'),
      visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC').describe('Audience'),
      ...confirmField,
    },
    async ({ text, visibility, confirm }) =>
      run(logger, 'create_post', async () => {
        if (!confirm) return ok({ refused: true, reason: CONFIRM_HINT }, 'engine');
        // Verified-live GraphQL share mutation (--writecapture 2026-06-14). The
        // queryId must appear BOTH in the path and the body.
        const queryId = ep.KNOWN_QUERY_IDS.createShare;
        const body = {
          variables: {
            post: {
              allowedCommentersScope: 'ALL',
              intendedShareLifeCycleState: 'PUBLISHED',
              origin: 'FEED',
              visibilityDataUnion: { visibilityType: visibility === 'CONNECTIONS' ? 'CONNECTIONS_ONLY' : 'ANYONE' },
              commentary: { text, attributesV2: [] },
            },
          },
          queryId,
          includeWebMetadata: true,
        };
        const raw = await guard.run(ACTIONS.comment, () =>
          voyager.voyagerPostRaw(ep.createShareMutation(queryId), body),
        );
        return ok(outcomePayload('create_post', classifyWrite(raw, 'post')));
      }),
  );

  server.tool(
    'react_to_post',
    '[ALPHA, write] React to a post. Gated: requires confirm:true. Returns a structured status.',
    {
      post_urn: z.string().min(1).describe('The post ACTIVITY urn, e.g. urn:li:activity:7472… (not the share urn)'),
      reaction: z
        .enum(['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT'])
        .default('LIKE'),
      ...confirmField,
    },
    async ({ post_urn, reaction, confirm }) =>
      run(logger, 'react_to_post', async () => {
        if (!confirm) return ok({ refused: true, reason: CONFIRM_HINT }, 'engine');
        // Verified-live social-dash reactions GraphQL mutation (--writecapture).
        const queryId = ep.KNOWN_QUERY_IDS.reactions;
        const body = {
          variables: { entity: { reactionType: reaction }, threadUrn: post_urn },
          queryId,
          includeWebMetadata: true,
        };
        const raw = await guard.run(ACTIONS.like, () =>
          voyager.voyagerPostRaw(ep.reactionsMutation(queryId), body),
        );
        return ok(outcomePayload('react_to_post', classifyWrite(raw, 'react')));
      }),
  );

  server.tool(
    'comment_on_post',
    '[ALPHA, write] Comment on a post. Gated: requires confirm:true. Returns a structured status.',
    {
      post_urn: z.string().min(1).describe('The post ACTIVITY urn, e.g. urn:li:activity:7472… (not the share urn)'),
      text: z.string().min(1).max(1250).describe('Comment text'),
      ...confirmField,
    },
    async ({ post_urn, text, confirm }) =>
      run(logger, 'comment_on_post', async () => {
        if (!confirm) return ok({ refused: true, reason: CONFIRM_HINT }, 'engine');
        // Verified-live social-dash NormComments collection (--writecapture).
        const body = {
          commentary: {
            text,
            attributesV2: [],
            $type: 'com.linkedin.voyager.dash.common.text.TextViewModel',
          },
          threadUrn: post_urn,
        };
        const raw = await guard.run(ACTIONS.comment, () =>
          voyager.voyagerPostRaw(ep.normCommentsCreate(), body),
        );
        return ok(outcomePayload('comment_on_post', classifyWrite(raw, 'comment')));
      }),
  );

  logger.debug('Write tools registered');
}
