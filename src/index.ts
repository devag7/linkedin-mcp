#!/usr/bin/env node

/**
 * LinkedIn MCP Server — Entry Point
 *
 * The most reliable LinkedIn MCP server for AI assistants.
 * 36 tools, remote-first, zero local dependencies.
 *
 * Usage:
 *   npx linkedin-mcp-tools                     # stdio mode (default)
 *   npx linkedin-mcp-tools --transport http     # HTTP mode on port 3000
 *   npx linkedin-mcp-tools --login              # One-time credential setup
 *
 * @see https://github.com/devag7/linkedin-mcp
 */

import { startServer } from './server.js';
import type { ServerConfig, TransportType } from './types.js';
import { Logger } from './types.js';
import {
  interactiveLogin,
  clearCredentials,
  applyStoredCredentials,
  hasStoredCredentials,
} from './auth/store.js';

/**
 * Parse command-line arguments.
 */
function parseArgs(): ServerConfig & { action?: 'login' | 'logout' | 'status' } {
  const args = process.argv.slice(2);
  let transport: TransportType = 'stdio';
  let port = 3000;
  let logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  let action: 'login' | 'logout' | 'status' | undefined;

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
        console.log('linkedin-mcp v1.0.0');
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
🔗 LinkedIn MCP Server v1.0.0
   The most reliable LinkedIn MCP server for AI assistants.

USAGE:
  linkedin-mcp [OPTIONS]

COMMANDS:
  --login                  Save LinkedIn credentials (one-time setup)
  --logout                 Clear saved credentials
  --status                 Show current auth status

OPTIONS:
  -t, --transport <type>   Transport mode: stdio (default) or http
  -p, --port <number>      Port for HTTP transport (default: 3000)
  -l, --log-level <level>  Log level: debug, info, warn, error (default: info)
  -h, --help               Show this help message
  -v, --version            Show version

EXAMPLES:
  # One-time login (saves to ~/.linkedin-mcp/credentials.json)
  linkedin-mcp --login

  # Run with stdio (for Claude Desktop / Claude Code)
  linkedin-mcp

  # Run with HTTP (for remote access)
  linkedin-mcp --transport http --port 3000

  # Run with environment variables (overrides saved credentials)
  LINKEDIN_COOKIE="your_li_at_cookie" linkedin-mcp

AUTHENTICATION:
  Credentials are loaded in this order (first wins):
  1. Environment variables (LINKEDIN_COOKIE, LINKEDIN_ACCESS_TOKEN)
  2. Saved credentials (~/.linkedin-mcp/credentials.json via --login)

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
    await interactiveLogin();
    process.exit(0);
  }

  if (config.action === 'logout') {
    const cleared = clearCredentials(logger);
    if (cleared) {
      console.error('✅ Saved credentials cleared.');
    } else {
      console.error('ℹ️  No saved credentials found.');
    }
    process.exit(0);
  }

  if (config.action === 'status') {
    const hasStored = hasStoredCredentials();
    const hasEnvCookie = !!process.env.LINKEDIN_COOKIE;
    const hasEnvOAuth = !!process.env.LINKEDIN_ACCESS_TOKEN;

    console.error('\n🔗 LinkedIn MCP — Auth Status\n');
    console.error(`  Saved credentials:  ${hasStored ? '✅ Found (~/.linkedin-mcp/credentials.json)' : '❌ None'}`);
    console.error(`  Env LINKEDIN_COOKIE: ${hasEnvCookie ? '✅ Set' : '❌ Not set'}`);
    console.error(`  Env LINKEDIN_ACCESS_TOKEN: ${hasEnvOAuth ? '✅ Set' : '❌ Not set'}`);
    console.error(`\n  Active method: ${hasEnvOAuth ? 'OAuth (env)' : hasEnvCookie ? 'Cookie (env)' : hasStored ? 'Saved credentials' : 'None — run --login'}\n`);
    process.exit(0);
  }

  // Apply stored credentials before server starts
  // (env vars take precedence — applyStoredCredentials only fills gaps)
  applyStoredCredentials(logger);

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
