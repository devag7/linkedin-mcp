import { describe, it, expect } from 'vitest';
import {
  me,
  profile,
  profileView,
  profileSkills,
  profileSkillsGraphql,
  searchClusters,
  jobsSearch,
  jobPosting,
  jobPostingGraphql,
  companyByUniversalName,
  companyById,
  messagingConversations,
  messagingConversationEvents,
  messagingConversationsGraphql,
  invitationsReceived,
  invitationsSent,
  normInvitations,
  messagingCreate,
  messagingEventCreate,
  normShares,
  deleteShare,
  reactions,
  comments,
  encodeRestliList,
  KNOWN_QUERY_IDS,
} from '../src/browser/endpoints.js';

describe('endpoints — static REST-li paths', () => {
  it('me() is the lightweight identity path', () => {
    expect(me()).toBe('/me');
  });

  it('messagingConversations() is the inbox collection', () => {
    expect(messagingConversations()).toBe('/messaging/conversations');
  });
});

describe('endpoints — profile builders', () => {
  it('profileView() embeds the slug and the profileView suffix', () => {
    expect(profileView('satyanadella')).toBe(
      '/identity/profiles/satyanadella/profileView',
    );
  });

  it('profile() returns the bare profile entity path', () => {
    expect(profile('williamhgates')).toBe('/identity/profiles/williamhgates');
  });

  it('profileSkills() returns the legacy skills sub-resource', () => {
    expect(profileSkills('satyanadella')).toBe(
      '/identity/profiles/satyanadella/skills',
    );
  });

  it('URL-encodes ids with reserved characters', () => {
    // A slug-like id containing characters that MUST be percent-encoded.
    expect(profileView('a b/c?d')).toBe(
      '/identity/profiles/a%20b%2Fc%3Fd/profileView',
    );
  });
});

describe('endpoints — search cluster builder', () => {
  it('produces a /graphql path with an encoded queryId and variables', () => {
    const path = searchClusters('staff engineer', 'PEOPLE', 0, 10);
    expect(path.startsWith('/graphql?queryId=')).toBe(true);
    // Default queryId is the bundled best-known hash.
    expect(path).toContain(
      `queryId=${encodeURIComponent(KNOWN_QUERY_IDS.searchClusters)}`,
    );
    // The space in keywords must be percent-encoded (no raw spaces in a URL).
    expect(path).not.toContain(' ');
    expect(path).toContain('variables=');
    // Structural chars stay literal; only the value's space is encoded.
    expect(path).toContain('value:List(PEOPLE)');
    expect(path).toContain('keywords:staff%20engineer');
  });

  it('honors a live re-captured queryId over the bundled default', () => {
    const live = 'voyagerSearchDashClusters.deadbeefdeadbeefdeadbeefdeadbeef';
    const path = searchClusters('ceo', 'ALL', 0, 5, live);
    expect(path).toContain(`queryId=${encodeURIComponent(live)}`);
    expect(path).not.toContain(KNOWN_QUERY_IDS.searchClusters);
  });

  it('encodes pagination into the variables literal', () => {
    const decoded = decodeURIComponent(searchClusters('x', 'ALL', 25, 50));
    expect(decoded).toContain('start:25');
    expect(decoded).toContain('count:50');
  });
});

describe('endpoints — jobs builders', () => {
  it('jobsSearch() includes geoId when provided', () => {
    const decoded = decodeURIComponent(
      jobsSearch('typescript', '103644278', 0, 25),
    );
    expect(decoded).toContain('keywords:typescript');
    expect(decoded).toContain('geoId:103644278');
    expect(decoded).toContain('count:25');
  });

  it('jobsSearch() omits the geo clause when no location given', () => {
    const decoded = decodeURIComponent(jobsSearch('typescript'));
    expect(decoded).not.toContain('geoId');
  });

  it('jobPosting() builds the REST-li posting path', () => {
    expect(jobPosting('3801234567')).toBe('/jobs/jobPostings/3801234567');
  });

  it('jobPostingGraphql() embeds the fsd_jobPosting urn', () => {
    const decoded = decodeURIComponent(jobPostingGraphql('3801234567'));
    expect(decoded).toContain('jobPostingUrn:urn:li:fsd_jobPosting:3801234567');
  });
});

