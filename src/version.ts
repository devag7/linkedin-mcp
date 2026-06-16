/**
 * Single source of truth for the server version.
 *
 * Read from package.json at runtime so the version can NEVER drift between
 * package.json and the code (whoami / health_check / --version / --help). In the
 * published package, package.json sits one level above dist/index.js; in dev it
 * sits above src/. `createRequire(import.meta.url)` resolves both.
 */
import { createRequire } from 'node:module';

function readVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('../package.json') as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const VERSION: string = readVersion();
