/** Delete only an unaliased profile directory; never resolve an alias for erasure. */
import { lstatSync, realpathSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { StateLock } from '../safety/state-lock.js';

function directorySnapshot(directory: string) {
  for (let current = directory; ; current = dirname(current)) {
    try {
      const stat = lstatSync(current);
      // Node reports directory symlinks and Windows junctions as symbolic links.
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('PROFILE_ALIAS_REFUSED');
      const actual = realpathSync(current);
      const same =
        process.platform === 'win32'
          ? actual.toLowerCase() === current.toLowerCase()
          : actual === current;
      if (!same) throw new Error('PROFILE_ALIAS_REFUSED');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (current === parse(current).root) break;
  }
  try {
    return lstatSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
function contains(candidate: string, protectedPath: string): boolean {
  const tail = relative(candidate, resolve(protectedPath));
  return (
    tail === '' ||
    (tail !== '..' &&
      !tail.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) &&
      !isAbsolute(tail))
  );
}

export function removeSavedProfile(
  options: {
    profileDir?: string;
    confirmCustom?: boolean;
    /** Temporary fixture anchors; the CLI never overrides these. */
    homeDir?: string;
    workingDir?: string;
  } = {},
): boolean {
  const home = options.homeDir ?? homedir();
  if (options.profileDir?.trim() && !options.confirmCustom)
    throw new Error(
      'A custom profile deletion requires --confirm-profile-deletion after reviewing its directory.',
    );
  const directory = resolve(options.profileDir || join(home, '.linkedin-mcp', 'profile'));
  if (
    directory === parse(directory).root ||
    contains(directory, home) ||
    contains(directory, options.workingDir ?? process.cwd())
  )
    throw new Error('PROFILE_DELETION_ROOT_REFUSED');
  const initial = directorySnapshot(directory);
  if (!initial) return false;
  const owner = new StateLock(`${directory}.owner`, true);
  owner.acquire();
  try {
    const current = directorySnapshot(directory);
    if (!current || current.dev !== initial.dev || current.ino !== initial.ino)
      throw new Error('PROFILE_DELETION_CHANGED');
    // Rename moves the directory entry itself. A swapped-in symlink is not followed.
    const quarantined = `${directory}.logout-${randomUUID()}`;
    renameSync(directory, quarantined);
    const moved = lstatSync(quarantined);
    if (
      moved.isSymbolicLink() ||
      !moved.isDirectory() ||
      moved.dev !== initial.dev ||
      moved.ino !== initial.ino
    ) {
      // Restore only when no entry has replaced the source. Never erase the target.
      try {
        lstatSync(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') renameSync(quarantined, directory);
      }
      throw new Error('PROFILE_DELETION_CHANGED');
    }
    // Recursive rm unlinks nested symlinks/junctions without traversing their targets.
    rmSync(quarantined, { recursive: true });
    return true;
  } finally {
    owner.release();
  }
}
