import { describe, it, expect } from 'vitest';
import {
  shapeInbox,
  shapeConversationMessages,
  type NormalizedResponse,
} from '../src/browser/normalize.js';

/**
 * Synthetic fixtures imported from upstream PR #1 (ab0a1ed). Its author described
 * the shape as captured 2026-07-04; this checkout has no independent live capture.
 * These tests establish offline normalization only:
 * - Conversation.`*conversationParticipants` → MessagingParticipant URNs
 * - MessagingParticipant.hostIdentityUrn + participantType.member.{firstName,lastName,headline}.text
 * - Message.`*sender` / `*actor` → MessagingParticipant URN
 * - the mailbox owner's fsd_profile id is embedded in the msg_conversation URN
 */

const OWNER_ID = 'ACoAAOWNEROWNEROWNEROWNEROWNEROWNEROWNER';
const OTHER_ID = 'ACoAAOTHEROTHEROTHEROTHEROTHEROTHEROTHER';
const CONV_URN = `urn:li:msg_conversation:(urn:li:fsd_profile:${OWNER_ID},2-THREADID==)`;

const participant = (id: string, first: string, last: string, headline: string) => ({
  $type: 'com.linkedin.messenger.MessagingParticipant',
  entityUrn: `urn:li:msg_messagingParticipant:urn:li:fsd_profile:${id}`,
  hostIdentityUrn: `urn:li:fsd_profile:${id}`,
  participantType: {
    member: {
      profileUrl: `https://www.linkedin.com/in/${id}`,
      firstName: { text: first },
      lastName: { text: last },
      headline: { text: headline },
    },
  },
});

const inboxResp: NormalizedResponse = {
  included: [
    participant(OWNER_ID, 'Owner', 'Member', 'Mailbox owner'),
    participant(OTHER_ID, 'Ada', 'Lovelace', 'Engineer at Example'),
    {
      $type: 'com.linkedin.messenger.Conversation',
      entityUrn: CONV_URN,
      title: null,
      groupChat: false,
      lastActivityAt: 1700000300000,
      unreadCount: 1,
      read: false,
      '*conversationParticipants': [
        `urn:li:msg_messagingParticipant:urn:li:fsd_profile:${OTHER_ID}`,
        `urn:li:msg_messagingParticipant:urn:li:fsd_profile:${OWNER_ID}`,
      ],
    },
  ],
};

const message = (id: string, senderId: string, deliveredAt: number, text: string) => ({
  $type: 'com.linkedin.messenger.Message',
  entityUrn: `urn:li:msg_message:(urn:li:fsd_profile:${OWNER_ID},${id})`,
  '*conversation': CONV_URN,
  '*sender': `urn:li:msg_messagingParticipant:urn:li:fsd_profile:${senderId}`,
  body: { text },
  deliveredAt,
});

const conversationResp: NormalizedResponse = {
  included: [
    participant(OWNER_ID, 'Owner', 'Member', 'Mailbox owner'),
    participant(OTHER_ID, 'Ada', 'Lovelace', 'Engineer at Example'),
    // Deliberately out of order — the live API gives no ordering guarantee.
    message('m2', OWNER_ID, 1700000200000, 'Sounds good, thanks!'),
    message('m1', OTHER_ID, 1700000100000, 'Hi — are you free next week?'),
  ],
};

