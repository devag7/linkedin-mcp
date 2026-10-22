import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'jsonc-parser';
import { CONFIG_MAX_BYTES, planClientConfig, previewClientConfig } from '../src/setup-config.js';
import { CLIENTS } from '../src/setup.js';

const hooks = vi.hoisted(() => ({
  beforeOpen: null as (() => void) | null,
  beforeRead: null as (() => void) | null,
}));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    openSync: (...args: Parameters<typeof actual.openSync>) => {
      const hook = hooks.beforeOpen;
      hooks.beforeOpen = null;
      hook?.();
      return actual.openSync(...args);
    },
    readSync: (
      fd: number,
      buffer: NodeJS.ArrayBufferView,
      offset: number,
      length: number,
      position: number | null,
    ) => {
      const hook = hooks.beforeRead;
      hooks.beforeRead = null;
      hook?.();
      return actual.readSync(fd, buffer, offset, length, position);
    },
  };
});

const entry = {
  command: '/synthetic/node',
  args: ['/synthetic/bundle.js'],
  env: { LINKEDIN_ENABLE_WRITES: 'false' },
};
const roots: string[] = [];
afterEach(() => {
  hooks.beforeOpen = hooks.beforeRead = null;
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});
const fixture = () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'linkedin-merge-')));
  roots.push(root);
  return root;
};

