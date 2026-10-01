/** Release destination checks. Only the explicit GitHub commands mutate remotely. */
import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export const NPM = 'https://registry.npmjs.org';
export const GITHUB_PACKAGES = 'https://npm.pkg.github.com';
export const REGISTRY = 'https://registry.modelcontextprotocol.io';
const fail = (code) => {
  throw new Error(code);
};
const canonical = (value) =>
  JSON.stringify(value, (_key, child) =>
    child && typeof child === 'object' && !Array.isArray(child)
      ? Object.fromEntries(
          Object.keys(child)
            .sort()
            .map((key) => [key, child[key]]),
        )
      : child,
  );

export function releaseIdentity(pkg, head, tagCommit) {
  if (
    pkg.name !== 'linkedin-mcp-tools' ||
    !/^\d+\.\d+\.\d+$/.test(pkg.version) ||
    !/^[a-f0-9]{40}$/.test(head)
  )
    fail('INVALID_RELEASE_IDENTITY');
  // A normal main push after a release must not republish that version's new code.
  return {
    version: pkg.version,
    tag: `v${pkg.version}`,
    eligible: !tagCommit || tagCommit === head,
  };
}

export async function readMetadata(url, { fetchImpl = fetch, token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetchImpl(url, {
    method,
    headers,
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    redirect: 'error',
  });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) fail(`DESTINATION_HTTP_${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) fail('INVALID_DESTINATION_JSON');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        fail('DESTINATION_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    fail('INVALID_DESTINATION_JSON');
  }
}

export function packIdentity(pkg, packs) {
  if (!Array.isArray(packs) || packs.length !== 1) fail('INVALID_PACK_RESULT');
  const pack = packs[0];
  if (
    pack.name !== pkg.name ||
    pack.version !== pkg.version ||
    !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(pack.integrity) ||
    !/^[A-Za-z0-9_.-]+\.tgz$/.test(pack.filename)
  )
    fail('INVALID_PACK_IDENTITY');
  return pack;
}

export async function packageState(pkg, pack, registry = NPM, options = {}) {
  if (![NPM, GITHUB_PACKAGES].includes(registry)) fail('UNSUPPORTED_PACKAGE_REGISTRY');
  const metadata = await readMetadata(`${registry}/${encodeURIComponent(pkg.name)}`, options);
  if (metadata === null) return 'missing';
  if (
    metadata.name !== pkg.name ||
    !metadata.versions ||
    typeof metadata.versions !== 'object' ||
    Array.isArray(metadata.versions)
  )
    fail('INVALID_PACKAGE_METADATA');
  const remote = metadata.versions[pkg.version];
  if (remote === undefined) return 'missing';
  if (
    remote?.name !== pkg.name ||
    remote?.version !== pkg.version ||
    remote?.dist?.integrity !== pack.integrity
  )
    fail('PUBLISHED_ARTIFACT_MISMATCH');
  return 'verified';
}

export async function verifyPackage(pkg, pack, registry = NPM, options = {}) {
  for (let i = 0; i < 6; i++) {
    if ((await packageState(pkg, pack, registry, options)) === 'verified') return;
    if (i < 5) await (options.wait ?? delay)(2_000);
  }
  fail('PACKAGE_NOT_VISIBLE');
}

export async function verifyPublicGithubPackage(options = {}) {
  // Registry authentication can succeed for a private package. Visibility is an
  // independent destination requirement. GitHub requires auth even for public npm metadata.
  const metadata = await readMetadata(
    'https://api.github.com/users/devag7/packages/npm/linkedin-mcp-tools',
    options,
  );
  if (
    metadata?.name !== 'linkedin-mcp-tools' ||
    metadata?.package_type !== 'npm' ||
    metadata?.visibility !== 'public' ||
    metadata?.repository?.full_name !== 'devag7/linkedin-mcp'
  )
    fail('GITHUB_PACKAGE_NOT_PUBLIC');
}

export async function registryState(server, options = {}) {
  const remote = await readMetadata(
    `${REGISTRY}/v0.1/servers/${encodeURIComponent(server.name)}/versions/${encodeURIComponent(server.version)}?include_deleted=true`,
    options,
  );
  if (remote === null) return 'missing';
  const expected = server.packages?.find((p) => p.registryType === 'npm');
  const actual = remote.server?.packages?.find((p) => p.registryType === 'npm');
  if (
    !expected ||
    remote.server?.name !== server.name ||
    remote.server?.version !== server.version ||
    actual?.identifier !== expected.identifier ||
    actual?.version !== expected.version ||
    canonical(actual) !== canonical(expected) ||
    remote._meta?.['io.modelcontextprotocol.registry/official']?.status !== 'active'
  )
    fail('REGISTRY_METADATA_MISMATCH');
  return 'verified';
}

export async function verifyRegistry(server, options = {}) {
  for (let i = 0; i < 6; i++) {
    if ((await registryState(server, options)) === 'verified') return;
    if (i < 5) await (options.wait ?? delay)(2_000);
  }
  fail('REGISTRY_NOT_VISIBLE');
}

async function resolvedTag(root, tag, options) {
  const ref = await readMetadata(`${root}/git/ref/tags/${encodeURIComponent(tag)}`, options);
  if (ref === null) return null;
  if (ref.ref !== `refs/tags/${tag}`) fail('INVALID_GITHUB_TAG');
  let object = ref.object;
  for (let depth = 0; depth < 8; depth++) {
    if (!/^[a-f0-9]{40}$/.test(object?.sha ?? '')) fail('INVALID_GITHUB_TAG');
    if (object.type === 'commit') return object.sha;
    if (object.type !== 'tag') fail('INVALID_GITHUB_TAG');
    const annotated = await readMetadata(`${root}/git/tags/${object.sha}`, options);
    if (annotated?.sha !== object.sha) fail('INVALID_GITHUB_TAG');
    object = annotated.object;
  }
  fail('INVALID_GITHUB_TAG');
}

async function releaseForTag(base, tag, options) {
  // The by-tag endpoint returns published releases only. Include authenticated drafts.
  const published = await readMetadata(`${base}/tags/${encodeURIComponent(tag)}`, options);
  if (published !== null) return published;
  const matches = [];
  for (let page = 1; page <= 5; page++) {
    const releases = await readMetadata(`${base}?per_page=100&page=${page}`, options);
    if (!Array.isArray(releases) || releases.length > 100) fail('INVALID_GITHUB_RELEASE_LIST');
    matches.push(...releases.filter((release) => release.tag_name === tag));
    if (matches.length > 1) fail('AMBIGUOUS_GITHUB_RELEASE');
    if (releases.length < 100) return matches[0] ?? null;
  }
  fail('GITHUB_RELEASE_LIST_LIMIT');
}

export async function githubRelease(repo, identity, head, finalize, options = {}) {
  if (
    repo !== 'devag7/linkedin-mcp' ||
    !options.token ||
    !/^[a-f0-9]{40}$/.test(head) ||
    !/^v\d+\.\d+\.\d+$/.test(identity.tag) ||
    identity.eligible !== true
  )
    fail('INVALID_GITHUB_RELEASE_CONTEXT');
  const root = `https://api.github.com/repos/${repo}`;
  const base = `${root}/releases`;
  let release = await releaseForTag(base, identity.tag, options);
  let tagSha = await resolvedTag(root, identity.tag, options);
  if (tagSha !== null && tagSha !== head) fail('GITHUB_TAG_SOURCE_MISMATCH');
  if (release === null) {
    if (finalize) fail('GITHUB_DRAFT_MISSING');
    if (tagSha === null) {
      await readMetadata(`${root}/git/refs`, {
        ...options,
        method: 'POST',
        body: { ref: `refs/tags/${identity.tag}`, sha: head },
      });
      tagSha = await resolvedTag(root, identity.tag, options);
      if (tagSha !== head) fail('GITHUB_TAG_SOURCE_MISMATCH');
    }
    release = await readMetadata(base, {
      ...options,
      method: 'POST',
      body: {
        tag_name: identity.tag,
        target_commitish: head,
        name: identity.tag,
        generate_release_notes: true,
        draft: true,
      },
    });
  }
  async function verify(value) {
    if (
      !Number.isSafeInteger(value?.id) ||
      value.id <= 0 ||
      value.tag_name !== identity.tag ||
      typeof value.draft !== 'boolean' ||
      typeof value.target_commitish !== 'string' ||
      !value.target_commitish ||
      value.target_commitish.length > 256
    )
      fail('INVALID_GITHUB_RELEASE');
    const target = await readMetadata(
      `${root}/commits/${encodeURIComponent(value.target_commitish)}`,
      options,
    );
    if (target?.sha !== head) fail('GITHUB_RELEASE_SOURCE_MISMATCH');
    if ((await resolvedTag(root, identity.tag, options)) !== head)
      fail('GITHUB_TAG_SOURCE_MISMATCH');
  }
  await verify(release);
  if (finalize && release.draft) {
    const result = await readMetadata(`${base}/${release.id}`, {
      ...options,
      method: 'PATCH',
      body: { draft: false },
    });
    await verify(result);
    if (result.id !== release.id || result.draft !== false) fail('INVALID_GITHUB_FINALIZATION');
  }
  return release.id;
}

function output(values) {
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      Object.entries(values)
        .map(([k, v]) => `${k}=${v}\n`)
        .join(''),
    );
  console.log(JSON.stringify(values));
}

