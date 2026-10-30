/** One-incident GitHub Actions recovery. No package upload or tag mutation. */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  packIdentity,
  readMetadata,
  verifyPackage,
  verifyRegistry,
  verifyPublicGithubPackage,
  githubRelease,
} from './release.mjs';

export const RECOVERY = Object.freeze({
  repo: 'devag7/linkedin-mcp',
  version: '4.4.0',
  tag: 'v4.4.0',
  source: '87dae34902cc6f14d5c60a11a901808782a95555',
  producer: 40933053202,
  releaseId: 428280123,
  filename: 'linkedin-mcp-tools-4.4.0.tgz',
  sha256: 'df8ecf6fa8d4143bbc8625b1f8b494e5a3445667b9134f8a94e9db614e2cc1a8',
  integrity:
    'sha512-o1gw/RBPp+/6R0V2smtwcb5PId7C/79WuP5c/aI54LJCAC6ez0rFkVlWjK75wtiAhNAnVCo9I9mizeoFlcu5Ng==',
  scopedName: '@devag7/linkedin-mcp-tools',
  scopedIntegrity:
    'sha512-xRW84vDEKoEyI/s6iBczAv/wY9LS+ZqJzBNcZm4U6r4DOGM4tG0k8wZYzkcH3GULFVgjtg4x3/0wYGxQbbUVDg==',
});
const fail = (code) => {
  throw new Error(code);
};
const origins = new Set([
  'https://registry.npmjs.org',
  'https://npm.pkg.github.com',
  'https://registry.modelcontextprotocol.io',
  'https://api.github.com',
]);

export function assertRecoveryRequest(url, options = {}) {
  const parsed = new URL(url);
  if (!origins.has(parsed.origin) || parsed.username || parsed.password || parsed.hash)
    fail('RECOVERY_DESTINATION_REFUSED');
  if (
    new Headers(options.headers).has('authorization') &&
    !['https://api.github.com', 'https://npm.pkg.github.com'].includes(parsed.origin)
  )
    fail('RECOVERY_AUTH_HOST_REFUSED');
  const method = options.method ?? 'GET';
  if (method === 'GET' && !options.body) return;
  if (
    method !== 'PATCH' ||
    parsed.origin !== 'https://api.github.com' ||
    parsed.search ||
    parsed.pathname !== `/repos/${RECOVERY.repo}/releases/${RECOVERY.releaseId}` ||
    options.body !== JSON.stringify({ draft: false })
  )
    fail('RECOVERY_MUTATION_REFUSED');
}

export function assertRecoveryContext(context) {
  const { env, head, helperHead, tagCommit, pkg, pack, server, archiveSha256 } = context;
  if (
    env.GITHUB_ACTIONS !== 'true' ||
    env.RELEASE_DRY_RUN !== 'false' ||
    env.GITHUB_REPOSITORY !== RECOVERY.repo ||
    env.GITHUB_REF !== 'refs/heads/main' ||
    !env.GH_TOKEN ||
    env.CONFIRM_SOURCE !== RECOVERY.source ||
    !/^[a-f0-9]{40}$/.test(helperHead) ||
    helperHead !== env.GITHUB_SHA ||
    head !== RECOVERY.source ||
    tagCommit !== RECOVERY.source ||
    pkg.name !== 'linkedin-mcp-tools' ||
    pkg.version !== RECOVERY.version ||
    server.name !== 'io.github.devag7/linkedin-mcp' ||
    server.version !== RECOVERY.version ||
    pack.name !== pkg.name ||
    pack.version !== pkg.version ||
    pack.filename !== RECOVERY.filename ||
    pack.integrity !== RECOVERY.integrity ||
    archiveSha256 !== RECOVERY.sha256
  )
    fail('RECOVERY_CONTEXT_REFUSED');
}