describe('offline config merge plan', () => {
  it.each(CLIENTS)(
    'adds only the safe entry for %s while preserving existing settings',
    (client) => {
      const key = client === 'vscode' ? 'servers' : 'mcpServers';
      const text = `{// synthetic local comment\n"${key}":{"other":{"env":{"TOKEN":"private-test-value"}}},"inputs":[{"id":"private-test-name"}],}`;
      const before = parse(text, [], { allowTrailingComma: true });
      const report = planClientConfig(client, text, entry);
      expect(report).toMatchObject({
        status: 'ready_to_add',
        existingServerCount: 1,
        existingTopLevelFieldCount: 2,
        patch: [{ op: 'add', path: `/${key}/linkedin`, value: entry }],
      });
      const next = structuredClone(before);
      next[key].linkedin = report.patch[0]!.value;
      expect(next[key].other).toEqual(before[key].other);
      expect(next.inputs).toEqual(before.inputs);
      const output = JSON.stringify(report);
      expect(output).not.toContain('private-test-value');
      expect(output).not.toContain('private-test-name');
      expect(output).not.toContain('synthetic local comment');
      expect(text).toContain('synthetic local comment');
    },
  );
  it.each(CLIENTS)('classifies a missing %s file without creating it', (client) => {
    const missing = join(fixture(), 'not-created.json');
    const report = previewClientConfig(client, missing, entry);
    const key = client === 'vscode' ? 'servers' : 'mcpServers';
    expect(report).toMatchObject({
      status: 'absent',
      patch: [{ op: 'add', path: `/${key}`, value: { linkedin: entry } }],
    });
  });
  it('adds an absent server map without replacing other root fields', () => {
    expect(planClientConfig('cursor', '{"theme":"local-private-value"}', entry)).toMatchObject({
      status: 'ready_to_add',
      patch: [{ path: '/mcpServers', value: { linkedin: entry } }],
    });
  });
  it('accepts semantically identical entries regardless of property order', () => {
    const shuffled = { env: entry.env, args: entry.args, command: entry.command };
    expect(
      planClientConfig('cursor', JSON.stringify({ mcpServers: { linkedin: shuffled } }), entry),
    ).toMatchObject({ status: 'already_matches', patch: [] });
  });
  it.each([null, 'private-test-command', { ...entry, env: { SECRET: 'private-test-token' } }])(
    'never replaces or echoes conflicting entries',
    (existing) => {
      const report = planClientConfig(
        'cursor',
        JSON.stringify({ mcpServers: { linkedin: existing } }),
        entry,
      );
      expect(report).toMatchObject({ status: 'conflict', patch: [] });
      expect(JSON.stringify(report)).not.toMatch(/private-test-(command|token)/);
    },
  );
  it.each(['', '[{}]', 'null', '{"mcpServers":', '{"mcpServers":{}} trailing'])(
    'rejects invalid top-level JSONC',
    (text) => {
      expect(planClientConfig('cursor', text, entry)).toMatchObject({
        status: 'invalid',
        patch: [],
      });
    },
  );
  it.each(['{"mcpServers":null}', '{"mcpServers":[]}', '{"mcpServers":42}'])(
    'rejects nonobject server maps',
    (text) => {
      expect(planClientConfig('cursor', text, entry).reason).toBe('CONFIG_SERVER_MAP_NOT_OBJECT');
    },
  );
  it.each(['{"servers":{}}', '{"mcpServers":{},"servers":{}}'])(
    'rejects a wrong or mixed client root',
    (text) => {
      expect(planClientConfig('cursor', text, entry).reason).toBe('CONFIG_WRONG_CLIENT_ROOT');
    },
  );
  it('rejects the portable root for an explicitly native VS Code export', () => {
    expect(planClientConfig('vscode', '{"mcpServers":{}}', entry).reason).toBe(
      'CONFIG_WRONG_CLIENT_ROOT',
    );
  });
  it.each([
    '{"mcpServers":{},"mcpServers":{}}',
    '{"mcpServers":{"linkedin":{},"linke\\u0064in":{}}}',
    '{"unrelated":{"a":1,"a":2}}',
  ])('rejects ambiguous duplicate keys, including escaped keys', (text) => {
    expect(planClientConfig('cursor', text, entry).reason).toBe('CONFIG_DUPLICATE_KEY');
  });
  it('handles special property names without prototype lookup or mutation', () => {
    const report = planClientConfig(
      'cursor',
      '{"__proto__":{"mcpServers":{"linkedin":"private-test-value"}},"mcpServers":{}}',
      entry,
    );
    expect(report.status).toBe('ready_to_add');
    expect(JSON.stringify(report)).not.toContain('private-test-value');
    expect(({} as Record<string, unknown>).mcpServers).toBeUndefined();
  });
  it('supports UTF-8 BOM, comments, trailing commas and quoted brace characters', () => {
    expect(
      planClientConfig('cursor', '\uFEFF{/* [[ comment */"mcpServers":{},"other":"[[[[{",}', entry)
        .status,
    ).toBe('ready_to_add');
  });
  it('bounds input bytes, nesting and token complexity', () => {
    expect(planClientConfig('cursor', ' '.repeat(CONFIG_MAX_BYTES + 1), entry).reason).toBe(
      'CONFIG_TOO_LARGE',
    );
    expect(planClientConfig('cursor', '['.repeat(65) + ']'.repeat(65), entry).reason).toBe(
      'CONFIG_TOO_DEEP',
    );
    expect(
      planClientConfig('cursor', '{"other":[' + '0,'.repeat(50001) + '0]}', entry).reason,
    ).toBe('CONFIG_TOO_COMPLEX');
  });
  it('rejects malformed-token floods on the first parse error', () => {
    expect(
      planClientConfig('cursor', '{"mcpServers":[' + ','.repeat(500000) + ']}', entry),
    ).toMatchObject({ status: 'invalid', reason: 'CONFIG_INVALID_JSONC', patch: [] });
  });
  it('reads a disposable config without changing a single byte', () => {
    const file = join(fixture(), 'with spaces.json');
    const text =
      '// private-test-comment\n{"mcpServers":{"other":{"env":{"SECRET":"private-test-token"}}},}';
    writeFileSync(file, text);
    const report = previewClientConfig('cursor', file, entry);
    expect(report.status).toBe('ready_to_add');
    expect(readFileSync(file, 'utf8')).toBe(text);
    expect(JSON.stringify(report)).not.toContain('private-test-token');
  });
  it('refuses nonregular files and broken aliases without following their targets', () => {
    const root = fixture();
    expect(previewClientConfig('cursor', root, entry).status).toBe('invalid');
    const alias = join(root, 'broken-alias');
    symlinkSync(
      join(root, 'missing-target'),
      alias,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    expect(previewClientConfig('cursor', alias, entry).reason).toBe('CONFIG_ALIAS_REFUSED');
  });
  it('rejects oversized or invalid UTF-8 files with value-free diagnostics', () => {
    const file = join(fixture(), 'file.json');
    writeFileSync(file, Buffer.alloc(CONFIG_MAX_BYTES + 1));
    expect(previewClientConfig('cursor', file, entry).reason).toBe('CONFIG_TOO_LARGE');
    writeFileSync(file, Buffer.from([0xff, 0xfe]));
    expect(previewClientConfig('cursor', file, entry).reason).toBe('CONFIG_UNREADABLE');
  });
  it('resolves a parent alias for a read-only snapshot without changing the target', () => {
    const root = fixture();
    const file = join(root, 'config.json');
    writeFileSync(file, '{"mcpServers":{}}');
    const alias = join(fixture(), 'parent-alias');
    symlinkSync(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
    expect(previewClientConfig('cursor', join(alias, 'config.json'), entry).status).toBe(
      'ready_to_add',
    );
    expect(readFileSync(file, 'utf8')).toBe('{"mcpServers":{}}');
  });
  it.each(['beforeOpen', 'beforeRead'] as const)(
    'rejects a disposable file replacement %s',
    (stage) => {
      const root = fixture();
      const file = join(root, 'config.json');
      const next = join(root, 'replacement.json');
      writeFileSync(file, '{"mcpServers":{}}');
      writeFileSync(next, '{"mcpServers":{"linkedin":"private-replacement"}}');
      hooks[stage] = () => {
        renameSync(file, join(root, 'original.json'));
        renameSync(next, file);
      };
      const report = previewClientConfig('cursor', file, entry);
      expect(report).toMatchObject({
        status: 'invalid',
        reason: 'CONFIG_CHANGED_DURING_READ',
        patch: [],
      });
      expect(JSON.stringify(report)).not.toContain('private-replacement');
    },
  );
  it('does not call a vanished file an absent safe configuration', () => {
    const root = fixture();
    const file = join(root, 'config.json');
    writeFileSync(file, '{"mcpServers":{}}');
    hooks.beforeRead = () => renameSync(file, join(root, 'moved.json'));
    expect(previewClientConfig('cursor', file, entry)).toMatchObject({
      status: 'invalid',
      reason: 'CONFIG_CHANGED_DURING_READ',
      patch: [],
    });
  });
});
