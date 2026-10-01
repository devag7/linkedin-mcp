/** A pinned, checksum-verified publisher; no curl pipe or extraction before verification. */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, copyFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyPublisher(lock, bytes) {
  if (
    !/^v\d+\.\d+\.\d+$/.test(lock.version) ||
    lock.url !==
      `https://github.com/modelcontextprotocol/registry/releases/download/${lock.version}/mcp-publisher_linux_amd64.tar.gz` ||
    !/^[a-f0-9]{64}$/.test(lock.sha256) ||
    !Number.isSafeInteger(lock.size) ||
    lock.size <= 0 ||
    lock.size > 20 * 1024 * 1024 ||
    bytes.length !== lock.size ||
    createHash('sha256').update(bytes).digest('hex') !== lock.sha256
  )
    throw new Error('PUBLISHER_CHECKSUM_MISMATCH');
}
async function main() {
  if (process.platform !== 'linux' || process.arch !== 'x64')
    throw new Error('PUBLISHER_PLATFORM_UNSUPPORTED');
  const lock = JSON.parse(
    readFileSync(new URL('./mcp-publisher-lock.json', import.meta.url), 'utf8'),
  );
  const response = await fetch(lock.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('PUBLISHER_DOWNLOAD_FAILED');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > lock.size || size > 20 * 1024 * 1024)
        throw new Error('PUBLISHER_DOWNLOAD_TOO_LARGE');
      chunks.push(Buffer.from(chunk.value));
    }
  } finally {
    await reader.cancel();
  }
  const bytes = Buffer.concat(chunks);
  verifyPublisher(lock, bytes);
  const directory = mkdtempSync(join(tmpdir(), 'linkedin-publisher-'));
  try {
    const archive = join(directory, 'publisher.tar.gz');
    writeFileSync(archive, bytes);
    const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
    if (!entries.includes('mcp-publisher')) throw new Error('PUBLISHER_BINARY_MISSING');
    // Extract only the expected entry from the verified upstream archive.
    execFileSync('tar', ['-xzf', archive, '-C', directory, 'mcp-publisher']);
    copyFileSync(join(directory, 'mcp-publisher'), 'mcp-publisher');
    chmodSync('mcp-publisher', 0o700);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'PUBLISHER_INSTALL_FAILED');
    process.exitCode = 1;
  });
