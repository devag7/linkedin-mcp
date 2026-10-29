/** Pure, unsaved application material assembly. All supplied text is data, never instructions. */
import { z } from 'zod';

const boundedText = z.string().trim().min(1).max(1000);
const exactText = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((text) => text.trim().length > 0, 'Text must not be blank.');
const evidenceId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);

export const applicationInputShape = {
  job_id: z
    .string()
    .regex(/^[0-9]{1,20}$/)
    .describe('Numeric LinkedIn job ID'),
  job_title: boundedText.describe('Title copied from the selected listing; not verified here'),
  company: boundedText.optional().describe('Optional company copied from the listing'),
  requirements: z
    .array(
      z.object({
        requirement: boundedText.describe('One requirement copied or summarized by you'),
        evidence: boundedText.optional().describe('Your own truthful evidence; omit if unknown'),
        evidence_ids: z
          .array(evidenceId)
          .max(10)
          .optional()
          .describe('Up to 10 unique, case-sensitive IDs from your evidence_library'),
      }),
    )
    .min(1)
    .max(20)
    .describe('At most 20 requirements and your matching evidence'),
  evidence_library: z
    .array(
      z.object({
        id: evidenceId.describe(
          'Unique case-sensitive ID: 1–64 letters, digits, hyphens or underscores; first character alphanumeric',
        ),
        text: exactText(1000).describe('Exact user-provided evidence; not verified or interpreted'),
        source_label: exactText(200)
          .optional()
          .describe('Optional user-provided label only; no file or URL is read or verified'),
      }),
    )
    .max(30)
    .optional()
    .describe('Up to 30 user-provided facts; only referenced facts are selected'),
  include_drafts: z
    .boolean()
    .optional()
    .describe('Default false: include deterministic, unverified plain-text drafts only when true'),
  include_interview_prep: z
    .boolean()
    .optional()
    .describe(
      'Default false: optional offline practice questions, blank STAR worksheets and an unsent fill-in follow-up template; no interview is verified',
    ),
};
export const applicationInputSchema = z.object(applicationInputShape);
export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export class ApplicationEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplicationEvidenceError';
  }
}

interface EvidenceSource {
  kind: 'inline' | 'library';
  evidenceId: string | null;
  sourceLabel: string | null;
}
interface EvidenceItem {
  text: string;
  verification: 'user_supplied_unverified';
  sources: EvidenceSource[];
}
interface RequirementBinding {
  requirementIndex: number;
  requirement: string;
  sources: EvidenceSource[];
}
interface DraftLineage {
  bulletIndex: number;
  text: string;
  verification: 'user_supplied_unverified';
  bindings: RequirementBinding[];
}

