#!/usr/bin/env node

/**
 * LinkedIn MCP Server — Entry Point
 *
 * 22 tools (reads + gated writes) for Claude, Cursor, and any MCP client.
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
import * as os from 'node:os';
import * as path from 'node:path';
import { rmSync, existsSync } from 'node:fs';
import { BrowserEngine } from './browser/engine.js';
import { interactiveBrowserLogin, runSpike } from './browser/login.js';
import { runCapture } from './browser/capture.js';
import { runWriteCapture } from './browser/writecapture.js';
import { runWriteProbe } from './browser/writeprobe.js';
import { VERSION } from './version.js';
import { loadConfig } from './config/env.js';

/** Resolve the persistent browser-profile directory (mirrors BrowserEngine). */
function profileDir(): string {
  return process.env.LINKEDIN_PROFILE_DIR || path.join(os.homedir(), '.linkedin-mcp', 'profile');
}

/**
 * Parse command-line arguments.
 */
function parseArgs(): ServerConfig & {
  action?: 'login' | 'logout' | 'status' | 'spike' | 'capture' | 'writecapture' | 'writeprobe';
} {
  const args = process.argv.slice(2);
  let transport: TransportType = 'stdio';
  let port = 3000;
  let logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  let action: 'login' | 'logout' | 'status' | 'spike' | 'capture' | 'writecapture' | 'writeprobe' | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--login':
        action = 'login';
        break;

      case '--logout':
        action = 'logout';
        break;

      case '--status':
        action = 'status';
        break;

      case '--spike':
        action = 'spike';
        break;

      case '--capture':
        action = 'capture';
        break;

      case '--writecapture':
        action = 'writecapture';
        break;

      case '--writeprobe':
        action = 'writeprobe';
        break;

      case '--transport':
      case '-t':
        if (next === 'stdio' || next === 'http') {
          transport = next;
          i++;
        } else {
          console.error(`Invalid transport: ${next}. Use 'stdio' or 'http'.`);
          process.exit(1);
        }
        break;

      case '--port':
      case '-p':
        port = parseInt(next ?? '', 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          console.error(`Invalid port: ${next}. Use a number between 1 and 65535.`);
          process.exit(1);
        }
        i++;
        break;

      case '--log-level':
      case '-l':
        if (['debug', 'info', 'warn', 'error'].includes(next ?? '')) {
          logLevel = next as typeof logLevel;
          i++;
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
        console.error(`Unknown argument: ${arg}. Use --help for usage info.`);
        process.exit(1);
    }
  }

  // Also check environment variables (env overrides are lower priority than CLI)
  if (process.env['TRANSPORT'] && transport === 'stdio') {
    const envTransport = process.env['TRANSPORT'];
    if (envTransport === 'http' || envTransport === 'stdio') {
      transport = envTransport;
    }
  }
  if (process.env['PORT'] && port === 3000) {
    const envPort = parseInt(process.env['PORT'], 10);
    if (!isNaN(envPort)) port = envPort;
  }
  if (process.env['LOG_LEVEL']) {
    const envLevel = process.env['LOG_LEVEL'];
    if (['debug', 'info', 'warn', 'error'].includes(envLevel)) {
      logLevel = envLevel as typeof logLevel;
    }
  }

  return { transport, port, logLevel, action };
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
  --status                 Show the current login/profile status
  --logout                 Clear the saved session
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

  # Or HTTP transport for an MCP client over the network
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
    const dir = profileDir();
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
      console.error(`✅ Logged out — browser profile cleared (${dir}). Run --login to sign in again.`);
    } else {
      console.error('ℹ️  No saved session found — nothing to clear.');
    }
    process.exit(0);
  }

  if (config.action === 'status') {
    const dir = profileDir();
    console.error('\n🔗 LinkedIn MCP — Status\n');
    console.error(`  Version:      ${VERSION}`);
    console.error(`  Profile dir:  ${dir}`);
    if (!existsSync(dir)) {
      console.error('  Session:      ❌ none — run `--login` to sign in once\n');
      process.exit(0);
    }
    const engine = new BrowserEngine(loadConfig(), logger);
    try {
      await engine.ensureContext();
      const loggedIn = await engine.isLoggedIn().catch(() => false);
      console.error(`  Session:      ${loggedIn ? '✅ logged in' : '⚠️  profile exists but not logged in — run `--login`'}\n`);
    } catch (err) {
      console.error(`  Session:      ⚠️  could not check (${err instanceof Error ? err.message : String(err)})\n`);
    } finally {
      await engine.shutdown();
    }
    process.exit(0);
  }

  try {
    await startServer(config);
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

main();