describe('endpoints — organization builders', () => {
  it('companyByUniversalName() uses the universalName finder and encodes the slug', () => {
    expect(companyByUniversalName('microsoft')).toBe(
      '/organization/companies?q=universalName&universalName=microsoft',
    );
    expect(companyByUniversalName('a&b')).toBe(
      '/organization/companies?q=universalName&universalName=a%26b',
    );
  });

  it('companyById() returns the entity path', () => {
    expect(companyById('1035')).toBe('/organization/companies/1035');
  });
});

describe('endpoints — messaging + invitations builders', () => {
  it('messagingConversationEvents() embeds the conversation id', () => {
    expect(messagingConversationEvents('2-abc%3D')).toBe(
      '/messaging/conversations/2-abc%253D/events',
    );
  });

  it('messagingConversationsGraphql() carries pagination', () => {
    const decoded = decodeURIComponent(messagingConversationsGraphql(0, 20));
    expect(decoded).toContain('start:0');
    expect(decoded).toContain('count:20');
  });

  it('invitationsReceived() builds the received-invitation finder', () => {
    expect(invitationsReceived(0, 50)).toBe(
      '/relationships/invitationViews?q=receivedInvitation&start=0&count=50',
    );
  });

  it('invitationsSent() builds the sent-invitation finder', () => {
    expect(invitationsSent(10, 25)).toBe(
      '/relationships/sentInvitationViewsV2?start=10&count=25',
    );
  });
});

describe('endpoints — write builders', () => {
  it('normInvitations() is the invite POST path', () => {
    expect(normInvitations()).toBe('/growth/normInvitations');
  });

  it('messagingCreate() carries the REQUIRED ?action=create (the new-thread fix)', () => {
    expect(messagingCreate()).toBe('/messaging/conversations?action=create');
  });

  it('messagingEventCreate() targets an existing thread (the reply fix)', () => {
    expect(messagingEventCreate('2-abc==')).toBe(
      '/messaging/conversations/2-abc%3D%3D/events?action=create',
    );
  });

  it('normShares() / deleteShare() build the share paths', () => {
    expect(normShares()).toBe('/contentcreation/normShares');
    expect(deleteShare('urn:li:share:123')).toBe(
      '/contentcreation/normShares/urn%3Ali%3Ashare%3A123',
    );
  });

  it('reactions() encodes the thread urn into the query', () => {
    expect(reactions('urn:li:activity:7')).toBe(
      '/voyagerSocialDashReactions?threadUrn=urn%3Ali%3Aactivity%3A7',
    );
  });

  it('comments() is the comment POST path', () => {
    expect(comments()).toBe('/feed/comments');
  });
});

describe('endpoints — restli list encoding', () => {
  it('encodes each element and wraps in List(...)', () => {
    expect(encodeRestliList(['PEOPLE', 'COMPANIES'])).toBe(
      'List(PEOPLE,COMPANIES)',
    );
    expect(encodeRestliList(['a b', 'c,d'])).toBe('List(a%20b,c%2Cd)');
  });

  it('handles the empty list', () => {
    expect(encodeRestliList([])).toBe('List()');
  });
});

describe('endpoints — determinism', () => {
  it('is pure: same inputs yield identical outputs', () => {
    expect(profileSkillsGraphql('satyanadella')).toBe(
      profileSkillsGraphql('satyanadella'),
    );
    expect(searchClusters('x', 'JOBS', 0, 10)).toBe(
      searchClusters('x', 'JOBS', 0, 10),
    );
  });
});
