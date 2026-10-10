/** Read-only client merge plan. Never emits or writes the existing configuration. */
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { findNodeAtLocation, parseTree, visit, type Node, type ParseError } from 'jsonc-parser';
import type { SetupClient } from './setup.js';

export const CONFIG_MAX_BYTES = 1024 * 1024;
const MAX_DEPTH = 64;
const MAX_NODES = 50000;
type ConfigStatus =
  | 'absent'
  | 'ready_to_add'
  | 'already_matches'
  | 'conflict'
  | 'invalid'
  | 'unavailable';

function rootKey(client: SetupClient) {
  return client === 'vscode' ? 'servers' : 'mcpServers';
}

function result(client: SetupClient, status: ConfigStatus, reason: string) {
  return {
    status,
    reason,
    scope: 'Read-only offline snapshot; no client file was changed or server started.',
    rootKey: rootKey(client),
    existingServerCount: 0,
    existingTopLevelFieldCount: 0,
    patch: [] as { op: 'add'; path: string; value: unknown }[],
    nextSteps: [] as string[],
  };
}

/** Construct values without invoking special-key prototype setters. */
export function unavailableClientConfig(client: SetupClient) {
  const report = result(client, 'unavailable', 'SETUP_CONFIGURATION_UNAVAILABLE');
  report.nextSteps = [
    'Repair diagnosis.nextSteps and regenerate the safe entry before previewing a merge. The selected client file was not read.',
  ];
  return report;
}

function nodeValue(node: Node): unknown {
  if (node.type === 'object')
    return Object.fromEntries(
      (node.children ?? []).map((property) => [
        property.children![0]!.value,
        nodeValue(property.children![1]!),
      ]),
    );
  if (node.type === 'array') return (node.children ?? []).map(nodeValue);
  return node.value;
}

function validTree(root: Node): boolean {
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.type === 'object') {
      const names = (node.children ?? []).map((property) => property.children![0]!.value);
      if (new Set(names).size !== names.length) return false;
    }
    pending.push(...(node.children ?? []));
  }
  return true;
}

/** Pure planner accepts JSON/JSONC; its patch contains only the new safe entry. */
export function planClientConfig(client: SetupClient, text: string | null, server: unknown) {
  const key = rootKey(client);
  if (text === null) {
    const report = result(client, 'absent', 'CONFIG_FILE_NOT_FOUND');
    report.patch = [{ op: 'add', path: `/${key}`, value: { linkedin: server } }];
    report.nextSteps = [
      'Create a new configuration using the generated client entry. No file was created.',
    ];
    return report;
  }
  const invalid = (reason: string) => {
    const report = result(client, 'invalid', reason);
    report.nextSteps = [
      'Repair the specified client configuration locally, then rerun this offline preview. Existing contents were not printed or changed.',
    ];
    return report;
  };
  if (Buffer.byteLength(text, 'utf8') > CONFIG_MAX_BYTES) return invalid('CONFIG_TOO_LARGE');
  // Stop the visitor before excessive recursion/allocation; strings/comments are not containers.
  text = text.replace(/^\uFEFF/, '');
  let depth = 0;
  let nodes = 0;
  const count = () => {
    if (++nodes > MAX_NODES) throw new Error('CONFIG_TOO_COMPLEX');
  };
  const enter = () => {
    count();
    if (++depth > MAX_DEPTH) throw new Error('CONFIG_TOO_DEEP');
  };
  const leave = () => {
    depth--;
  };
  try {
    visit(
      text,
      {
        onObjectBegin: enter,
        onArrayBegin: enter,
        onObjectEnd: leave,
        onArrayEnd: leave,
        onObjectProperty: count,
        onLiteralValue: count,
        onError: () => {
          throw new Error('CONFIG_INVALID_JSONC');
        },
      },
      { allowTrailingComma: true },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    return invalid(
      ['CONFIG_TOO_DEEP', 'CONFIG_TOO_COMPLEX', 'CONFIG_INVALID_JSONC'].includes(reason)
        ? reason
        : 'CONFIG_INVALID_JSONC',
    );
  }
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: true });
  if (errors.length || !root || root.type !== 'object') return invalid('CONFIG_INVALID_JSONC');
  if (!validTree(root)) return invalid('CONFIG_DUPLICATE_KEY');
  const otherKey = key === 'servers' ? 'mcpServers' : 'servers';
  if (findNodeAtLocation(root, [otherKey])) return invalid('CONFIG_WRONG_CLIENT_ROOT');
  const map = findNodeAtLocation(root, [key]);
  if (map && map.type !== 'object') return invalid('CONFIG_SERVER_MAP_NOT_OBJECT');
  const existing = findNodeAtLocation(root, [key, 'linkedin']);
  const status = existing
    ? isDeepStrictEqual(nodeValue(existing), server)
      ? 'already_matches'
      : 'conflict'
    : 'ready_to_add';
  const report = result(
    client,
    status,
    existing
      ? status === 'conflict'
        ? 'CONFIG_LINKEDIN_CONFLICT'
        : 'CONFIG_LINKEDIN_MATCHES'
      : 'CONFIG_LINKEDIN_ABSENT',
  );
  report.existingServerCount = map?.children?.length ?? 0;
  report.existingTopLevelFieldCount = root.children?.length ?? 0;
  if (!existing) {
    report.patch = map
      ? [{ op: 'add', path: `/${key}/linkedin`, value: server }]
      : [{ op: 'add', path: `/${key}`, value: { linkedin: server } }];
    report.nextSteps = [
      'Review the JSON Patch addition and merge the generated linkedin entry in your editor, preserving other servers, settings and comments. Rerun if the file changes: a generic add applied to a stale document can replace an entry. The plan is not applied automatically.',
    ];
  } else if (status === 'conflict') {
    report.nextSteps = [
      'An existing linkedin entry differs. Review it locally and decide which installed build/profile to keep; no replacement patch was generated.',
    ];
  } else {
    report.nextSteps = [
      'The linkedin entry matches this installed build. Client trust, runtime startup and live compatibility remain unverified.',
    ];
  }
  return report;
}

