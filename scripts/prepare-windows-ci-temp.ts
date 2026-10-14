/** Keep disposable CI fixtures beneath a directory with the runtime's native ACL. */
import { appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ensurePrivateStateDirectory } from '../src/safety/windows-private-state.js';

if (process.platform !== 'win32' || !process.env.GITHUB_ENV)
  throw new Error('WINDOWS_CI_ENVIRONMENT_REQUIRED');

const temp = join(homedir(), `linkedin-mcp-ci-${randomUUID()}`);
ensurePrivateStateDirectory(temp);
appendFileSync(process.env.GITHUB_ENV, `TMP=${temp}\nTEMP=${temp}\n`);
process.stdout.write('{"privateFixtureTemp":"created"}\n');