/** Render data as one quoted plain-text value; retain original text in structured lineage. */
function quotedText(text: string): string {
  return JSON.stringify(text).replace(
    /[\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/** Input bounds are validated by the same schema used by the MCP registration. */
export function prepareApplicationMaterials(raw: ApplicationInput) {
  const input = applicationInputSchema.parse(raw);
  const library = new Map<string, NonNullable<ApplicationInput['evidence_library']>[number]>();
  for (const fact of input.evidence_library ?? []) {
    if (library.has(fact.id))
      throw new ApplicationEvidenceError('Evidence-library IDs must be unique.');
    library.set(fact.id, fact);
  }
  // Validate all references before assembling any output; never silently bind a missing ID.
  for (const requirement of input.requirements) {
    const refs = requirement.evidence_ids ?? [];
    if (new Set(refs).size !== refs.length)
      throw new ApplicationEvidenceError('Evidence IDs within each requirement must be unique.');
    if (refs.some((id) => !library.has(id)))
      throw new ApplicationEvidenceError(
        'Every evidence ID must reference a record in evidence_library.',
      );
  }
  const extended =
    input.evidence_library !== undefined ||
    input.requirements.some((requirement) => requirement.evidence_ids !== undefined) ||
    input.include_drafts === true ||
    input.include_interview_prep === true;
  const lineage = new Map<string, DraftLineage>();
  const rows = input.requirements.map(
    ({ requirement, evidence, evidence_ids }, requirementIndex) => {
      const selected = new Map<string, EvidenceItem>();
      const add = (text: string, source: EvidenceSource) => {
        const item = selected.get(text);
        if (item) item.sources.push(source);
        else
          selected.set(text, { text, verification: 'user_supplied_unverified', sources: [source] });
      };
      if (evidence !== undefined)
        add(evidence, { kind: 'inline', evidenceId: null, sourceLabel: null });
      for (const id of evidence_ids ?? []) {
        const fact = library.get(id)!; // Every reference was checked above.
        add(fact.text, { kind: 'library', evidenceId: id, sourceLabel: fact.source_label ?? null });
      }
      const evidenceItems = [...selected.values()];
      for (const item of evidenceItems) {
        const binding = { requirementIndex, requirement, sources: item.sources };
        const previous = lineage.get(item.text);
        if (previous) previous.bindings.push(binding);
        else
          lineage.set(item.text, {
            bulletIndex: lineage.size,
            text: item.text,
            verification: 'user_supplied_unverified',
            bindings: [binding],
          });
      }
      return {
        requirement,
        // Preserve the original inline field. Library selections have explicit evidenceItems.
        evidence: evidence ?? null,
        evidenceStatus: evidenceItems.length
          ? ('user_supplied_unverified' as const)
          : ('missing' as const),
        ...(extended ? { evidenceItems } : {}),
      };
    },
  );
  const missing = rows.flatMap((row, requirementIndex) =>
    row.evidenceStatus === 'missing' ? [{ requirementIndex, requirement: row.requirement }] : [],
  );
  const selectedFacts = [...lineage.values()];
  // JSON quoting keeps embedded newlines/control text visibly inside supplied data.
  // No templating, interpolation of instructions, inference or external lookup occurs.
  const role = `${quotedText(input.job_title)}${input.company ? ` at ${quotedText(input.company)}` : ''}`;
  const drafts =
    input.include_drafts === true
      ? {
          verification: 'user_supplied_unverified' as const,
          resumeBullets: selectedFacts.map((item) => quotedText(item.text)),
          coverLetter: [
            'Draft for human review. All supplied evidence and listing text remain unverified.',
            'Dear hiring team,',
            `I am preparing an application for the role ${role}.`,
            selectedFacts.length
              ? 'The examples I have supplied for review are:\n' +
                selectedFacts.map((item) => `- ${quotedText(item.text)}`).join('\n')
              : 'No evidence has been supplied for this draft. No qualifications or fit have been established.',
            'Thank you for your time.',
          ].join('\n\n'),
          lineage: selectedFacts,
          remainingQuestions: [
            ...missing.map(
              (row) =>
                `What truthful evidence can you provide for requirement ${row.requirementIndex + 1}: ${quotedText(row.requirement)}?`,
            ),
            'Have you verified every supplied statement and source label against your own records?',
            'Have you checked the current listing and reviewed the final materials before sending them yourself?',
          ],
        }
      : undefined;
  const interviewPrep =
    input.include_interview_prep === true
      ? {
          status: 'practice_only' as const,
          verification: 'user_supplied_unverified' as const,
          practiceQuestions: rows.map((row, requirementIndex) => ({
            requirementIndex,
            question:
              row.evidenceStatus === 'missing'
                ? `For requirement ${quotedText(row.requirement)}, no evidence is selected. What truthful example, if any, can you provide? Leave unknown STAR fields blank.`
                : `For requirement ${quotedText(row.requirement)}, use only the selected statements to practice describing the situation, task, your own actions and a verifiable result. What remains unknown?`,
            // Indices refer only to this requirement's resolved evidence, not the whole library.
            evidenceItemIndices: (row.evidenceItems ?? []).map((_item, index) => index),
            evidenceStatus: row.evidenceStatus,
            starWorksheet: { situation: null, task: null, action: null, result: null },
          })),
          questionsForInterviewer: [
            'What would success in the first three months look like?',
            'Which responsibilities are the highest priority for this role?',
            'How are expectations and feedback communicated?',
          ],
          followUpTemplate: {
            kind: 'fill_in_template' as const,
            requiresVerifiedInterview: true as const,
            subject: `Follow-up template for ${role}`,
            body: [
              'FILL-IN TEMPLATE ONLY — do not send without human review.',
              'Use only if you personally verify that an interview occurred, the recipient is correct, and every detail is truthful. This tool does not establish those facts.',
              `Role/company copied from your supplied listing: ${role}.`,
              'Hello [INTERVIEWER_NAME],',
              '[ONLY IF VERIFIED: add a truthful acknowledgement of the interview on [INTERVIEW_DATE].]',
              '[ADD A TRUE NOTE ABOUT [DISCUSSION_TOPIC]; omit any claim you cannot verify.]',
              '[NEXT_STEP_OR_QUESTION]',
              '[YOUR_NAME]',
            ].join('\n\n'),
            placeholders: [
              '[INTERVIEWER_NAME]',
              '[INTERVIEW_DATE]',
              '[DISCUSSION_TOPIC]',
              '[NEXT_STEP_OR_QUESTION]',
              '[YOUR_NAME]',
            ],
          },
        }
      : undefined;
  return {
    status: 'draft_only' as const,
    jobId: input.job_id,
    sourceUrl: `https://www.linkedin.com/jobs/view/${input.job_id}/`,
    jobTitle: input.job_title,
    company: input.company ?? null,
    sourceVerification: 'user_supplied_not_fetched' as const,
    requirements: rows,
    missingEvidenceCount: missing.length,
    nextSteps: [
      'Open the current job listing and verify its identity, requirements and application method.',
      'Check every evidence statement against your own resume and records; fill missing answers truthfully.',
      'Review the application and submit it yourself on LinkedIn or the employer site; keep its receipt privately.',
    ],
    submitted: false as const,
    stored: false as const,
    ...(drafts ? { drafts } : {}),
    ...(interviewPrep ? { interviewPrep } : {}),
  };
}
