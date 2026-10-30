/** Synthetic finalization only. No live HTTP, package upload or tag mutation. */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  RECOVERY,
  assertRecoveryContext,
  assertRecoveryRequest,
  finalizeVerified440,
} from '../scripts/finalize-verified-4.4.0.mjs';
import { readMetadata, RELEASE_USER_AGENT } from '../scripts/release.mjs';

const server = JSON.parse(readFileSync('server.json', 'utf8'));
const helperHead = 'a'.repeat(40);
const context = () => ({
  env: {
    GITHUB_ACTIONS: 'true',
    RELEASE_DRY_RUN: 'false',
    GITHUB_REPOSITORY: RECOVERY.repo,
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: helperHead,
    CONFIRM_SOURCE: RECOVERY.source,
    GH_TOKEN: 'synthetic-token',
  },
  head: RECOVERY.source,
  tagCommit: RECOVERY.source,
  helperHead,
  pkg: { name: 'linkedin-mcp-tools', version: RECOVERY.version },
  server,
  pack: {
    name: 'linkedin-mcp-tools',
    version: RECOVERY.version,
    filename: RECOVERY.filename,
    integrity: RECOVERY.integrity,
  },
  archiveSha256: RECOVERY.sha256,
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

function destinations(
  change: {
    wrongProducer?: boolean;
    registryStatus?: string;
    scopedJobFailed?: boolean;
    scopedMissing?: boolean;
    scopedMismatch?: boolean;
  } = {},
) {
  let draft = true;
  const mutations: Array<{ url: string; body: string }> = [];
  const fetchImpl = vi.fn(async (url: string, options: RequestInit = {}) => {
    const parsed = new URL(url);
    const release = () => ({
      id: RECOVERY.releaseId,
      tag_name: RECOVERY.tag,
      target_commitish: RECOVERY.source,
      draft,
    });
    if (options.method === 'PATCH') {
      mutations.push({ url, body: options.body as string });
      draft = false;
      return response(release());
    }
    if (parsed.pathname.endsWith(`/actions/runs/${RECOVERY.producer}`))
      return response({
        id: RECOVERY.producer,
        head_sha: change.wrongProducer ? 'b'.repeat(40) : RECOVERY.source,
        name: 'Release',
        path: '.github/workflows/release.yml',
        event: 'push',
        head_branch: 'main',
        repository: { full_name: RECOVERY.repo },
        status: 'completed',
      });
    if (parsed.pathname.endsWith('/jobs'))
      return response({
        jobs: [
          ...['ubuntu-latest', 'macos-latest', 'windows-latest'].flatMap((os) =>
            [20, 22].map((node) => ({
              name: `compatibility (${os}, ${node})`,
              status: 'completed',
              conclusion: 'success',
            })),
          ),
          ...['release', 'github-packages', 'mcp-registry', 'finalize'].map((name) => ({
            name,
            status: 'completed',
            conclusion:
              name === 'finalize' || (change.scopedJobFailed && name === 'github-packages')
                ? 'failure'
                : 'success',
          })),
        ],
      });
    if (parsed.hostname === 'registry.npmjs.org')
      return response({
        name: context().pkg.name,
        versions: {
          [RECOVERY.version]: {
            ...context().pkg,
            dist: { integrity: RECOVERY.integrity },
          },
        },
      });
    if (parsed.hostname === 'npm.pkg.github.com')
      return response({
        name: RECOVERY.scopedName,
        versions: change.scopedMissing
          ? {}
          : {
              [RECOVERY.version]: {
                name: RECOVERY.scopedName,
                version: RECOVERY.version,
                dist: {
                  integrity: change.scopedMismatch ? 'sha512-different' : RECOVERY.scopedIntegrity,
                },
              },
            },
      });
    if (parsed.hostname === 'registry.modelcontextprotocol.io')
      return response({
        server,
        _meta: {
          'io.modelcontextprotocol.registry/official': {
            status: change.registryStatus ?? 'active',
          },
        },
      });
    if (parsed.pathname.startsWith('/users/'))
      return response({
        name: 'linkedin-mcp-tools',
        package_type: 'npm',
        visibility: 'public',
        repository: { full_name: RECOVERY.repo },
      });
    if (parsed.pathname.endsWith(`/releases/tags/${RECOVERY.tag}`))
      return draft ? response({}, 404) : response(release());
    if (parsed.pathname.endsWith('/releases')) return response([release()]);
    if (parsed.pathname.includes('/git/ref/tags/'))
      return response({
        ref: `refs/tags/${RECOVERY.tag}`,
        object: { type: 'commit', sha: RECOVERY.source },
      });
    if (parsed.pathname.includes('/commits/')) return response({ sha: RECOVERY.source });
    throw new Error('UNEXPECTED_SYNTHETIC_ROUTE');
  });
  return { fetchImpl, mutations };
}

describe('source and artifact bound finalization recovery', () => {
  it.each([
    (c) => {
      c.env.GITHUB_ACTIONS = 'false';
    },
    (c) => {
      c.env.RELEASE_DRY_RUN = 'true';
    },
    (c) => {
      c.env.GITHUB_REF = 'refs/heads/other';
    },
    (c) => {
      c.env.CONFIRM_SOURCE = 'b'.repeat(40);
    },
    (c) => {
      c.helperHead = 'b'.repeat(40);
    },
    (c) => {
      c.head = 'b'.repeat(40);
    },
    (c) => {
      c.tagCommit = 'b'.repeat(40);
    },
    (c) => {
      c.archiveSha256 = 'b'.repeat(64);
    },
    (c) => {
      c.pack.integrity = 'sha512-different';
    },
    (c) => {
      c.pkg.version = '4.3.0';
    },
    (c) => {
      c.server = { ...c.server, version: '4.3.0' };
    },
  ])('refuses a changed context before any HTTP', async (change) => {
    const c = context();
    change(c);
    const fetchImpl = vi.fn();
    await expect(finalizeVerified440(c, { fetchImpl })).rejects.toThrow('RECOVERY_CONTEXT_REFUSED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each([
    ['https://registry.npmjs.org/linkedin-mcp-tools', { method: 'PUT', body: '{}' }],
    [`https://api.github.com/repos/${RECOVERY.repo}/git/refs`, { method: 'POST', body: '{}' }],
    [
      `https://api.github.com/repos/${RECOVERY.repo}/releases/1`,
      { method: 'PATCH', body: '{"draft":false}' },
    ],
    [
      `https://api.github.com/repos/${RECOVERY.repo}/releases/${RECOVERY.releaseId}`,
      { method: 'PATCH', body: '{"draft":false,"target_commitish":"main"}' },
    ],
  ])('blocks uploads, tag creation and changed mutation targets', (url, options) => {
    expect(() => assertRecoveryRequest(url, options)).toThrow('RECOVERY_MUTATION_REFUSED');
  });
  it('refuses off-host requests and credential forwarding', () => {
    expect(() => assertRecoveryRequest('https://unrelated.invalid')).toThrow(
      'RECOVERY_DESTINATION_REFUSED',
    );
    expect(() =>
      assertRecoveryRequest('https://registry.modelcontextprotocol.io', {
        headers: { Authorization: 'Bearer synthetic' },
      }),
    ).toThrow('RECOVERY_AUTH_HOST_REFUSED');
    expect(() =>
      assertRecoveryRequest('https://registry.modelcontextprotocol.io', {
        headers: { authorization: 'Bearer synthetic' },
      }),
    ).toThrow('RECOVERY_AUTH_HOST_REFUSED');
    expect(() => assertRecoveryRequest('https://api.github.com/#fragment')).toThrow(
      'RECOVERY_DESTINATION_REFUSED',
    );
  });
  it('checks original producer and all published destinations before the single draft patch', async () => {
    const { fetchImpl, mutations } = destinations();
    const report = vi.fn();
    expect(await finalizeVerified440(context(), { fetchImpl, report })).toMatchObject({
      finalized: true,
      packageUploads: 0,
      tagMutations: 0,
      source: RECOVERY.source,
    });
    expect(mutations).toEqual([
      {
        url: `https://api.github.com/repos/${RECOVERY.repo}/releases/${RECOVERY.releaseId}`,
        body: '{"draft":false}',
      },
    ]);
    expect(report.mock.calls.map(([stage]) => stage)).toEqual([
      'verify_original_producer',
      'verify_npm',
      'verify_registry',
      'verify_public_scoped_package',
      'verify_source_tag_and_finalize_existing_draft',
    ]);
    await finalizeVerified440(context(), { fetchImpl });
    expect(mutations).toHaveLength(1); // Repeated recovery verifies the completed release.
  });
  it.each([
    { wrongProducer: true },
    { registryStatus: 'deleted' },
    { scopedJobFailed: true },
    { scopedMissing: true },
    { scopedMismatch: true },
  ])('does not finalize unverified producer or destination state %j', async (change) => {
    const { fetchImpl, mutations } = destinations(change);
    await expect(finalizeVerified440(context(), { fetchImpl })).rejects.toThrow();
    expect(mutations).toHaveLength(0);
  });
});

describe('release transport identity and redacted failures', () => {
  it('keeps redirect refusal and a finite abort signal with a declared client identity', async () => {
    const fetchImpl = vi.fn(async () => response({ valid: true }));
    await readMetadata('https://registry.modelcontextprotocol.io/example', { fetchImpl });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      redirect: 'error',
      headers: { 'User-Agent': RELEASE_USER_AGENT },
    });
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('reports the timed-out destination without raw URLs, tokens or errors', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException('synthetic-private-value', 'TimeoutError');
    });
    await expect(
      readMetadata('https://registry.modelcontextprotocol.io/example', { fetchImpl }),
    ).rejects.toThrow('DESTINATION_REGISTRY_TIMEOUT');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
