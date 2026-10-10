/** Synthetic offline demo through a real MCP SDK client. Never launches Chrome. */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BrowserContext, Page } from 'patchright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createRuntime, createServer } from '../src/server.js';
import { Logger } from '../src/types.js';
const dir = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-brief-demo-')));
process.env.LINKEDIN_PROFILE_DIR = join(dir, 'profile');
process.env.LINKEDIN_ENABLE_WRITES = 'false';
const runtime = createRuntime(new Logger('error'), false, {
  storagePath: join(dir, 'budget.json'),
});
// Only provider/browser boundary and pacing are replaced. Actual assembly, bounds,
// account binding, durable guard, schemas, tool registration and MCP flow run.
runtime.engine.ensureContext = async () => ({}) as BrowserContext;
runtime.pacer.waitBefore = async () => {};
let syntheticFetches = 0;
runtime.engine.getFeedPage = async () =>
  ({
    evaluate: async (_fn: unknown, { url }: { url: string }) => {
      syntheticFetches++;
      const data = url.endsWith('/me')
        ? { included: [{ entityUrn: 'urn:li:fsd_profile:synthetic-brief-owner' }] }
        : url.includes('jobPosting')
          ? {
              data: {
                title: 'Synthetic platform engineer',
                entityUrn: 'urn:li:fsd_jobPosting:1',
                description: {
                  text: 'Synthetic example: build reliable TypeScript services. Salary and availability are not supplied.',
                },
                formattedLocation: 'Synthetic remote region',
                companyDetails: { name: 'Synthetic Example Company' },
                workRemoteAllowed: true,
              },
            }
          : {
              included: [1, 2].map((id) => ({
                $type: 'com.linkedin.voyager.jobs.JobPosting',
                title: id === 1 ? 'Synthetic platform engineer' : 'Synthetic API engineer',
                formattedLocation: 'Synthetic remote region',
                entityUrn: `urn:li:fsd_jobPosting:${id}`,
              })),
            };
      return { status: 200, ok: true, type: 'basic', url, body: JSON.stringify(data) };
    },
  }) as unknown as Page;
const { server } = createServer(new Logger('error'), runtime);
const client = new Client({ name: 'offline-brief-demo', version: '1' });
try {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  await client.listTools();
  const response = await client.callTool({
    name: 'research_jobs',
    arguments: { keywords: 'TypeScript services', count: 2 },
  });
  if (response.isError) throw new Error('Synthetic demo failed');
  const data = response.structuredContent!;
  console.log(
    JSON.stringify(
      {
        scope: 'Synthetic offline fixture; source links are illustrative, not observed listings.',
        linkedInRequests: 0,
        browserLaunches: 0,
        syntheticFetches,
        result: data,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
  await server.close();
  await runtime.engine.dispose();
  rmSync(dir, { recursive: true, force: true });
}
