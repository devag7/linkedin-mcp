/** Offline onboarding and client configuration. Never launches Chrome or edits client files. */
import { resolve } from 'node:path';
import type { EnvConfig } from './config/env.js';
import { inspectSetup } from './doctor.js';
import { profilePath } from './safety/state-lock.js';
import { VERSION } from './version.js';

export const CLIENTS = ['claude-desktop', 'cursor', 'vscode'] as const;
export type SetupClient = (typeof CLIENTS)[number];

export function clientConfiguration(
  client: SetupClient,
  config: EnvConfig,
  executable = process.execPath,
  entry = process.argv[1],
) {
  if (!entry) throw new Error('SETUP_ENTRY_MISSING');
  // Pin the installed build, avoiding GUI PATH and implicit npx upgrades.
  // Explicit allowlist excludes credentials and inherited write/HTTP opt-ins.
  const env = {
    TRANSPORT: 'stdio',
    LOG_LEVEL: 'error',
    LINKEDIN_PROVIDER: 'browser',
    LINKEDIN_PROFILE_DIR: profilePath(config.LINKEDIN_PROFILE_DIR),
    LINKEDIN_HEADLESS: String(config.LINKEDIN_HEADLESS),
    LINKEDIN_ENABLE_WRITES: 'false',
    LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES: 'false',
    ...(config.LINKEDIN_CHROME_PATH
      ? { LINKEDIN_CHROME_PATH: resolve(config.LINKEDIN_CHROME_PATH) }
      : {}),
  };
  const server = { command: resolve(executable), args: [resolve(entry)], env };
  return client === 'vscode'
    ? { servers: { linkedin: { type: 'stdio' as const, ...server } } }
    : { mcpServers: { linkedin: server } };
}

export function setupReport(client: SetupClient, config: EnvConfig) {
  const configuration = clientConfiguration(client, config);
  const server =
    'servers' in configuration
      ? configuration.servers!.linkedin
      : configuration.mcpServers!.linkedin;
  const diagnosis = inspectSetup(config, { transport: 'stdio', port: 3000, logLevel: 'error' });
  const checks = diagnosis.checks;
  const ready =
    checks.package === 'available' &&
    checks.chrome === 'available' &&
    checks.profileWritable &&
    !checks.profileOwned &&
    !checks.budgetLocked &&
    checks.safetyState === 'valid';
  const destination =
    client === 'cursor'
      ? '~/.cursor/mcp.json (global) or .cursor/mcp.json (project)'
      : client === 'vscode'
        ? '.vscode/mcp.json or MCP: Open User Configuration'
        : process.platform === 'darwin'
          ? '~/Library/Application Support/Claude/claude_desktop_config.json'
          : process.platform === 'win32'
            ? '%APPDATA%\\Claude\\claude_desktop_config.json'
            : 'Claude Desktop native configuration is documented for macOS and Windows only';
  return {
    version: VERSION,
    client,
    status: ready ? 'local_ready' : 'needs_attention',
    scope: 'Offline only: login and provider compatibility are not checked.',
    diagnosis,
    destination,
    configuration,
    commands: {
      doctor: { ...server, args: [...server.args, '--doctor'] },
      login: { ...server, args: [...server.args, '--login'] },
    },
    steps: [
      'Resolve diagnosis.nextSteps for missing software, permissions, ownership or safety state.',
      'Keep this installed build at a stable path; moving it or Node requires regenerating configuration.',
      'Run commands.login yourself when ready. This report does not log in or access LinkedIn.',
      'Merge the linkedin entry into existing client configuration; preserve other servers. Restart the client.',
      'Ask the client to call whoami, then health_check and one get_my_profile read when you authorize account access.',
      'Call close_session after use. Stop at any checkpoint; do not retry unknown writes.',
    ],
  };
}
