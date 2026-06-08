/**
 * LinkedIn Pro MCP Server — Core Server Setup
 *
 * Creates and configures the MCP server with all tool registrations.
 * This is the heart of the server — tools are registered here.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadConfig } from './config/env.js';
import type { ServerConfig } from './types.js';
import { Logger } from './types.js';
import { connectStdio } from './transports/stdio.js';
import { startHttpServer } from './transports/http.js';
import { AuthManager } from './auth/manager.js';
import { LinkedInClient, LinkedInApiError } from './client/linkedin.js';
import type { AuthError } from './auth/manager.js';

const VERSION = '1.0.0';

/**
 * Create the MCP server with all tools registered.
 */
export function createServer(logger: Logger): McpServer {
  const server = new McpServer(
    {
      name: 'linkedin-pro-mcp',
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Initialize auth and client
  const config = loadConfig();
  const auth = new AuthManager(config, logger);
  const client = new LinkedInClient(auth, logger, {
    rateLimitRpm: config.RATE_LIMIT_RPM,
    cacheTtlSeconds: config.CACHE_TTL,
    requestTimeoutMs: config.REQUEST_TIMEOUT,
  });

  // Register all tools
  registerUtilityTools(server, auth, client, logger);
  registerProfileTools(server, auth, client, logger);
  registerMessagingTools(server, auth, client, logger);
  registerCompanyTools(server, auth, client, logger);
  registerJobTools(server, auth, client, logger);
  registerNetworkTools(server, auth, client, logger);
  registerFeedTools(server, auth, client, logger);

  logger.info('MCP server created', { version: VERSION });
  return server;
}

// ─── Utility Tools ──────────────────────────────────────────

function registerUtilityTools(
  server: McpServer,
  auth: AuthManager,
  client: LinkedInClient,
  logger: Logger,
): void {
  server.tool(
    'whoami',
    'Get information about the current LinkedIn Pro MCP server instance, authentication status, and capabilities.',
    {},
    async () => {
      logger.debug('Tool called: whoami');
      const authStatus = await auth.validate();
      const cacheStats = client.getCacheStats();

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                server: 'linkedin-pro-mcp',
                version: VERSION,
                status: 'running',
                authentication: authStatus,
                cache: cacheStats,
                capabilities: {
                  totalTools: 36,
                  categories: [
                    'profile (7 tools)',
                    'messaging (6 tools)',
                    'company (5 tools)',
                    'jobs (4 tools)',
                    'network (6 tools)',
                    'feed (5 tools)',
                    'utility (3 tools)',
                  ],
                },
                uptime: Math.floor(process.uptime()),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'health_check',
    'Check the health of the LinkedIn Pro MCP server and LinkedIn connectivity.',
    {},
    async () => {
      logger.debug('Tool called: health_check');
      const authStatus = await auth.validate();

      let linkedinReachable = false;
      try {
        const response = await fetch('https://www.linkedin.com/', {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        linkedinReachable = response.ok || response.status === 302 || response.status === 303;
      } catch {
        linkedinReachable = false;
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: linkedinReachable && authStatus.valid ? 'healthy' : 'degraded',
                checks: {
                  server: 'ok',
                  authentication: authStatus,
                  linkedin_reachable: linkedinReachable ? 'ok' : 'unreachable',
                },
                version: VERSION,
                uptime: Math.floor(process.uptime()),
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  logger.debug('Utility tools registered');
}

// ─── Profile Tools ─────────────────────────────────────────

function registerProfileTools(
  server: McpServer,
  _auth: AuthManager,
  client: LinkedInClient,
  logger: Logger,
): void {
  server.tool(
    'get_profile',
    'Get a LinkedIn profile by username. Returns experience, education, skills, headline, summary, and more.',
    {
      username: z.string().describe('LinkedIn username (public identifier), e.g. "satyanadella"'),
    },
    async ({ username }) => {
      return safeToolCall(logger, 'get_profile', async () => {
        const data = await client.voyagerGet(
          `/identity/profiles/${encodeURIComponent(username)}/profileView`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_my_profile',
    'Get the authenticated user\'s own LinkedIn profile with full details.',
    {},
    async () => {
      return safeToolCall(logger, 'get_my_profile', async () => {
        const data = await client.voyagerGet('/me');
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_profile_skills',
    'Get detailed skills with endorsement counts for a LinkedIn profile.',
    {
      username: z.string().describe('LinkedIn username (public identifier)'),
    },
    async ({ username }) => {
      return safeToolCall(logger, 'get_profile_skills', async () => {
        const data = await client.voyagerGet(
          `/identity/profiles/${encodeURIComponent(username)}/skills`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_profile_recommendations',
    'Get recommendations given and received for a LinkedIn profile.',
    {
      username: z.string().describe('LinkedIn username (public identifier)'),
    },
    async ({ username }) => {
      return safeToolCall(logger, 'get_profile_recommendations', async () => {
        const data = await client.voyagerGet(
          `/identity/profiles/${encodeURIComponent(username)}/recommendations`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_profile_activity',
    'Get a user\'s recent posts and activity on LinkedIn.',
    {
      username: z.string().describe('LinkedIn username (public identifier)'),
      count: z.number().int().min(1).max(50).default(10).describe('Number of activities to return (default: 10)'),
    },
    async ({ username, count }) => {
      return safeToolCall(logger, 'get_profile_activity', async () => {
        const data = await client.voyagerGet(
          `/identity/profiles/${encodeURIComponent(username)}/recentActivities?count=${count}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_sidebar_profiles',
    'Get "People also viewed" sidebar profile suggestions for a LinkedIn profile.',
    {
      username: z.string().describe('LinkedIn username (public identifier)'),
    },
    async ({ username }) => {
      return safeToolCall(logger, 'get_sidebar_profiles', async () => {
        const data = await client.voyagerGet(
          `/identity/profiles/${encodeURIComponent(username)}/browsemapWithoutContext`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'search_people',
    'Search for people on LinkedIn with keyword, location, company, and connection degree filters.',
    {
      keywords: z.string().describe('Search keywords (name, title, company, etc.)'),
      count: z.number().int().min(1).max(49).default(10).describe('Results per page (default: 10)'),
      start: z.number().int().min(0).default(0).describe('Pagination offset (default: 0)'),
      connectionOf: z.string().optional().describe('Only show connections of this profile URN'),
      network: z.enum(['F', 'S', 'O']).optional().describe('Network filter: F=1st, S=2nd, O=3rd+'),
    },
    async ({ keywords, count, start, connectionOf, network }) => {
      return safeToolCall(logger, 'search_people', async () => {
        const params = new URLSearchParams({
          keywords,
          count: String(count),
          start: String(start),
          origin: 'GLOBAL_SEARCH_HEADER',
        });
        if (connectionOf) params.set('connectionOf', connectionOf);
        if (network) params.set('network', network);

        const data = await client.voyagerGet(
          `/search/dash/clusters?q=all&query=(flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(PEOPLE),keywords:List(${encodeURIComponent(keywords)})))&count=${count}&start=${start}`,
        );
        return formatResult(data);
      });
    },
  );

  logger.debug('Profile tools registered');
}

// ─── Messaging Tools ───────────────────────────────────────

function registerMessagingTools(
  server: McpServer,
  _auth: AuthManager,
  client: LinkedInClient,
  logger: Logger,
): void {
  server.tool(
    'get_inbox',
    'List recent inbox conversations. Returns conversation threads with participants and last message preview.',
    {
      count: z.number().int().min(1).max(40).default(20).describe('Number of conversations to return (default: 20)'),
    },
    async ({ count }) => {
      return safeToolCall(logger, 'get_inbox', async () => {
        const data = await client.voyagerGet(
          `/messaging/conversations?keyVersion=LEGACY_INBOX&count=${count}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_conversation',
    'Read a specific messaging conversation thread by conversation ID.',
    {
      conversationId: z.string().describe('The conversation/thread ID'),
      count: z.number().int().min(1).max(50).default(20).describe('Number of messages to return (default: 20)'),
    },
    async ({ conversationId, count }) => {
      return safeToolCall(logger, 'get_conversation', async () => {
        const data = await client.voyagerGet(
          `/messaging/conversations/${encodeURIComponent(conversationId)}/events?count=${count}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'search_conversations',
    'Search messaging conversations by keyword.',
    {
      keywords: z.string().describe('Search keywords'),
      count: z.number().int().min(1).max(20).default(10).describe('Number of results (default: 10)'),
    },
    async ({ keywords, count }) => {
      return safeToolCall(logger, 'search_conversations', async () => {
        const data = await client.voyagerGet(
          `/messaging/conversations?q=search&keywords=${encodeURIComponent(keywords)}&count=${count}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'send_message',
    'Send a message to a LinkedIn user. Supports multiline text natively.',
    {
      recipientUrn: z.string().describe('Recipient member URN (e.g. "urn:li:fsd_profile:ACoAA...")'),
      message: z.string().describe('Message body text (multiline supported)'),
    },
    async ({ recipientUrn, message }) => {
      return safeToolCall(logger, 'send_message', async () => {
        const data = await client.voyagerPost(
          '/messaging/conversations',
          {
            keyVersion: 'LEGACY_INBOX',
            conversationCreate: {
              eventCreate: {
                value: {
                  'com.linkedin.voyager.messaging.create.MessageCreate': {
                    body: message,
                    attachments: [],
                  },
                },
              },
              recipients: [recipientUrn],
              subtype: 'MEMBER_TO_MEMBER',
            },
          },
        );
        return formatResult({ success: true, data });
      });
    },
  );

  server.tool(
    'reply_to_thread',
    'Reply to an existing messaging conversation thread.',
    {
      conversationId: z.string().describe('The conversation/thread ID to reply to'),
      message: z.string().describe('Reply message text'),
    },
    async ({ conversationId, message }) => {
      return safeToolCall(logger, 'reply_to_thread', async () => {
        const data = await client.voyagerPost(
          `/messaging/conversations/${encodeURIComponent(conversationId)}/events`,
          {
            eventCreate: {
              value: {
                'com.linkedin.voyager.messaging.create.MessageCreate': {
                  body: message,
                  attachments: [],
                },
              },
            },
          },
        );
        return formatResult({ success: true, data });
      });
    },
  );

  server.tool(
    'mark_conversation_read',
    'Mark a messaging conversation as read.',
    {
      conversationId: z.string().describe('The conversation ID to mark as read'),
    },
    async ({ conversationId }) => {
      return safeToolCall(logger, 'mark_conversation_read', async () => {
        const data = await client.voyagerPost(
          `/messaging/conversations/${encodeURIComponent(conversationId)}`,
          { patch: { read: true } },
        );
        return formatResult({ success: true, data });
      });
    },
  );

  logger.debug('Messaging tools registered');
}

// ─── Company Tools ──────────────────────────────────────────

function registerCompanyTools(
  server: McpServer,
  _auth: AuthManager,
  client: LinkedInClient,
  logger: Logger,
): void {
  server.tool(
    'get_company',
    'Get a LinkedIn company profile by universal name.',
    {
      universalName: z.string().describe('Company universal name (from URL), e.g. "google"'),
    },
    async ({ universalName }) => {
      return safeToolCall(logger, 'get_company', async () => {
        const data = await client.voyagerGet(
          `/organization/companies?decorationId=com.linkedin.voyager.deco.organization.web.WebFullCompanyMain-42&q=universalName&universalName=${encodeURIComponent(universalName)}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_company_posts',
    'Get recent posts from a company\'s LinkedIn feed.',
    {
      companyId: z.string().describe('Company entity ID (numeric) or universal name'),
      count: z.number().int().min(1).max(50).default(10).describe('Number of posts (default: 10)'),
    },
    async ({ companyId, count }) => {
      return safeToolCall(logger, 'get_company_posts', async () => {
        const data = await client.voyagerGet(
          `/feed/updates?q=companyFeedByCompanyId&companyId=${encodeURIComponent(companyId)}&count=${count}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_company_employees',
    'List employees at a specific company with optional keyword filter.',
    {
      companyId: z.string().describe('Company entity ID (numeric)'),
      keywords: z.string().optional().describe('Filter by keyword (name, title)'),
      count: z.number().int().min(1).max(49).default(10).describe('Results per page (default: 10)'),
      start: z.number().int().min(0).default(0).describe('Pagination offset (default: 0)'),
    },
    async ({ companyId, keywords, count, start }) => {
      return safeToolCall(logger, 'get_company_employees', async () => {
        let queryParams = `keywords:List(${encodeURIComponent(keywords ?? '')}),currentCompany:List(${companyId}),resultType:List(PEOPLE)`;
        const data = await client.voyagerGet(
          `/search/dash/clusters?q=all&query=(flagshipSearchIntent:SEARCH_SRP,queryParameters:(${queryParams}))&count=${count}&start=${start}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'search_companies',
    'Search for companies on LinkedIn by keyword.',
    {
      keywords: z.string().describe('Search keywords'),
      count: z.number().int().min(1).max(49).default(10).describe('Results per page (default: 10)'),
      start: z.number().int().min(0).default(0).describe('Pagination offset (default: 0)'),
    },
    async ({ keywords, count, start }) => {
      return safeToolCall(logger, 'search_companies', async () => {
        const data = await client.voyagerGet(
          `/search/dash/clusters?q=all&query=(flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(COMPANIES),keywords:List(${encodeURIComponent(keywords)})))&count=${count}&start=${start}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_company_jobs',
    'Get open job positions at a specific company.',
    {
      companyId: z.string().describe('Company entity ID (numeric)'),
      count: z.number().int().min(1).max(25).default(10).describe('Number of jobs (default: 10)'),
    },
    async ({ companyId, count }) => {
      return safeToolCall(logger, 'get_company_jobs', async () => {
        const data = await client.voyagerGet(
          `/search/dash/clusters?q=all&query=(flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(JOBS),currentCompany:List(${companyId})))&count=${count}`,
        );
        return formatResult(data);
      });
    },
  );

  logger.debug('Company tools registered');
}

// ─── Job Tools ──────────────────────────────────────────────

function registerJobTools(
  server: McpServer,
  _auth: AuthManager,
  client: LinkedInClient,
  logger: Logger,
): void {
  server.tool(
    'search_jobs',
    'Search for jobs on LinkedIn with keyword, location, and experience filters.',
    {
      keywords: z.string().describe('Job search keywords'),
      location: z.string().optional().describe('Location filter (city, state, country)'),
      count: z.number().int().min(1).max(25).default(10).describe('Results per page (default: 10)'),
      start: z.number().int().min(0).default(0).describe('Pagination offset (default: 0)'),
    },
    async ({ keywords, location, count, start }) => {
      return safeToolCall(logger, 'search_jobs', async () => {
        let queryParts = `keywords:List(${encodeURIComponent(keywords)}),resultType:List(JOBS)`;
        if (location) queryParts += `,locationFallback:List(${encodeURIComponent(location)})`;

        const data = await client.voyagerGet(
          `/search/dash/clusters?q=all&query=(flagshipSearchIntent:SEARCH_SRP,queryParameters:(${queryParts}))&count=${count}&start=${start}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_job_details',
    'Get detailed information about a specific job posting.',
    {
      jobId: z.string().describe('Job posting ID'),
    },
    async ({ jobId }) => {
      return safeToolCall(logger, 'get_job_details', async () => {
        const data = await client.voyagerGet(
          `/jobs/jobPostings/${encodeURIComponent(jobId)}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_saved_jobs',
    'Get the authenticated user\'s saved/bookmarked jobs.',
    {
      count: z.number().int().min(1).max(25).default(10).describe('Number of results (default: 10)'),
    },
    async ({ count }) => {
      return safeToolCall(logger, 'get_saved_jobs', async () => {
        const data = await client.voyagerGet(
          `/jobs/savedJobs?count=${count}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_job_applicants',
    'Get applicant information for a job posting (recruiter accounts only).',
    {
      jobId: z.string().describe('Job posting ID'),
      count: z.number().int().min(1).max(25).default(10).describe('Number of results (default: 10)'),
    },
    async ({ jobId, count }) => {
      return safeToolCall(logger, 'get_job_applicants', async () => {
        const data = await client.voyagerGet(
          `/jobs/jobPostings/${encodeURIComponent(jobId)}/applicants?count=${count}`,
        );
        return formatResult(data);
      });
    },
  );

  logger.debug('Job tools registered');
}

// ─── Network Tools ──────────────────────────────────────────

function registerNetworkTools(
  server: McpServer,
  _auth: AuthManager,
  client: LinkedInClient,
  logger: Logger,
): void {
  server.tool(
    'connect_with_person',
    'Send a connection request to a LinkedIn user with an optional personalized note.',
    {
      profileUrn: z.string().describe('Profile URN of the person to connect with'),
      message: z.string().optional().describe('Optional personalized connection note (max 300 chars)'),
    },
    async ({ profileUrn, message }) => {
      return safeToolCall(logger, 'connect_with_person', async () => {
        const body: Record<string, unknown> = {
          trackingId: `connect_${Date.now()}`,
          inviteeProfileUrn: profileUrn,
        };
        if (message) {
          body['message'] = message.slice(0, 300);
        }

        const data = await client.voyagerPost(
          '/growth/normInvitations',
          body,
        );
        return formatResult({ success: true, data });
      });
    },
  );

  server.tool(
    'get_connections',
    'List 1st-degree connections, sorted by recently added.',
    {
      count: z.number().int().min(1).max(40).default(20).describe('Number of connections (default: 20)'),
      start: z.number().int().min(0).default(0).describe('Pagination offset (default: 0)'),
    },
    async ({ count, start }) => {
      return safeToolCall(logger, 'get_connections', async () => {
        const data = await client.voyagerGet(
          `/relationships/dash/connections?q=search&sortType=RECENTLY_ADDED&count=${count}&start=${start}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_pending_invitations',
    'View sent and received connection invitations.',
    {
      direction: z.enum(['RECEIVED', 'SENT']).default('RECEIVED').describe('Direction: RECEIVED or SENT'),
      count: z.number().int().min(1).max(40).default(20).describe('Number of invitations (default: 20)'),
    },
    async ({ direction, count }) => {
      return safeToolCall(logger, 'get_pending_invitations', async () => {
        const invType = direction === 'SENT' ? 'sentInvitation' : 'receivedInvitation';
        const data = await client.voyagerGet(
          `/relationships/invitationViews?q=${invType}&count=${count}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'withdraw_invitation',
    'Cancel a sent connection invitation.',
    {
      invitationId: z.string().describe('Invitation ID to withdraw'),
    },
    async ({ invitationId }) => {
      return safeToolCall(logger, 'withdraw_invitation', async () => {
        const data = await client.voyagerPost(
          `/relationships/invitations/${encodeURIComponent(invitationId)}?action=withdraw`,
          {},
        );
        return formatResult({ success: true, data });
      });
    },
  );

  server.tool(
    'accept_invitation',
    'Accept a received connection invitation.',
    {
      invitationId: z.string().describe('Invitation ID to accept'),
      sharedSecret: z.string().describe('The shared secret from the invitation'),
    },
    async ({ invitationId, sharedSecret }) => {
      return safeToolCall(logger, 'accept_invitation', async () => {
        const data = await client.voyagerPost(
          `/relationships/invitations/${encodeURIComponent(invitationId)}?action=accept`,
          { sharedSecret },
        );
        return formatResult({ success: true, data });
      });
    },
  );

  server.tool(
    'get_network_stats',
    'Get network growth metrics and connection statistics.',
    {},
    async () => {
      return safeToolCall(logger, 'get_network_stats', async () => {
        const data = await client.voyagerGet(
          '/relationships/dash/connections?q=search&count=0',
        );
        return formatResult(data);
      });
    },
  );

  logger.debug('Network tools registered');
}

// ─── Feed & Content Tools ───────────────────────────────────

function registerFeedTools(
  server: McpServer,
  _auth: AuthManager,
  client: LinkedInClient,
  logger: Logger,
): void {
  server.tool(
    'get_feed',
    'Get posts from the LinkedIn home feed.',
    {
      count: z.number().int().min(1).max(25).default(10).describe('Number of posts (default: 10)'),
    },
    async ({ count }) => {
      return safeToolCall(logger, 'get_feed', async () => {
        const data = await client.voyagerGet(
          `/feed/updates?count=${count}`,
          { skipCache: true },
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'create_post',
    'Create a new text post on LinkedIn.',
    {
      text: z.string().min(1).max(3000).describe('Post content text'),
      visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC').describe('Post visibility'),
    },
    async ({ text, visibility }) => {
      return safeToolCall(logger, 'create_post', async () => {
        const visibilityMap = {
          PUBLIC: 'PUBLIC',
          CONNECTIONS: 'CONNECTIONS',
        };
        const data = await client.voyagerPost(
          '/contentcreation/normShares',
          {
            visibleToConnectionsOnly: visibility === 'CONNECTIONS',
            externalAudienceProviders: [],
            commentaryV2: { text },
            origin: 'MEMBER_SHARE',
            allowedCommentersScope: 'ALL',
            postState: 'PUBLISHED',
            mediaCategory: 'NONE',
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': visibilityMap[visibility] },
          },
        );
        return formatResult({ success: true, data });
      });
    },
  );

  server.tool(
    'react_to_post',
    'React to a LinkedIn post (like, celebrate, support, funny, love, insightful).',
    {
      postUrn: z.string().describe('The post/activity URN to react to'),
      reactionType: z.enum(['LIKE', 'PRAISE', 'EMPATHY', 'ENTERTAINMENT', 'LOVE', 'INTEREST']).default('LIKE').describe('Reaction type'),
    },
    async ({ postUrn, reactionType }) => {
      return safeToolCall(logger, 'react_to_post', async () => {
        const data = await client.voyagerPost(
          '/reactions',
          {
            reactionType,
            entityUrn: postUrn,
          },
        );
        return formatResult({ success: true, data });
      });
    },
  );

  server.tool(
    'comment_on_post',
    'Add a comment to a LinkedIn post.',
    {
      postUrn: z.string().describe('The post/activity URN to comment on'),
      text: z.string().min(1).max(1250).describe('Comment text'),
    },
    async ({ postUrn, text }) => {
      return safeToolCall(logger, 'comment_on_post', async () => {
        const data = await client.voyagerPost(
          '/feed/comments',
          {
            activityUrn: postUrn,
            commentary: { text },
          },
        );
        return formatResult({ success: true, data });
      });
    },
  );

  server.tool(
    'search_posts',
    'Search LinkedIn posts by keyword or hashtag.',
    {
      keywords: z.string().describe('Search keywords or #hashtag'),
      count: z.number().int().min(1).max(25).default(10).describe('Results per page (default: 10)'),
      start: z.number().int().min(0).default(0).describe('Pagination offset (default: 0)'),
    },
    async ({ keywords, count, start }) => {
      return safeToolCall(logger, 'search_posts', async () => {
        const data = await client.voyagerGet(
          `/search/dash/clusters?q=all&query=(flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(CONTENT),keywords:List(${encodeURIComponent(keywords)})))&count=${count}&start=${start}`,
        );
        return formatResult(data);
      });
    },
  );

  server.tool(
    'get_notifications',
    'Get recent LinkedIn notifications.',
    {
      count: z.number().int().min(1).max(20).default(10).describe('Number of notifications (default: 10)'),
    },
    async ({ count }) => {
      return safeToolCall(logger, 'get_notifications', async () => {
        const data = await client.voyagerGet(
          `/identity/notifications?count=${count}`,
          { skipCache: true },
        );
        return formatResult(data);
      });
    },
  );

  logger.debug('Feed & content tools registered');
}

// ─── Helper Functions ───────────────────────────────────────

/**
 * Wrap tool execution with structured error handling.
 * Ensures tools never crash — errors are returned as structured responses.
 */
async function safeToolCall(
  logger: Logger,
  toolName: string,
  fn: () => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>,
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    return await fn();
  } catch (error) {
    const isAuth = (error as AuthError)?.name === 'AuthError';
    const isApi = error instanceof LinkedInApiError;
    const message = error instanceof Error ? error.message : String(error);

    logger.error(`Tool ${toolName} failed`, {
      error: message,
      type: isAuth ? 'auth' : isApi ? 'api' : 'unknown',
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            error: message,
            tool: toolName,
            type: isAuth ? 'authentication_error' : isApi ? 'api_error' : 'internal_error',
            ...(isAuth
              ? { setup_guide: 'https://github.com/devag7/linkedin-pro-mcp#authentication' }
              : {}),
            ...(isApi ? { status: (error as LinkedInApiError).status } : {}),
          }),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Format API response data into MCP tool result.
 */
function formatResult(
  data: unknown,
): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Start the MCP server with the specified transport.
 */
export async function startServer(config: ServerConfig): Promise<void> {
  const logger = new Logger(config.logLevel);

  logger.info('Starting LinkedIn Pro MCP Server', {
    version: VERSION,
    transport: config.transport,
    port: config.transport === 'http' ? config.port : undefined,
  });

  const server = createServer(logger);

  if (config.transport === 'stdio') {
    await connectStdio(server, logger);
  } else {
    await startHttpServer(server, config.port, logger);
  }
}