async function main() {
  const command = process.argv[2];
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  if (!['linkedin-mcp-tools', '@devag7/linkedin-mcp-tools'].includes(pkg.name))
    fail('INVALID_PACKAGE_NAME');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  let tagCommit;
  try {
    tagCommit = execFileSync(
      'git',
      ['rev-parse', '--verify', `refs/tags/v${pkg.version}^{commit}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    /* Missing tags are expected before npm succeeds. */
  }
  const identity = releaseIdentity({ ...pkg, name: 'linkedin-mcp-tools' }, head, tagCommit);
  const packs = () => packIdentity(pkg, JSON.parse(readFileSync('pack-result.json', 'utf8')));
  const server = () => JSON.parse(readFileSync('server.json', 'utf8'));
  const githubOptions = { token: process.env.GH_TOKEN };
  if (command === 'plan') {
    if (pkg.name !== 'linkedin-mcp-tools') fail('INVALID_PACKAGE_NAME');
    if (!identity.eligible)
      return output({
        ...identity,
        source_sha: head,
        npm_present: false,
        reason: 'version_tag_belongs_to_another_commit',
      });
    const pack = packs();
    return output({
      ...identity,
      source_sha: head,
      npm_present: (await packageState(pkg, pack)) === 'verified',
      tarball: pack.filename,
    });
  }
  if (!identity.eligible) fail('RELEASE_SOURCE_MISMATCH');
  if (command === 'verify-npm') return verifyPackage(pkg, packs());
  if (command === 'package-plan')
    return output({
      present: (await packageState(pkg, packs(), GITHUB_PACKAGES, githubOptions)) === 'verified',
      tarball: packs().filename,
    });
  if (command === 'verify-github-package') {
    await verifyPackage(pkg, packs(), GITHUB_PACKAGES, githubOptions);
    return verifyPublicGithubPackage(githubOptions);
  }
  if (command === 'registry-plan')
    return output({ present: (await registryState(server())) === 'verified' });
  if (command === 'verify-registry') return verifyRegistry(server());
  if (['github-draft', 'github-finalize'].includes(command)) {
    if (process.env.RELEASE_DRY_RUN !== 'false' || process.env.GITHUB_ACTIONS !== 'true')
      fail('REMOTE_MUTATION_DISABLED');
    // A release/tag is never created before npm's exact artifact is visible.
    await verifyPackage(pkg, packs());
    if (command === 'github-finalize') {
      await verifyRegistry(server());
      // The scoped job's exact packed artifact was verified in its own job.
      if (process.env.SCOPED_PACKAGE_RESULT !== 'success') fail('GITHUB_PACKAGE_UNVERIFIED');
    }
    return output({
      release_id: await githubRelease(
        process.env.GITHUB_REPOSITORY,
        identity,
        head,
        command === 'github-finalize',
        githubOptions,
      ),
    });
  }
  fail('UNKNOWN_RELEASE_COMMAND');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(/^[A-Z][A-Z_0-9]+$/.test(error.message) ? error.message : 'RELEASE_CHECK_FAILED');
    process.exitCode = 1;
  });
