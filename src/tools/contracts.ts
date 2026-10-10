import { briefSchema } from './research-contract.js';
import { z } from 'zod';
import type { ToolName } from './capabilities.js';
const str = z.string().optional();
const num = z.number().optional();
const row = (shape: z.ZodRawShape) => z.object(shape).passthrough();
const person = row({
  name: str,
  headline: str,
  location: str,
  publicIdentifier: str,
  profileUrl: str,
});
const company = row({ name: str, universalName: str, companyUrl: str, subtitle: str });
const profile = row({
  publicIdentifier: str,
  firstName: str,
  lastName: str,
  headline: str,
  summary: str,
  locationName: str,
  industryName: str,
  pictureUrl: str,
  sourceUrl: str,
  experience: z.array(row({ title: str, company: str, dates: str, location: str })),
  education: z.array(row({ school: str, degree: str, dates: str })),
  skills: z.array(row({ name: str, detail: str })),
  certifications: z.array(row({ name: str, issuer: str, dates: str })),
  languages: z.array(row({ name: str, proficiency: str })),
});
const invitation = row({
  fromName: str,
  fromHeadline: str,
  sentAt: num,
  message: str,
  invitationUrn: str,
  sharedSecret: str,
});
const write = z.union([
  row({
    refused: z.literal(true),
    reason: z.string(),
    preview: row({
      operationId: z.string(),
      payloadHash: z.string(),
      token: z.string(),
      expiresAt: z.string().datetime(),
      action: z.string(),
      target: z.string(),
      route: z.string(),
      effect: z.string(),
      content: z.record(z.unknown()),
    }),
  }),
  row({
    action: z.string(),
    status: z.enum([
      'ok',
      'duplicate',
      'already_connected',
      'restricted',
      'quota_exhausted',
      'not_allowed',
      'failed',
      'unknown',
    ]),
    ok: z.boolean(),
    operationId: str,
    replayed: z.boolean().optional(),
    httpStatus: num,
    detail: str,
  }),
]);
const dataSchemas: Record<ToolName, z.ZodTypeAny> = {
  whoami: row({
    server: z.literal('linkedin-mcp'),
    version: z.string(),
    loggedIn: z.boolean().nullable(),
    sessionState: z.enum(['not_checked', 'logged_in', 'logged_out']),
    tools: z.number().int(),
    capabilities: z.array(z.record(z.unknown())),
    circuitOpen: z.boolean(),
  }),
  health_check: row({
    status: z.enum(['blocked', 'healthy', 'logged_out', 'degraded']),
    version: z.string(),
    voyager: z.enum(['blocked', 'ok', 'auth_required', 'error']),
    circuitOpen: z.boolean(),
    budget: z.record(z.unknown()),
  }),
  close_session: row({ closed: z.literal(true) }),
  get_my_profile: profile,
  get_profile: profile,
  get_feed: z.array(row({ actor: str, text: str, activityUrn: str, sourceUrl: str })).max(25),
  get_notifications: z
    .array(row({ headline: str, text: str, publishedAt: num, read: z.boolean().optional() }))
    .max(50),
  search_people: z.array(person).max(25),
  research_jobs: briefSchema,
  search_jobs: z
    .array(row({ title: str, location: str, listedAt: num, jobUrn: str, sourceUrl: str }))
    .max(25),
  get_inbox: z
    .array(
      row({
        title: str,
        participants: z
          .array(row({ name: str, headline: str, profileUrn: str, profileUrl: str }))
          .optional(),
        groupChat: z.boolean().optional(),
        lastActivityAt: num,
        unreadCount: num,
        read: z.boolean().optional(),
        conversationUrn: str,
      }),
    )
    .max(50),
  get_job_details: row({
    title: str,
    description: str,
    company: str,
    location: str,
    workplaceType: str,
    jobUrn: str,
    listedAt: num,
    sourceUrl: str,
  }),
  search_companies: z.array(company).max(25),
  get_company: row({
    universalName: z.string(),
    name: str,
    tagline: str,
    description: str,
    website: str,
    industry: str,
    companySize: str,
    headquarters: str,
    founded: str,
    sourceUrl: str,
  }),
  get_company_posts: z.array(row({ text: str, meta: str })).max(25),
  get_company_employees: z.array(person).max(25),
  get_pending_invitations: row({
    received: z.array(invitation).max(100).optional(),
    sent: z.array(invitation).max(100).optional(),
    errors: z.record(z.string()).optional(),
  }),
  get_conversation: z
    .array(
      row({
        text: str,
        deliveredAt: num,
        sender: str,
        senderProfileUrn: str,
        fromSelf: z.boolean().optional(),
      }),
    )
    .max(100),
  connect_with_person: write,
  send_message: write,
  create_post: write,
  react_to_post: write,
  comment_on_post: write,
};
export const metaSchema = z.object({
  contractVersion: z.literal(1),
  fetchedAt: z.string().datetime(),
  source: z.enum(['voyager', 'dom', 'engine']),
  partial: z.boolean(),
  status: z.enum(['ok', 'empty', 'partial', 'error']),
  nextCursor: z.string().optional(),
  pagination: z
    .object({
      offset: z.number().int().nonnegative(),
      count: z.number().int().positive(),
      continuation: z.enum(['available', 'end', 'unknown', 'unsupported']),
    })
    .optional(),
});
// Clients may validate error responses too. Keep legacy error fields alongside a native envelope.
export const outputSchema = (name: ToolName) =>
  z.object({
    data: dataSchemas[name].nullable(),
    meta: metaSchema,
    error: str,
    code: str,
    tool: str,
    hint: str,
  });