export async function finalizeVerified440(context, { fetchImpl = fetch, report = () => {} } = {}) {
  assertRecoveryContext(context);
  const guardedFetch = (url, options) => {
    assertRecoveryRequest(url, options);
    return fetchImpl(url, options);
  };
  const authenticated = { token: context.env.GH_TOKEN, fetchImpl: guardedFetch };
  const anonymous = { fetchImpl: guardedFetch };
  const api = `https://api.github.com/repos/${RECOVERY.repo}`;
  report('verify_original_producer');
  const run = await readMetadata(`${api}/actions/runs/${RECOVERY.producer}`, authenticated);
  const jobs = await readMetadata(
    `${api}/actions/runs/${RECOVERY.producer}/jobs?filter=latest&per_page=100`,
    authenticated,
  );
  const expected = [
    'release',
    'github-packages',
    'mcp-registry',
    'finalize',
    ...['ubuntu-latest', 'macos-latest', 'windows-latest'].flatMap((os) =>
      [20, 22].map((node) => `compatibility (${os}, ${node})`),
    ),
  ];
  if (
    run?.id !== RECOVERY.producer ||
    run.head_sha !== RECOVERY.source ||
    run.name !== 'Release' ||
    run.path !== '.github/workflows/release.yml' ||
    run.event !== 'push' ||
    run.head_branch !== 'main' ||
    run.repository?.full_name !== RECOVERY.repo ||
    run.status !== 'completed' ||
    !Array.isArray(jobs?.jobs) ||
    jobs.jobs.length !== expected.length ||
    new Set(jobs.jobs.map((job) => job.name)).size !== expected.length ||
    !expected.every((name) =>
      jobs.jobs.some(
        (job) =>
          job.name === name &&
          job.status === 'completed' &&
          (name === 'finalize'
            ? ['failure', 'success'].includes(job.conclusion)
            : job.conclusion === 'success'),
      ),
    )
  )
    fail('RECOVERY_PRODUCER_UNVERIFIED');
  report('verify_npm');
  await verifyPackage(context.pkg, context.pack, undefined, anonymous);
  report('verify_registry');
  await verifyRegistry(context.server, anonymous);
  report('verify_public_scoped_package');
  const scopedMetadata = await readMetadata(
    `https://npm.pkg.github.com/${encodeURIComponent(RECOVERY.scopedName)}`,
    authenticated,
  );
  const scopedVersion = scopedMetadata?.versions?.[RECOVERY.version];
  if (
    scopedMetadata?.name !== RECOVERY.scopedName ||
    !scopedMetadata.versions ||
    typeof scopedMetadata.versions !== 'object' ||
    Array.isArray(scopedMetadata.versions) ||
    scopedVersion?.name !== RECOVERY.scopedName ||
    scopedVersion?.version !== RECOVERY.version ||
    scopedVersion?.dist?.integrity !== RECOVERY.scopedIntegrity
  )
    fail('RECOVERY_SCOPED_VERSION_UNVERIFIED');
  await verifyPublicGithubPackage(authenticated);
  report('verify_source_tag_and_finalize_existing_draft');
  const id = await githubRelease(
    RECOVERY.repo,
    { tag: RECOVERY.tag, eligible: true },
    RECOVERY.source,
    true,
    authenticated,
  );
  if (id !== RECOVERY.releaseId) fail('RECOVERY_RELEASE_ID_MISMATCH');
  return {
    version: RECOVERY.version,
    source: RECOVERY.source,
    releaseId: id,
    packageUploads: 0,
    tagMutations: 0,
    finalized: true,
  };
}

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RELEASE_DRY_RUN !== 'false')
    fail('RECOVERY_CONTEXT_REFUSED');
  const helper = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const git = (args, cwd = process.cwd()) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const pkg = JSON.parse(git(['show', 'HEAD:package.json']));
  const pack = packIdentity(pkg, JSON.parse(readFileSync('pack-result.json', 'utf8')));
  const context = {
    env: process.env,
    pkg,
    pack,
    server: JSON.parse(git(['show', 'HEAD:server.json'])),
    head: git(['rev-parse', 'HEAD']),
    helperHead: git(['rev-parse', 'HEAD'], helper),
    tagCommit: git(['rev-parse', `refs/tags/${RECOVERY.tag}^{commit}`]),
    archiveSha256: createHash('sha256').update(readFileSync(RECOVERY.filename)).digest('hex'),
  };
  console.log(
    JSON.stringify(
      await finalizeVerified440(context, {
        report: (stage) => console.log(JSON.stringify({ finalizationStage: stage })),
      }),
    ),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(
      /^[A-Z][A-Z_0-9]+$/.test(error.message) ? error.message : 'RECOVERY_CHECK_FAILED',
    );
    process.exitCode = 1;
  });
