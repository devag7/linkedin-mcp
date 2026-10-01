/** Actual release helpers with synthetic destinations; never publish in tests. */
import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  releaseIdentity,
  packIdentity,
  readMetadata,
  packageState,
  verifyPackage,
  verifyPublicGithubPackage,
  registryState,
  verifyRegistry,
  githubRelease,
  NPM,
  GITHUB_PACKAGES,
} from '../scripts/release.mjs';
import { verifyPublisher } from '../scripts/install-mcp-publisher.mjs';

const pkg = { name: 'linkedin-mcp-tools', version: '2.0.4' };
const head = 'a'.repeat(40);
const integrity = 'sha512-' + Buffer.alloc(64, 1).toString('base64');
const pack = { ...pkg, integrity, filename: 'linkedin-mcp-tools-2.0.4.tgz' };
const metadata = (value = pkg, digest = integrity) => ({
  name: value.name,
  versions: { [value.version]: { ...value, dist: { integrity: digest } } },
});
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe('public scoped destination', () => {
  const publicPackage = {
    name: 'linkedin-mcp-tools',
    package_type: 'npm',
    visibility: 'public',
    repository: { full_name: 'devag7/linkedin-mcp' },
  };
  it('checks public visibility without sending workflow credentials', async () => {
    const fetchImpl = vi.fn(async () => response(publicPackage));
    await verifyPublicGithubPackage({ fetchImpl, token: 'synthetic-secret' });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
  it.each([
    { visibility: 'private' },
    { visibility: 'internal' },
    { name: 'another-package' },
    { package_type: 'container' },
    { repository: { full_name: 'another/repository' } },
  ])('rejects nonpublic or unrelated metadata %j', async (change) => {
    await expect(
      verifyPublicGithubPackage({
        fetchImpl: async () => response({ ...publicPackage, ...change }),
      }),
    ).rejects.toThrow('GITHUB_PACKAGE_NOT_PUBLIC');
  });
  it('rejects missing public metadata', async () => {
    await expect(
      verifyPublicGithubPackage({ fetchImpl: async () => response({}, 404) }),
    ).rejects.toThrow('GITHUB_PACKAGE_NOT_PUBLIC');
  });
});
describe('actual workflow source guard', () => {
  const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
  const script = workflow.match(/run: node -e '(if \(!\/[^\n]+)'/)![1];
  it.each([
    ['main', 'false', 0],
    ['v3.0.0', 'false', 0],
    ['v3.0.0', 'true', 0],
    ['a'.repeat(40), 'true', 0],
    ['a'.repeat(40), 'false', 1],
    ['codex/arbitrary', 'true', 1],
    ['v3x0x0', 'false', 1],
    ['main;exit 0', 'true', 1],
  ])('checks ref %s with dry run %s', (ref, dryRun, status) => {
    expect(
      spawnSync(process.execPath, ['-e', script], {
        env: { ...process.env, RELEASE_REF: ref, MANUAL_DRY_RUN: dryRun },
      }).status,
    ).toBe(status);
  });
});
const server = {
  name: 'io.github.devag7/linkedin-mcp',
  version: '2.0.4',
  packages: [{ registryType: 'npm', identifier: pkg.name, version: pkg.version }],
};
const registry = {
  server,
  _meta: { 'io.modelcontextprotocol.registry/official': { status: 'active' } },
};

describe('release source and artifact identity', () => {
  it('keeps a failed npm release eligible even when its tag already exists', () => {
    expect(releaseIdentity(pkg, head, head).eligible).toBe(true);
    expect(releaseIdentity(pkg, head, undefined).eligible).toBe(true);
  });
  it('does not publish new source under a previously released version', () => {
    expect(releaseIdentity(pkg, head, 'b'.repeat(40)).eligible).toBe(false);
  });
  it.each([
    { ...pkg, name: 'other' },
    { ...pkg, version: '2.0.4;bad' },
    { ...pkg, version: 'next' },
  ])('refuses invalid release identity %j', (value) => {
    expect(() => releaseIdentity(value, head)).toThrow('INVALID_RELEASE_IDENTITY');
  });
  it.each([
    [],
    [pack, pack],
    [{ ...pack, filename: '../escape.tgz' }],
    [{ ...pack, integrity: 'invalid' }],
    [{ ...pack, version: '2.0.3' }],
  ])('refuses invalid tarball identity %j', (value) => {
    expect(() => packIdentity(pkg, value)).toThrow();
  });
  it('accepts a single version/name/integrity-bound tarball', () => {
    expect(packIdentity(pkg, [pack])).toEqual(pack);
  });
});
describe('independent npm and GitHub Packages checks', () => {
  it('can resume after a failed npm step without manufacturing another version', async () => {
    expect(await packageState(pkg, pack, NPM, { fetchImpl: async () => response({}, 404) })).toBe(
      'missing',
    );
    expect(
      await packageState(pkg, pack, NPM, { fetchImpl: async () => response(metadata()) }),
    ).toBe('verified');
  });
  it('recognizes a missing version in an existing package', async () => {
    expect(
      await packageState(pkg, pack, NPM, {
        fetchImpl: async () => response({ name: pkg.name, versions: {} }),
      }),
    ).toBe('missing');
  });
  it.each([401, 403, 429, 500, 503])(
    'HTTP %s never means absent/permission to publish',
    async (status) => {
      await expect(
        packageState(pkg, pack, NPM, { fetchImpl: async () => response({}, status) }),
      ).rejects.toThrow(`DESTINATION_HTTP_${status}`);
    },
  );
  it.each([
    metadata(pkg, 'different'),
    {},
    { name: pkg.name, versions: [] },
    { name: pkg.name, versions: { [pkg.version]: null } },
  ])('blocks invalid or different published content %j', async (body) => {
    await expect(
      packageState(pkg, pack, NPM, { fetchImpl: async () => response(body) }),
    ).rejects.toThrow();
  });
  it('checks scoped publication separately and sends its token only to the fixed registry', async () => {
    const scoped = { ...pkg, name: '@devag7/linkedin-mcp-tools' };
    const fetchImpl = vi.fn(async () => response(metadata(scoped)));
    expect(
      await packageState(scoped, { ...pack, name: scoped.name }, GITHUB_PACKAGES, {
        token: 'synthetic-token',
        fetchImpl,
      }),
    ).toBe('verified');
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://npm.pkg.github.com/%40devag7%2Flinkedin-mcp-tools',
    );
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      redirect: 'error',
      headers: { Authorization: 'Bearer synthetic-token' },
    });
    await expect(packageState(pkg, pack, 'https://invalid.example', { fetchImpl })).rejects.toThrow(
      'UNSUPPORTED_PACKAGE_REGISTRY',
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('verifies propagation with a bounded wait; never repeats publish', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({}, 404))
      .mockResolvedValueOnce(response(metadata()));
    const wait = vi.fn(async () => undefined);
    await verifyPackage(pkg, pack, NPM, { fetchImpl, wait });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });
  it('reports a version that never becomes visible', async () => {
    const fetchImpl = vi.fn(async () => response({}, 404));
    await expect(
      verifyPackage(pkg, pack, NPM, { fetchImpl, wait: async () => undefined }),
    ).rejects.toThrow('PACKAGE_NOT_VISIBLE');
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });
  it('rejects malformed JSON instead of interpreting it as a missing destination', async () => {
    await expect(
      readMetadata('https://registry.npmjs.org/example', {
        fetchImpl: async () => new Response('not-json'),
      }),
    ).rejects.toThrow('INVALID_DESTINATION_JSON');
  });
});
describe('Registry recovery', () => {
  it.each([
    { transport: { type: 'streamable-http', url: 'https://invalid.example' } },
    { environmentVariables: [{ name: 'LINKEDIN_ENABLE_WRITES', default: 'true' }] },
  ])(
    'rejects changed launch/security metadata even when the package name/version match: %j',
    async (changed) => {
      const altered = {
        ...registry,
        server: { ...server, packages: [{ ...server.packages[0], ...changed }] },
      };
      await expect(
        registryState(server, { fetchImpl: async () => response(altered) }),
      ).rejects.toThrow('REGISTRY_METADATA_MISMATCH');
    },
  );
  it('checks the exact server and version using the documented URL', async () => {
    const fetchImpl = vi.fn(async () => response(registry));
    expect(await registryState(server, { fetchImpl })).toBe('verified');
    expect(fetchImpl.mock.calls[0][0]).toBe(
      'https://registry.modelcontextprotocol.io/v0.1/servers/io.github.devag7%2Flinkedin-mcp/versions/2.0.4?include_deleted=true',
    );
  });
  it.each(['deprecated', 'deleted'])(
    'does not mistake %s metadata for completed discovery',
    async (status) => {
      await expect(
        registryState(server, {
          fetchImpl: async () =>
            response({
              ...registry,
              _meta: { 'io.modelcontextprotocol.registry/official': { status } },
            }),
        }),
      ).rejects.toThrow('REGISTRY_METADATA_MISMATCH');
    },
  );
  it('resumes a missing Registry version independently of npm/tag existence', async () => {
    expect(await registryState(server, { fetchImpl: async () => response({}, 404) })).toBe(
      'missing',
    );
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({}, 404))
      .mockResolvedValueOnce(response(registry));
    await verifyRegistry(server, { fetchImpl, wait: async () => undefined });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('fails visibly on Registry errors or mismatched package versions', async () => {
    await expect(
      registryState(server, { fetchImpl: async () => response({}, 503) }),
    ).rejects.toThrow('DESTINATION_HTTP_503');
    await expect(
      registryState(server, {
        fetchImpl: async () =>
          response({
            ...registry,
            server: { ...server, packages: [{ ...server.packages[0], version: '2.0.3' }] },
          }),
      }),
    ).rejects.toThrow('REGISTRY_METADATA_MISMATCH');
  });
});
describe('GitHub draft lifecycle', () => {
  const existing = { id: 7, tag_name: 'v2.0.4', draft: true, target_commitish: head };
  function destination({
    release = existing as typeof existing | null,
    target = head,
    tag = head as string | null,
    annotated = false,
  } = {}) {
    let tagSha = tag;
    const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url.includes('/releases/tags/')) return response({}, 404);
      if (url.includes('/releases?')) return response(release ? [release] : []);
      if (url.includes('/commits/')) return response({ sha: target });
      if (url.includes('/git/ref/tags/'))
        return tagSha
          ? response({
              ref: 'refs/tags/v2.0.4',
              object: { type: annotated ? 'tag' : 'commit', sha: tagSha },
            })
          : response({}, 404);
      if (url.includes('/git/tags/'))
        return response({ sha: tagSha, object: { type: 'commit', sha: head } });
      if (url.endsWith('/git/refs') && init.method === 'POST') {
        tagSha = head;
        return response({});
      }
      if (url.endsWith('/releases') && init.method === 'POST') return response(existing);
      if (url.endsWith('/releases/7') && init.method === 'PATCH')
        return response({ ...existing, draft: false });
      throw new Error('UNEXPECTED_SYNTHETIC_REQUEST');
    });
    return { fetchImpl, token: 'synthetic-token' };
  }
  const run = (options: ReturnType<typeof destination>, finalize = false) =>
    githubRelease('devag7/linkedin-mcp', releaseIdentity(pkg, head), head, finalize, options);
  it('creates a bound tag then a draft for a missing release', async () => {
    const options = destination({ release: null, tag: null });
    expect(await run(options)).toBe(7);
    const mutations = options.fetchImpl.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(mutations).toHaveLength(2);
    expect(JSON.parse(mutations[0][1]!.body as string)).toEqual({
      ref: 'refs/tags/v2.0.4',
      sha: head,
    });
    expect(JSON.parse(mutations[1][1]!.body as string)).toMatchObject({
      draft: true,
      target_commitish: head,
    });
  });
  it('finds an authenticated draft and reuses it without mutation', async () => {
    const options = destination();
    expect(await run(options)).toBe(7);
    expect(
      options.fetchImpl.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET'),
    ).toBe(true);
    expect(await run(options, true)).toBe(7);
    expect(
      options.fetchImpl.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
    ).toHaveLength(1);
  });
  it.each([{ target: 'b'.repeat(40) }, { tag: 'b'.repeat(40) }, { tag: null }])(
    'rejects mismatched or absent source before reuse or finalization %j',
    async (override) => {
      for (const finalize of [false, true]) {
        const options = destination(override);
        await expect(run(options, finalize)).rejects.toThrow(
          /GITHUB_(RELEASE|TAG)_SOURCE_MISMATCH/,
        );
        expect(
          options.fetchImpl.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET'),
        ).toBe(true);
      }
    },
  );
  it('resolves a branch target and annotated tag to the expected commit', async () => {
    expect(
      await run(
        destination({ release: { ...existing, target_commitish: 'main' }, annotated: true }),
      ),
    ).toBe(7);
  });
  it('does not recreate during finalization or redraft published releases', async () => {
    await expect(run(destination({ release: null }), true)).rejects.toThrow('GITHUB_DRAFT_MISSING');
    const options = destination({ release: { ...existing, draft: false } });
    expect(await run(options, true)).toBe(7);
    expect(
      options.fetchImpl.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET'),
    ).toBe(true);
  });
  it('fails closed on duplicate drafts and bounded discovery exhaustion', async () => {
    for (const entries of [
      [existing, existing],
      Array.from({ length: 100 }, (_, id) => ({ ...existing, id, tag_name: 'other' })),
    ]) {
      const fetchImpl = vi.fn(async (url: string) =>
        url.includes('/tags/') ? response({}, 404) : response(entries),
      );
      await expect(run({ fetchImpl, token: 'synthetic-token' })).rejects.toThrow(
        /AMBIGUOUS_GITHUB_RELEASE|GITHUB_RELEASE_LIST_LIMIT/,
      );
      expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(6);
    }
  });
  it('rejects an incorrect finalization response', async () => {
    const options = destination();
    const normal = options.fetchImpl.getMockImplementation()!;
    options.fetchImpl.mockImplementation(async (url, init) =>
      init?.method === 'PATCH'
        ? response({ ...existing, target_commitish: 'wrong' })
        : normal(url, init),
    );
    // The target resolver must reflect the altered commit, rather than the normal fixture.
    const current = options.fetchImpl.getMockImplementation()!;
    options.fetchImpl.mockImplementation(async (url, init) =>
      url.endsWith('/commits/wrong') ? response({ sha: 'b'.repeat(40) }) : current(url, init),
    );
    await expect(run(options, true)).rejects.toThrow('GITHUB_RELEASE_SOURCE_MISMATCH');
  });
});
it('cancels a destination response as soon as its byte limit is exceeded', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
    },
    cancel,
  });
  await expect(readMetadata(NPM, { fetchImpl: async () => new Response(body) })).rejects.toThrow(
    'DESTINATION_RESPONSE_TOO_LARGE',
  );
  expect(cancel).toHaveBeenCalledOnce();
});
it('accepts only the pinned publisher bytes and rejects a corrupt or unpinned download before extraction', () => {
  const bytes = Buffer.from('synthetic archive');
  const lock = {
    version: 'v1.8.1',
    url: 'https://github.com/modelcontextprotocol/registry/releases/download/v1.8.1/mcp-publisher_linux_amd64.tar.gz',
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  expect(() => verifyPublisher(lock, bytes)).not.toThrow();
  expect(() => verifyPublisher(lock, Buffer.from('corrupt'))).toThrow(
    'PUBLISHER_CHECKSUM_MISMATCH',
  );
  expect(() =>
    verifyPublisher({ ...lock, url: lock.url.replace('v1.8.1', 'latest') }, bytes),
  ).toThrow('PUBLISHER_CHECKSUM_MISMATCH');
});
