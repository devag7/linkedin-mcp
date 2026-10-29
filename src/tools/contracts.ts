import { z } from 'zod';
import type { ToolName } from './capabilities.js';
import { followUpPlanSchema } from './application-follow-up.js';
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
      content: z.record(z.string(), z.unknown()),
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
const applicationEvidenceSource = z.object({
  kind: z.enum(['inline', 'library']),
  evidenceId: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/)
    .nullable(),
  sourceLabel: z
    .string()
    .max(200)
    .nullable()
    .describe('Opaque user-provided label only; not a file/URL read or verification'),
});
const applicationEvidenceItem = z.object({
  text: z.string().min(1).max(1000),
  verification: z.literal('user_supplied_unverified'),
  sources: z.array(applicationEvidenceSource).min(1).max(11),
});
const dataSchemas: Record<ToolName, z.ZodTypeAny> = {
  whoami: row({
    server: z.literal('linkedin-mcp'),
    version: z.string(),
    loggedIn: z.boolean().nullable(),
    sessionState: z.enum(['not_checked', 'logged_in', 'logged_out']),
    tools: z.number().int(),
    capabilities: z.array(z.record(z.string(), z.unknown())),
    circuitOpen: z.boolean(),
  }),
  health_check: row({
    status: z.enum(['blocked', 'healthy', 'logged_out', 'degraded']),
    version: z.string(),
    voyager: z.enum(['blocked', 'ok', 'auth_required', 'error']),
    circuitOpen: z.boolean(),
    budget: z.record(z.string(), z.unknown()),
  }),
  close_session: row({ closed: z.literal(true) }),
  get_my_profile: profile,
  get_profile: profile,
  get_feed: z.array(row({ actor: str, text: str, activityUrn: str, sourceUrl: str })).max(25),
  get_notifications: z
    .array(row({ headline: str, text: str, publishedAt: num, read: z.boolean().optional() }))
    .max(50),
  search_people: z.array(person).max(25),
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
  prepare_job_application: z.object({
    status: z.literal('draft_only'),
    jobId: z.string(),
    sourceUrl: z.string().url(),
    jobTitle: z.string(),
    company: z.string().nullable(),
    sourceVerification: z.literal('user_supplied_not_fetched'),
    requirements: z
      .array(
        z.object({
          requirement: z.string(),
          evidence: z.string().nullable(),
          evidenceStatus: z.enum(['user_supplied_unverified', 'missing']),
          evidenceItems: z.array(applicationEvidenceItem).max(11).optional(),
        }),
      )
      .max(20),
    missingEvidenceCount: z.number().int().nonnegative(),
    nextSteps: z.array(z.string()),
    submitted: z.literal(false),
    stored: z.literal(false),
    drafts: z
      .object({
        verification: z.literal('user_supplied_unverified'),
        resumeBullets: z
          .array(z.string().max(6002))
          .max(50)
          .describe('Quoted plain-text renderings; exact evidence text remains in lineage'),
        coverLetter: z.string().max(315000),
        lineage: z
          .array(
            z.object({
              bulletIndex: z.number().int().min(0).max(49),
              text: z.string().min(1).max(1000),
              verification: z.literal('user_supplied_unverified'),
              bindings: z
                .array(
                  z.object({
                    requirementIndex: z.number().int().min(0).max(19),
                    requirement: z.string().min(1).max(1000),
                    sources: z.array(applicationEvidenceSource).min(1).max(11),
                  }),
                )
                .min(1)
                .max(20),
            }),
          )
          .max(50),
        remainingQuestions: z.array(z.string().max(6500)).max(22),
      })
      .optional(),
    interviewPrep: z
      .object({
        status: z.literal('practice_only'),
        verification: z.literal('user_supplied_unverified'),
        practiceQuestions: z
          .array(
            z.object({
              requirementIndex: z.number().int().min(0).max(19),
              question: z.string().max(6500),
              evidenceItemIndices: z
                .array(z.number().int().min(0).max(10))
                .max(11)
                .describe(
                  'Indices into evidenceItems on the requirement identified by requirementIndex',
                ),
              evidenceStatus: z.enum(['user_supplied_unverified', 'missing']),
              starWorksheet: z.object({
                situation: z.null(),
                task: z.null(),
                action: z.null(),
                result: z.null(),
              }),
            }),
          )
          .min(1)
          .max(20),
        questionsForInterviewer: z.array(z.string().max(500)).max(3),
        followUpTemplate: z.object({
          kind: z.literal('fill_in_template'),
          requiresVerifiedInterview: z
            .literal(true)
            .describe(
              'A human must verify the interview context before using this template; this is not an event assertion',
            ),
          subject: z.string().max(12500),
          body: z.string().max(13500),
          placeholders: z
            .array(
              z.enum([
                '[INTERVIEWER_NAME]',
                '[INTERVIEW_DATE]',
                '[DISCUSSION_TOPIC]',
                '[NEXT_STEP_OR_QUESTION]',
                '[YOUR_NAME]',
              ]),
            )
            .length(5),
        }),
      })
      .optional(),
  }),
  export_application_tracker: z.object({
    status: z.literal('export_only'),
    sourceVerification: z.literal('user_supplied_not_fetched'),
    records: z
      .array(
        z.object({
          jobId: z.string(),
          title: z.string(),
          company: z.string().nullable(),
          status: z.enum([
            'interested',
            'drafting',
            'submitted_unverified',
            'receipt_verified',
            'rejected',
            'withdrawn',
          ]),
          updatedAt: z.string().datetime(),
          receiptConfirmed: z.boolean(),
          nextAction: z.string().nullable(),
          followUpAt: z.string().datetime().nullable(),
          sourceUrl: z.string().url(),
        }),
      )
      .max(50),
    csv: z.string(),
    stored: z.literal(false),
    submittedByTool: z.literal(false),
    followUpPlan: followUpPlanSchema.optional(),
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
    errors: z.record(z.string(), z.string()).optional(),
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
