import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv';
import { CAPABILITIES } from '../src/tools/capabilities.js';
const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
const pkg = read('package.json');
const registry = read('server.json');
const schema = read('tests/fixtures/mcp-registry-schema-2025-12-11.json');
const validate = new AjvJsonSchemaValidator().getValidator(schema);
it('generated registry metadata passes the pinned official schema and uses the package version', () => {
  expect(validate(registry).valid).toBe(true);
  expect(registry.version).toBe(pkg.version);
  expect(registry.packages[0].version).toBe(pkg.version);
  expect(registry.packages[0].identifier).toBe(pkg.name);
  expect(registry.name).toBe(pkg.mcpName);
});
it('the official schema rejects oversized descriptions and an invalid transport', () => {
  expect(validate({ ...registry, description: 'x'.repeat(101) }).valid).toBe(false);
  expect(
    validate({
      ...registry,
      packages: [{ ...registry.packages[0], transport: { type: 'arbitrary' } }],
    }).valid,
  ).toBe(false);
});
it('generated local inventory and pinned client configuration stay consistent with source', () => {
  const manifest = read('mcp-manifest.json');
  expect(manifest.version).toBe(pkg.version);
  expect(manifest.tools.map((t: { name: string }) => t.name).sort()).toEqual(
    Object.keys(CAPABILITIES).sort(),
  );
  expect(manifest.tools.every((t: { liveCheckedAt: null }) => t.liveCheckedAt === null)).toBe(true);
  expect(read('claude-desktop-config.json').mcpServers.linkedin.args).toContain(
    `${pkg.name}@${pkg.version}`,
  );
});
