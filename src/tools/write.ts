/**
 * Write/action tools (connect, message, post, react, comment).
 *
 * ⚠️ ALPHA — these perform REAL, often irreversible actions on your account and
 * are the most ban-sensitive surface. They are:
 *   - hard-gated behind an explicit `confirm: true` (never fire by accident),
 *   - run through the safety Guard (daily caps + human pacing + circuit breaker),
 *   - built on BEST-KNOWN Voyager payloads that are NOT yet verified against the
 *     current API — test them on a SECONDARY / throwaway account first, never
 *     your primary, and expect to tune the payloads.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { VoyagerClient } from '../browser/voyager.js';
import type { Guard } from '../browser/guard.js';
import { ACTIONS } from '../browser/guard.js';
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

export function registerWriteTools(
  server: McpServer,
  voyager: VoyagerClient,
  guard: Guard,
  logger: Logger,
): void {
  server.tool(
    'connect_with_person',
    '[ALPHA, write] Send a connection request. Gated: requires confirm:true. Counts against the daily connect cap.',
    {
      profile_id: z.string().min(1).describe('The fsd_profile id (the ACoAA… part of the profile URN)'),
      message: z.string().max(300).optional().describe('Optional note (max 300 chars)'),
      ...confirmField,
    },
    async ({ profile_id, message, confirm }) =>
      run(logger, 'connect_with_person', async () => {
        if (!confirm) return ok({ refused: true, reason: CONFIRM_HINT }, 'engine');
        const body: Record<string, unknown> = {
          invitee: {
            'com.linkedin.voyager.growth.invitation.InviteeProfile': { profileId: profile_id },
          },
        };
        if (message) body['message'] = message.slice(0, 300);
        const data = await guard.run(ACTIONS.connect, () => voyager.voyagerPost(ep.normInvitations(), body));
        return ok({ sent: true, data });
      }),
  );

  server.tool(
    'send_message',
    '[ALPHA, write] Send a message to a member. Gated: requires confirm:true. Counts against the daily message cap.',
    {
      recipient_urn: z.string().min(1).describe('Recipient member URN, e.g. urn:li:fsd_profile:ACoAA…'),
      message: z.string().min(1).describe('Message body (multiline supported)'),
      ...confirmField,
    },
    async ({ recipient_urn, message, confirm }) =>
      run(logger, 'send_message', async () => {
        if (!confirm) return ok({ refused: true, reason: CONFIRM_HINT }, 'engine');
        const body = {
          keyVersion: 'LEGACY_INBOX',
          conversationCreate: {
            eventCreate: {
              value: {
                'com.linkedin.voyager.messaging.create.MessageCreate': { body: message, attachments: [] },
              },
            },
            recipients: [recipient_urn],
            subtype: 'MEMBER_TO_MEMBER',
          },
        };
        const data = await guard.run(ACTIONS.message, () => voyager.voyagerPost(ep.messagingCreate(), body));
        return ok({ sent: true, data });
      }),
  );

  server.tool(
    'create_post',
    '[ALPHA, write] Publish a text post to your feed. Gated: requires confirm:true.',
    {
      text: z.string().min(1).max(3000).describe('Post text'),
      visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC').describe('Audience'),
      ...confirmField,
    },
    async ({ text, visibility, confirm }) =>
      run(logger, 'create_post', async () => {
        if (!confirm) return ok({ refused: true, reason: CONFIRM_HINT }, 'engine');
        const body = {
          visibleToConnectionsOnly: visibility === 'CONNECTIONS',
          commentaryV2: { text },
          origin: 'MEMBER_SHARE',
          allowedCommentersScope: 'ALL',
          postState: 'PUBLISHED',
          mediaCategory: 'NONE',
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': visibility },
        };
        const data = await guard.run(ACTIONS.comment, () => voyager.voyagerPost(ep.normShares(), body));
        return ok({ posted: true, data });
      }),
  );

  server.tool(
    'react_to_post',
    '[ALPHA, write] React to a post. Gated: requires confirm:true.',
    {
      post_urn: z.string().min(1).describe('The activity/share URN to react to'),
      reaction: z
        .enum(['LIKE', 'PRAISE', 'EMPATHY', 'INTEREST', 'APPRECIATION', 'ENTERTAINMENT'])
        .default('LIKE'),
      ...confirmField,
    },
    async ({ post_urn, reaction, confirm }) =>
      run(logger, 'react_to_post', async () => {
        if (!confirm) return ok({ refused: true, reason: CONFIRM_HINT }, 'engine');
        const body = { reactionType: reaction };
        const data = await guard.run(ACTIONS.like, () => voyager.voyagerPost(ep.reactions(post_urn), body));
        return ok({ reacted: true, data });
      }),
  );

  server.tool(
    'comment_on_post',
    '[ALPHA, write] Comment on a post. Gated: requires confirm:true.',
    {
      post_urn: z.string().min(1).describe('The activity/share URN to comment on'),
      text: z.string().min(1).max(1250).describe('Comment text'),
      ...confirmField,
    },
    async ({ post_urn, text, confirm }) =>
      run(logger, 'comment_on_post', async () => {
        if (!confirm) return ok({ refused: true, reason: CONFIRM_HINT }, 'engine');
        const body = { object: post_urn, message: { text } };
        const data = await guard.run(ACTIONS.comment, () => voyager.voyagerPost(ep.comments(), body));
        return ok({ commented: true, data });
      }),
  );

  logger.debug('Write tools registered');
}
