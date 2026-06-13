import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import type { Logger } from '../types.js';

/**
 * Persistent credential storage.
 * Stores LinkedIn credentials in ~/.linkedin-mcp/credentials.json
 * so users only need to configure once.
 *
 * Similar to the competitor's --login flow, but without needing a browser.
 */

const CONFIG_DIR = path.join(os.homedir(), '.linkedin-mcp');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');

interface StoredCredentials {
  linkedin_cookie?: string;
  linkedin_csrf_token?: string;
  linkedin_access_token?: string;
  saved_at?: string;
}

/**
 * Ensure the config directory exists with secure permissions.
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Load saved credentials from disk.
 * Returns undefined if no credentials file exists.
 */
export function loadStoredCredentials(logger?: Logger): StoredCredentials | undefined {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      return undefined;
    }
    const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
    const creds: StoredCredentials = JSON.parse(raw);
    logger?.debug('Loaded stored credentials', { path: CREDENTIALS_FILE });
    return creds;
  } catch (error) {
    logger?.warn('Failed to load stored credentials', {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Save credentials to disk with secure permissions.
 */
export function saveCredentials(creds: StoredCredentials, logger?: Logger): void {
  ensureConfigDir();
  const data = {
    ...creds,
    saved_at: new Date().toISOString(),
  };
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2), {
    mode: 0o600, // Owner read/write only
  });
  logger?.info('Credentials saved', { path: CREDENTIALS_FILE });
}

/**
 * Delete stored credentials.
 */
export function clearCredentials(logger?: Logger): boolean {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      fs.unlinkSync(CREDENTIALS_FILE);
      logger?.info('Credentials cleared', { path: CREDENTIALS_FILE });
      return true;
    }
    return false;
  } catch (error) {
    logger?.error('Failed to clear credentials', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Check if stored credentials exist.
 */
export function hasStoredCredentials(): boolean {
  return fs.existsSync(CREDENTIALS_FILE);
}

/**
 * Merge stored credentials into process.env (only if not already set).
 * Environment variables always take precedence over stored credentials.
 */
export function applyStoredCredentials(logger?: Logger): void {
  const stored = loadStoredCredentials(logger);
  if (!stored) return;

  if (stored.linkedin_cookie && !process.env.LINKEDIN_COOKIE) {
    process.env.LINKEDIN_COOKIE = stored.linkedin_cookie;
    logger?.debug('Applied stored cookie credential');
  }
  if (stored.linkedin_csrf_token && !process.env.LINKEDIN_CSRF_TOKEN) {
    process.env.LINKEDIN_CSRF_TOKEN = stored.linkedin_csrf_token;
    logger?.debug('Applied stored CSRF token');
  }
  if (stored.linkedin_access_token && !process.env.LINKEDIN_ACCESS_TOKEN) {
    process.env.LINKEDIN_ACCESS_TOKEN = stored.linkedin_access_token;
    logger?.debug('Applied stored OAuth token');
  }
}

/**
 * Interactive login flow — prompts the user for credentials and saves them.
 * Called via `linkedin-mcp --login`.
 */
export async function interactiveLogin(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr, // Write prompts to stderr (stdout is for MCP protocol)
  });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  console.error('\n🔗 LinkedIn MCP — One-Time Login Setup\n');
  console.error('Your credentials will be saved to ~/.linkedin-mcp/credentials.json');
  console.error('You only need to do this once. Environment variables override saved credentials.\n');
  console.error('Choose authentication method:\n');
  console.error('  1. Cookie Auth (recommended — works with all 36 tools)');
  console.error('  2. OAuth Token (experimental — limited to official REST API endpoints)\n');

  const method = await ask('Enter choice (1 or 2): ');

  if (method.trim() === '2') {
    // OAuth flow
    console.error('\n📋 OAuth Setup:');
    console.error('   1. Go to https://www.linkedin.com/developers/');
    console.error('   2. Create an app and get your access token\n');

    const token = await ask('Paste your LinkedIn access token: ');
    if (!token.trim()) {
      console.error('❌ No token provided. Aborting.');
      rl.close();
      process.exit(1);
    }

    saveCredentials({ linkedin_access_token: token.trim() });
    console.error('\n✅ OAuth token saved! You can now use linkedin-mcp without any env vars.');
  } else {
    // Cookie flow (default)
    console.error('\n📋 Cookie Setup:');
    console.error('   1. Open LinkedIn in your browser and log in');
    console.error('   2. Open DevTools (F12) → Application → Cookies → linkedin.com');
    console.error('   3. Copy the value of the "li_at" cookie');
    console.error('   4. Optionally copy the "JSESSIONID" cookie for extra security\n');

    const cookie = await ask('Paste your li_at cookie value: ');
    if (!cookie.trim()) {
      console.error('❌ No cookie provided. Aborting.');
      rl.close();
      process.exit(1);
    }

    const csrf = await ask('Paste JSESSIONID (optional, press Enter to skip): ');

    const creds: StoredCredentials = {
      linkedin_cookie: cookie.trim().replace(/^["']|["']$/g, ''),
    };
    if (csrf.trim()) {
      creds.linkedin_csrf_token = csrf.trim().replace(/^["']|["']$/g, '');
    }

    saveCredentials(creds);
    console.error('\n✅ Cookie saved! You can now use linkedin-mcp without any env vars.');
  }

  console.error(`   Credentials stored at: ${CREDENTIALS_FILE}`);
  console.error('   To update, run: linkedin-mcp --login');
  console.error('   To clear, run:  linkedin-mcp --logout\n');
  rl.close();
}
