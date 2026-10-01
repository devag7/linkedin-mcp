#!/usr/bin/env node

/**
 * LinkedIn MCP Server — Entry Point
 *
 * 23 tools (reads + gated writes) for Claude, Cursor, and any MCP client.
 * Drives a real stealth Chrome to clear Cloudflare, then queries LinkedIn's
 * Voyager API from inside the authenticated page → structured JSON.
 *
 * Usage:
 *   npx linkedin-mcp-tools --login              # one-time: opens Chrome, log in
 *   npx linkedin-mcp-tools                      # stdio mode (default)
 *   npx linkedin-mcp-tools --transport http     # HTTP mode on port 3000
 *
 * @see https://github.com/devag7/linkedin-mcp
 */

import { startServer } from './server.js';
import type { ServerConfig, TransportType } from './types.js';
import { Logger } from './types.js';
import { existsSync } from 'node:fs';
import { BrowserEngine } from './browser/engine.js';
import { interactiveBrowserLogin, runSpike } from './browser/login.js';
import { runCapture } from './browser/capture.js';
import { runWriteCapture } from './browser/writecapture.js';
import { runWriteProbe } from './browser/writeprobe.js';
import { profilePath } from './safety/state-lock.js';
import { diagnose } from './doctor.js';
import { removeSavedProfile } from './browser/logout.js';
import { CLIENTS, clientConfiguration, setupReport, type SetupClient } from './setup.js';
import { VERSION } from './version.js';
import { loadConfig } from './config/env.js';

/** Resolve the persistent browser-profile directory (mirrors BrowserEngine). */
function profileDir(): string {
  return profilePath(process.env.LINKEDIN_PROFILE_DIR);
}

/**
 * Parse command-line arguments.
 */
function parseArgs(): ServerConfig & {
  action?:
    | 'login'
    | 'logout'
    | 'status'
    | 'spike'
    | 'capture'
    | 'writecapture'
    | 'writeprobe'
    | 'doctor'
    | 'setup'
    | 'client-config';
  client?: SetupClient;
  live?: boolean;
  confirmProfileDeletion?: boolean;
} {
  const args = process.argv.slice(2);
  let transport: TransportType = 'stdio';
  let port = 3000;
  let logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  let action:
    | 'doctor'
    | 'setup'
    | 'client-config'
    | 'login'
    | 'logout'
    | 'status'
    | 'spike'
    | 'capture'
    | 'writecapture'
    | 'writeprobe'
    | undefined;

  let client: SetupClient | undefined;
  let live = false;
  let confirmProfileDeletion = false;
  let transportChosen = false;
  let portChosen = false;
  let logLevelChosen = false;
  const setAction = (value: NonNullable<typeof action>) => {
    if (action && action !== value) throw new Error('Choose only one CLI command.');
    action = value;
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--setup':
      case '--client-config':
        setAction(arg === '--setup' ? 'setup' : 'client-config');
        if (!CLIENTS.includes(next as SetupClient))
          throw new Error('Choose a supported setup client: claude-desktop, cursor or vscode.');
        client = next as SetupClient;
        i++;
        break;
      case '--doctor':
        setAction('doctor');
        break;
      case '--live':
        live = true;
        break;

      case '--login':
        setAction('login');
        break;

      case '--confirm-profile-deletion':
        confirmProfileDeletion = true;
        break;

      case '--logout':
        setAction('logout');
        break;

      case '--status':
        setAction('status');
        break;

      case '--spike':
        setAction('spike');
        break;

      case '--capture':
        setAction('capture');
        break;

      case '--writecapture':
        setAction('writecapture');
        break;

      case '--writeprobe':
        setAction('writeprobe');
        break;

      case '--transport':
      case '-t':
        if (next === 'stdio' || next === 'http') {
          transport = next;
          transportChosen = true;
          i++;
        } else {
          console.error("Invalid transport. Use 'stdio' or 'http'.");
          process.exit(1);
        }
        break;

      case '--port':
      case '-p':
        port = Number(next ?? '');
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          console.error('Invalid port. Use a number between 1 and 65535.');
          process.exit(1);
        }
        portChosen = true;
        i++;
        break;

      case '--log-level':
      case '-l':
        if (['debug', 'info', 'warn', 'error'].includes(next ?? '')) {
          logLevel = next as typeof logLevel;
          logLevelChosen = true;
          i++;
        } else {
          throw new Error('Invalid log level. Use debug, info, warn or error.');
        }
        break;

      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;

      case '--version':
      case '-v':
        // eslint-disable-next-line no-console -- CLI output before MCP transport starts
        console.log(`linkedin-mcp v${VERSION}`);
        process.exit(0);
        break;

      default:
        console.error('Unknown argument. Use --help for usage info.');
        process.exit(1);
    }
  }

  // Also check environment variables (env overrides are lower priority than CLI)
  if (process.env['TRANSPORT'] && !transportChosen) {
    const envTransport = process.env['TRANSPORT'];
    if (envTransport === 'http' || envTransport === 'stdio') {
      transport = envTransport;
    }
  }
  if (process.env['PORT'] && !portChosen) {
    const envPort = Number(process.env['PORT']);
    if (Number.isInteger(envPort) && envPort >= 1 && envPort <= 65535) port = envPort;
  }
  if (process.env['LOG_LEVEL'] && !logLevelChosen) {
    const envLevel = process.env['LOG_LEVEL'];
    if (['debug', 'info', 'warn', 'error'].includes(envLevel)) {
      logLevel = envLevel as typeof logLevel;
    }
  }

  if (live && action !== 'doctor') throw new Error('--live is only supported with --doctor.');
  if (confirmProfileDeletion && action !== 'logout')
    throw new Error('--confirm-profile-deletion is only supported with --logout.');
  return { transport, port, logLevel, action, client, live, confirmProfileDeletion };
}

