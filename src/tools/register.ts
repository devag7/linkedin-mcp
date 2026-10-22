import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CAPABILITIES, type ToolName } from './capabilities.js';
import { outputSchema } from './contracts.js';
import { requestCancellation } from './cancellation.js';
import { failure } from './result.js';
import { recordJobDetailCheck } from './job-detail-diagnostic.js';
type Extra = Parameters<ToolCallback<z.ZodRawShape>>[1];
type ReadCallback = (
  args: Record<string, unknown>,
  extra: Extra,
) => ReturnType<ToolCallback<z.ZodRawShape>>;
const briefReads = new WeakMap<McpServer, Map<string, ReadCallback>>();
/** Only these two registered read bodies can be composed; never recurse or invoke writes. */
export function invokeBriefRead(
  server: McpServer,
  name: 'search_jobs' | 'get_job_details',
  args: Record<string, unknown>,
  extra: Extra,
) {
  const callback = briefReads.get(server)?.get(name);
  if (!callback) throw new Error('Brief read unavailable');
  return callback(args, extra);
}
const registrations = new WeakMap<McpServer, ToolName[]>();
export const registeredToolNames = (server: McpServer): readonly ToolName[] =>
  registrations.get(server) ?? [];
const TOOL_TITLES: Record<ToolName, string> = {
  whoami: 'Inspect local session',
  health_check: 'Check LinkedIn session health',
  close_session: 'Close browser session',
  get_my_profile: 'Get my profile',
  get_profile: 'Get a profile',
  get_feed: 'Get feed',
  get_notifications: 'Get notifications',
  search_people: 'Search people',
  search_jobs: 'Search jobs',
  research_jobs: 'Build job research brief',
  get_inbox: 'Get inbox',
  get_job_details: 'Get job details',
  prepare_job_application: 'Prepare job application worksheet',
  export_application_tracker: 'Export application tracker',
  search_companies: 'Search companies',
  get_company: 'Get company',
  get_company_posts: 'Get company posts',
  get_company_employees: 'Get company employees',
  get_pending_invitations: 'Get pending invitations',
  get_conversation: 'Get conversation',
  connect_with_person: 'Connect with person',
  send_message: 'Send message',
  create_post: 'Create post',
  react_to_post: 'React to post',
  comment_on_post: 'Comment on post',
};
/** All registrations share native contracts while retaining JSON text for older clients. */
export function registerTool<Args extends z.ZodRawShape>(
  server: McpServer,
  name: ToolName,
  description: string,
  inputSchema: Args,
  callback: ToolCallback<Args>,
): void {
  const schema = outputSchema(name);
  server.registerTool(
    name,
    {
      title: TOOL_TITLES[name],
      description,
      inputSchema: inputSchema as z.ZodRawShape,
      outputSchema: schema,
      annotations: {
        readOnlyHint: !CAPABILITIES[name].write && name !== 'close_session',
        destructiveHint: CAPABILITIES[name].write || name === 'close_session',
        idempotentHint: !CAPABILITIES[name].write,
        openWorldHint: CAPABILITIES[name].source !== 'engine',
      },
    },
    async (args, extra) => {
      if (extra.signal.aborted) return failure(name, 'CANCELLED');
      const result = await requestCancellation.run(extra.signal, () =>
        (callback as ToolCallback<z.ZodRawShape>)(args, extra),
      );
      if (!result.isError) {
        const valid = schema.safeParse(result.structuredContent).success;
        const nullData = result.structuredContent?.data === null;
        if (name === 'get_job_details')
          recordJobDetailCheck(
            server,
            !valid ? 'output_shape_rejected' : nullData ? 'output_null_data' : 'output_accepted',
          );
        if (!valid || nullData) return failure(name, 'RESPONSE_SHAPE_CHANGED');
      }
      return result;
    },
  );
  if (name === 'search_jobs' || name === 'get_job_details') {
    const reads = briefReads.get(server) ?? new Map<string, ReadCallback>();
    reads.set(name, async (args, extra) => {
      if (extra.signal.aborted) return failure(name, 'CANCELLED');
      const parsed = z.object(inputSchema).strict().parse(args);
      const result = await (callback as ToolCallback<z.ZodRawShape>)(parsed, extra);
      if (!result.isError) {
        const valid = schema.safeParse(result.structuredContent).success;
        if (name === 'get_job_details')
          recordJobDetailCheck(
            server,
            !valid
              ? 'output_shape_rejected'
              : result.structuredContent?.data === null
                ? 'output_null_data'
                : 'output_accepted',
          );
        if (!valid) return failure(name, 'RESPONSE_SHAPE_CHANGED');
      }
      return result;
    });
    briefReads.set(server, reads);
  }
  const names = registrations.get(server) ?? [];
  names.push(name);
  registrations.set(server, names);
}