describe('shapeInbox — participant identity', () => {
  it('keeps a participant whose profile id contains the owner id as a substring', () => {
    const id = `prefix${OWNER_ID}suffix`;
    const response: NormalizedResponse = {
      included: [
        participant(OWNER_ID, 'Owner', 'Member', 'Owner'),
        participant(id, 'Distinct', 'Member', 'Other'),
        {
          ...inboxResp.included![2],
          '*conversationParticipants': [
            `urn:li:msg_messagingParticipant:urn:li:fsd_profile:${OWNER_ID}`,
            `urn:li:msg_messagingParticipant:urn:li:fsd_profile:${id}`,
          ],
        },
      ],
    };
    expect(shapeInbox(response)[0].participants?.map((p) => p.name)).toEqual(['Distinct Member']);
  });
  it('resolves the counterpart (name, headline, profileUrn/Url) and excludes the mailbox owner', () => {
    const [conv] = shapeInbox(inboxResp);
    expect(conv.participants).toHaveLength(1);
    expect(conv.participants?.[0]).toMatchObject({
      name: 'Ada Lovelace',
      headline: 'Engineer at Example',
      profileUrn: `urn:li:fsd_profile:${OTHER_ID}`,
    });
  });

  it('falls back to participant names when the conversation has no title (1:1 threads)', () => {
    const [conv] = shapeInbox(inboxResp);
    expect(conv.title).toBe('Ada Lovelace');
  });

  it('keeps the existing compact fields', () => {
    const [conv] = shapeInbox(inboxResp);
    expect(conv).toMatchObject({
      groupChat: false,
      lastActivityAt: 1700000300000,
      unreadCount: 1,
      read: false,
      conversationUrn: CONV_URN,
    });
  });
});

describe('shapeConversationMessages — ordering and attribution', () => {
  it('keeps unknown delivery times after dated messages without inventing timestamps', () => {
    const { deliveredAt: _time, ...undated } = message('unknown', OTHER_ID, 0, 'Undated');
    const result = shapeConversationMessages({
      included: [undated, message('dated', OTHER_ID, 10, 'Dated')],
    });
    expect(result.map((m) => m.text)).toEqual(['Dated', 'Undated']);
    expect(result[1].deliveredAt).toBeUndefined();
  });
  it('does not mistake an id suffix match for the mailbox owner', () => {
    const id = `prefix${OWNER_ID}`;
    const response: NormalizedResponse = {
      included: [
        participant(id, 'Distinct', 'Member', 'Other'),
        message('m3', id, 1700000200000, 'Synthetic'),
      ],
    };
    expect(shapeConversationMessages(response)[0].fromSelf).toBe(false);
  });

  it('resolves the actor fallback and leaves missing owner attribution unknown', () => {
    const value = message('m4', OTHER_ID, 1700000200000, 'Synthetic');
    const { '*sender': actor, '*conversation': _conversation, ...rest } = value;
    const response: NormalizedResponse = {
      included: [
        participant(OTHER_ID, 'Ada', 'Lovelace', 'Engineer'),
        { ...rest, '*actor': actor },
      ],
    };
    const result = shapeConversationMessages(response)[0];
    expect(result.sender).toBe('Ada Lovelace');
    expect(result.fromSelf).toBeUndefined();
  });
  it('sorts messages ascending by deliveredAt', () => {
    const msgs = shapeConversationMessages(conversationResp);
    expect(msgs.map((m) => m.deliveredAt)).toEqual([1700000100000, 1700000200000]);
  });

  it('attributes each message with sender name and profile urn', () => {
    const [first, second] = shapeConversationMessages(conversationResp);
    expect(first.sender).toBe('Ada Lovelace');
    expect(first.senderProfileUrn).toBe(`urn:li:fsd_profile:${OTHER_ID}`);
    expect(second.sender).toBe('Owner Member');
  });

  it('flags the mailbox owner via fromSelf (derived from the conversation urn, no /me call)', () => {
    const [fromOther, fromOwner] = shapeConversationMessages(conversationResp);
    expect(fromOther.fromSelf).toBe(false);
    expect(fromOwner.fromSelf).toBe(true);
  });

  it('omits attribution gracefully when participants are missing', () => {
    const bare: NormalizedResponse = {
      included: [message('m1', OTHER_ID, 1700000100000, 'Hello')],
    };
    const [msg] = shapeConversationMessages(bare);
    expect(msg.text).toBe('Hello');
    expect(msg.sender).toBeUndefined();
    expect(msg.fromSelf).toBeUndefined();
  });
});
