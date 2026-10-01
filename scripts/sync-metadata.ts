/** Generate local metadata from package version and the same catalog used by whoami. */
import { readFileSync, writeFileSync } from 'node:fs';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { CAPABILITIES, capabilityManifest } from '../src/tools/capabilities.js';
const check = process.argv.includes('--check');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
let stale = false;
function output(path: string, content: string) {
  let previous = '';
  try {
    previous = readFileSync(path, 'utf8');
  } catch {
    /* missing means stale */
  }
  if (previous === content) return;
  if (check) {
    process.stderr.write(`Stale generated metadata: ${path}\n`);
    stale = true;
  } else writeFileSync(path, content);
}
output(
  'claude-desktop-config.json',
  JSON.stringify(
    { mcpServers: { linkedin: { command: 'npx', args: ['-y', `${pkg.name}@${pkg.version}`] } } },
    null,
    2,
  ) + '\n',
);
const manifest = capabilityManifest({ writesEnabled: false, experimentalMessagesEnabled: false });
const registry = JSON.parse(readFileSync('server.json', 'utf8'));
registry.version = pkg.version;
registry.name = pkg.mcpName;
registry.description =
  'Unofficial local LinkedIn research and opt-in alpha writes; live compatibility is unverified.';
registry.packages[0].identifier = pkg.name;
registry.packages[0].version = pkg.version;
const schema = JSON.parse(
  readFileSync('tests/fixtures/mcp-registry-schema-2025-12-11.json', 'utf8'),
);
const validation = new AjvJsonSchemaValidator().getValidator(schema)(registry);
if (!validation.valid)
  throw new Error(
    `Registry metadata does not match the pinned official schema: ${validation.errorMessage}`,
  );
output('server.json', JSON.stringify(registry, null, 2) + '\n');
output(
  'mcp-manifest.json',
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      mcpName: pkg.mcpName,
      contractVersion: 1,
      transport: 'stdio',
      provider: 'local_browser_unofficial',
      officialProvider: 'unavailable',
      tools: manifest,
    },
    null,
    2,
  ) + '\n',
);
const table =
  '| Tool | Route | Source | Permission | Max rows | Evidence | Current live check |\n| --- | --- | --- | --- | --- | --- | --- |\n' +
  manifest
    .map(
      (c) =>
        `| ${c.name} | ${c.route} | ${c.source} | ${c.permission} | ${'maxResults' in c ? (c.maxResults ?? '—') : '—'} | ${c.verification} (${c.offlineCheckedAt}) | Unchecked |`,
    )
    .join('\n');
output(
  'docs/CAPABILITIES.md',
  `# Capabilities and compatibility\n\nGenerated from src/tools/capabilities.ts for ${pkg.name} v${pkg.version}.\n\n${table}\n\nThese are synthetic contract and registration checks, not current LinkedIn observations. Historical capture comments are retained in endpoints.ts and are not promoted to current live checks. No endpoint has a new live capture here. DOM selectors have no multi-locale browser integration evidence. whoami supplies this inventory and the actual runtime write policy; it never guesses provider availability.\n\nSearch/feed/notification offsets use existing endpoint builders, one page per call. nextCursor appears only for matching provider start/count/total metadata. DOM discovery, inbox, conversation and invitation reads expose bounded first pages and mark completeness partial. Profiles make at most six requests (seven for own profile), plus bounded identity verification; optional hidden sections may be unavailable.\n\nThe official provider is unavailable in the active runtime. Token/cookie settings from v1 do not activate it. All alpha writes are disabled by default; new-thread messaging has a second experimental opt-in.\n`,
);
const readme = readFileSync('README.md', 'utf8').replace(
  /\*\*\d+ tools\*\*/,
  `**${manifest.length} tools**`,
);
const start = '<!-- capabilities:start -->';
const end = '<!-- capabilities:end -->';
const names = Object.keys(CAPABILITIES);
const summary = `${start}\n\n${names.length} registered tools. Native contract version 1 returns structuredContent and identical JSON text, with fetchedAt, source, partial and status metadata. [Full route and verification inventory](docs/CAPABILITIES.md).\n\n| Group | Tools |\n| --- | --- |\n| Session | ${names
  .slice(0, 3)
  .map((n) => '`' + n + '`')
  .join(', ')} |\n| Reads | ${names
  .slice(3, 17)
  .map((n) => '`' + n + '`')
  .join(', ')} |\n| Opt-in alpha writes | ${names
  .slice(17)
  .map((n) => '`' + n + '`')
  .join(', ')} |\n\n${end}`;
if (!readme.includes(start) || !readme.includes(end))
  throw new Error('README capability markers are required.');
output(
  'README.md',
  readme.slice(0, readme.indexOf(start)) + summary + readme.slice(readme.indexOf(end) + end.length),
);
if (stale) process.exitCode = 1;
