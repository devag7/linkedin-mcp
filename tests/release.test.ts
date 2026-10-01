/** Actual release helpers with synthetic destinations; never publish in tests. */
import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  releaseIdentity,
  packIdentity,
  readMetadata,
  packageState,
  verifyPackage,
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
  it('creates a draft for a missing release', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({}, 404))
      .mockResolvedValueOnce(response({ id: 7, tag_name: 'v2.0.4', draft: true }));
    await githubRelease('devag7/linkedin-mcp', releaseIdentity(pkg, head), head, false, {
      fetchImpl,
      token: 'synthetic-token',
    });
    expect(fetchImpl.mock.calls[1][1].method).toBe('POST');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toMatchObject({
      draft: true,
      target_commitish: head,
      tag_name: 'v2.0.4',
    });
  });
  it('reuses a draft after a downstream failure; finalization is a separate operation', async () => {
    const existing = { id: 7, tag_name: 'v2.0.4', draft: true };
    const fetchImpl = vi.fn(async () => response(existing));
    await githubRelease('devag7/linkedin-mcp', releaseIdentity(pkg, head), head, false, {
      fetchImpl,
      token: 'synthetic-token',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await githubRelease('devag7/linkedin-mcp', releaseIdentity(pkg, head), head, true, {
      fetchImpl,
      token: 'synthetic-token',
    });
    expect(fetchImpl.mock.calls[2][1]).toMatchObject({ method: 'PATCH', body: '{"draft":false}' });
  });
  it('does not recreate a release during finalization or redraft a published release', async () => {
    await expect(
      githubRelease('devag7/linkedin-mcp', releaseIdentity(pkg, head), head, true, {
        fetchImpl: async () => response({}, 404),
        token: 'synthetic-token',
      }),
    ).rejects.toThrow('GITHUB_DRAFT_MISSING');
    const fetchImpl = vi.fn(async () => response({ id: 7, tag_name: 'v2.0.4', draft: false }));
    await githubRelease('devag7/linkedin-mcp', releaseIdentity(pkg, head), head, false, {
      fetchImpl,
      token: 'synthetic-token',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
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
