import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import { CAPABILITIES, type ToolName } from './capabilities.js';
import { outputSchema } from './contracts.js';
import { requestCancellation } from './cancellation.js';
import { failure } from './result.js';
const registrations = new WeakMap<McpServer, ToolName[]>();
export const registeredToolNames = (server: McpServer): readonly ToolName[] =>
  registrations.get(server) ?? [];
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
      description,
      inputSchema: inputSchema as z.ZodRawShape,
      outputSchema: schema,
      annotations: {
        readOnlyHint: !CAPABILITIES[name].write && name !== 'close_session',
        destructiveHint: CAPABILITIES[name].write,
        idempotentHint: !CAPABILITIES[name].write,
        openWorldHint: CAPABILITIES[name].source !== 'engine',
      },
    },
    async (args, extra) => {
      if (extra.signal.aborted) return failure(name, 'CANCELLED');
      const result = await requestCancellation.run(extra.signal, () =>
        (callback as ToolCallback<z.ZodRawShape>)(args, extra),
      );
      if (
        !result.isError &&
        (!schema.safeParse(result.structuredContent).success ||
          result.structuredContent?.data === null)
      )
        return failure(name, 'RESPONSE_SHAPE_CHANGED');
      return result;
    },
  );
  const names = registrations.get(server) ?? [];
  names.push(name);
  registrations.set(server, names);
}