/** Bounded file read; refuse nonregular files and never include native errors. */
export function previewClientConfig(client: SetupClient, file: string, server: unknown) {
  let fd: number | undefined;
  let sourceSeen = false;
  try {
    const original = lstatSync(file, { bigint: true });
    sourceSeen = true;
    if (original.isSymbolicLink()) throw new Error('CONFIG_ALIAS_REFUSED');
    if (!original.isFile()) throw new Error('CONFIG_NOT_REGULAR_FILE');
    fd = openSync(
      file,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile()) throw new Error('CONFIG_NOT_REGULAR_FILE');
    if (original.ino === 0n || before.ino === 0n) throw new Error('CONFIG_IDENTITY_UNAVAILABLE');
    if (original.dev !== before.dev || original.ino !== before.ino)
      throw new Error('CONFIG_CHANGED_DURING_READ');
    if (before.size > BigInt(CONFIG_MAX_BYTES)) throw new Error('CONFIG_TOO_LARGE');
    const bytes = Buffer.alloc(CONFIG_MAX_BYTES + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = readSync(fd, bytes, count, bytes.length - count, null);
      if (!read) break;
      count += read;
    }
    if (count > CONFIG_MAX_BYTES) throw new Error('CONFIG_TOO_LARGE');
    const after = fstatSync(fd, { bigint: true });
    const current = lstatSync(file, { bigint: true });
    if (
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.size !== after.size ||
      current.mtimeNs !== after.mtimeNs ||
      current.ctimeNs !== after.ctimeNs
    )
      throw new Error('CONFIG_CHANGED_DURING_READ');
    return planClientConfig(
      client,
      new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, count)),
      server,
    );
  } catch (error) {
    if (!sourceSeen && (error as NodeJS.ErrnoException).code === 'ENOENT')
      return planClientConfig(client, null, server);
    const message =
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'CONFIG_CHANGED_DURING_READ'
        : error instanceof Error
          ? error.message
          : '';
    const allowed = [
      'CONFIG_ALIAS_REFUSED',
      'CONFIG_IDENTITY_UNAVAILABLE',
      'CONFIG_NOT_REGULAR_FILE',
      'CONFIG_TOO_LARGE',
      'CONFIG_CHANGED_DURING_READ',
    ];
    const report = result(
      client,
      'invalid',
      allowed.includes(message) ? message : 'CONFIG_UNREADABLE',
    );
    report.nextSteps = [
      'Choose an accessible regular UTF-8 client configuration file without a final-component symlink/junction alias, then rerun. Parent aliases may be resolved for this read-only snapshot. No file contents or native error were printed.',
    ];
    return report;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