/**
 * Print CLI help text.
 */
function printHelp(): void {
  // eslint-disable-next-line no-console -- CLI help text before MCP transport starts
  console.log(`
🔗 LinkedIn MCP Server v${VERSION}
   LinkedIn for AI assistants — structured JSON via a real stealth-browser session.

USAGE:
  linkedin-mcp [OPTIONS]

COMMANDS:
  --login                  Open a real Chrome window and sign in to LinkedIn
                           once; the session is saved to the browser profile.
  --setup <client>         Offline diagnosis, client config and exact next steps
  --client-config <client> Print JSON config for claude-desktop, cursor or vscode
  --doctor                 Diagnose local setup without launching Chrome or network requests
  --doctor --live          Also open the saved session and probe authenticated identity
  --status                 Show the current login/profile status
  --logout                 Clear the saved Chrome profile; keep safety history
  --confirm-profile-deletion  Required with --logout for a custom profile path
  --spike                  Verify the live data path (fetches your profile)

OPTIONS:
  -t, --transport <type>   Transport mode: stdio (default) or http
  -p, --port <number>      Port for HTTP transport (default: 3000)
  -l, --log-level <level>  Log level: debug, info, warn, error (default: info)
  -h, --help               Show this help message
  -v, --version            Show version

GETTING STARTED:
  # 1) One-time login (opens Chrome; solve any captcha/2FA yourself)
  linkedin-mcp --login

  # 2) Run for Claude Desktop / Cursor / Claude Code (stdio)
  linkedin-mcp

  # Or local-only HTTP (requires LINKEDIN_HTTP_TOKEN; see README)
  linkedin-mcp --transport http --port 3000

AUTHENTICATION:
  No cookies or tokens to paste. You log in once in a real browser window
  (--login); the authenticated, Cloudflare-cleared session persists in
  LINKEDIN_PROFILE_DIR (default ~/.linkedin-mcp/profile). Requires Google
  Chrome installed, or run \`patchright install chrome\` once.

DOCUMENTATION:
  https://github.com/devag7/linkedin-mcp
`);
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const config = parseArgs();
  const logger = new Logger(config.logLevel);

  if (config.action === 'setup' || config.action === 'client-config') {
    const env = loadConfig();
    const output =
      config.action === 'setup'
        ? setupReport(config.client!, env)
        : clientConfiguration(config.client!, env);
    // eslint-disable-next-line no-console -- Offline CLI output before transport starts
    console.log(JSON.stringify(output, null, 2));
    if ('status' in output && output.status === 'needs_attention') process.exitCode = 1;
    return;
  }
  if (config.action === 'doctor') {
    const report = await diagnose(loadConfig(), config, { live: config.live });
    // eslint-disable-next-line no-console -- Standalone CLI diagnosis before transport starts
    console.log(JSON.stringify(report, null, 2));
    const blocked =
      report.checks.safetyState !== 'valid' ||
      report.checks.profileOwned ||
      report.checks.budgetLocked ||
      !report.checks.profileWritable ||
      report.checks.chrome !== 'available' ||
      report.checks.httpToken === 'missing_or_invalid' ||
      report.checks.package === 'missing';
    process.exitCode = blocked || (config.live && report.session !== 'healthy') ? 1 : 0;
    return;
  }

  // Handle special commands
  if (config.action === 'login') {
    const ok = await interactiveBrowserLogin(loadConfig(), logger);
    process.exit(ok ? 0 : 1);
  }

  if (config.action === 'spike') {
    await runSpike(loadConfig(), logger);
    process.exit(0);
  }

  if (config.action === 'capture') {
    await runCapture(loadConfig(), logger);
    process.exit(0);
  }

  if (config.action === 'writecapture') {
    await runWriteCapture(loadConfig(), logger);
    process.exit(0);
  }

  if (config.action === 'writeprobe') {
    await runWriteProbe(loadConfig(), logger);
    process.exit(0);
  }

  if (config.action === 'logout') {
    const removed = removeSavedProfile({
      profileDir: process.env.LINKEDIN_PROFILE_DIR,
      confirmCustom: config.confirmProfileDeletion,
    });
    console.error(
      removed
        ? 'Logged out — browser profile cleared. Safety history retained.'
        : 'No saved session found — nothing to clear.',
    );
    process.exit(0);
  }

  if (config.action === 'status') {
    const dir = profileDir();
    console.error('\n🔗 LinkedIn MCP — Status\n');
    console.error(`  Version:      ${VERSION}`);
    console.error(`  Profile:      ${existsSync(dir) ? 'saved' : 'not created'}`);
    if (!existsSync(dir)) {
      console.error('  Session:      ❌ none — run `--login` to sign in once\n');
      process.exit(0);
    }
    const engine = new BrowserEngine(loadConfig(), logger);
    try {
      await engine.ensureContext();
      const loggedIn = await engine.isLoggedIn().catch(() => false);
      console.error(
        `  Session:      ${loggedIn ? '✅ logged in' : '⚠️  profile exists but not logged in — run `--login`'}\n`,
      );
    } catch {
      console.error('  Session: could not check; run --doctor for redacted setup guidance.');
    } finally {
      await engine.dispose();
    }
    process.exit(0);
  }

  try {
    await startServer(config);
  } catch {
    logger.error('Failed to start server. Run --doctor for redacted setup guidance.');
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', () => {
  console.error('Uncaught exception. Run --doctor for redacted setup guidance.');
  process.exit(1);
});

process.on('unhandledRejection', () => {
  console.error('Unhandled rejection. Run --doctor for redacted setup guidance.');
  process.exit(1);
});

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  const safe =
    message.startsWith('Official provider is unavailable') ||
    message.startsWith('Invalid environment configuration:') ||
    message.startsWith('Choose only one CLI command.') ||
    message.startsWith('Choose a supported setup client:') ||
    message.startsWith('A custom profile deletion requires') ||
    ['PROFILE_ALIAS_REFUSED', 'PROFILE_DELETION_ROOT_REFUSED', 'PROFILE_DELETION_CHANGED'].includes(
      message,
    ) ||
    message.startsWith('--confirm-profile-deletion is only supported') ||
    message.startsWith('--live is only supported');
  console.error(
    safe
      ? message
      : 'CLI command failed. Check the command options and run --doctor for redacted setup guidance.',
  );
  process.exitCode = 1;
});
