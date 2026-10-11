# Development build repair — October 11, 2026

This separate draft starts from core main `4b9e816`; it does not include inventory,
client-config preview or research briefs, and does not alter the frozen PR #14,
PR #15 or closed PR #5 heads. Published 3.0.0 remains immutable.

## Evidence and supported change

The full source audit finds low GHSA-g7r4-m6w7-qqqr in esbuild 0.27.7 under
tsup 8.5.1. The advisory concerns the Windows development server's servedir
path handling; our build is a one-shot bundle, not that server. Production and
publisher trees were already clear. The patch is esbuild 0.28.1 or newer, while
tsup 8.5.1 (current registry/upstream release) declares ^0.27.0. Therefore
`fixAvailable:true` does not establish a supported tsup lockfile repair. Ordinary
`npm audit fix --dry-run --ignore-scripts` remains exit 1; no force, override or
suppression is used.

The selected narrow repair calls patched esbuild's supported build API directly
for the existing single CLI entry. The direct development floor is ^0.28.2; the
unused tsup wrapper/config and its development dependency tree are removed.
`npm run build` stays the interface: ESM Node20 target, all packages external,
linked sourcemap, no splitting, declarations, shims, watch/serve or directory
cleaning. Existing unrelated output files are preserved. No runtime source or
production dependency/lock records change.

Primary references: [advisory](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr),
[upstream tsup dependency](https://github.com/egoist/tsup/blob/main/package.json),
[esbuild API](https://esbuild.github.io/api/),
[patched release](https://github.com/evanw/esbuild/releases/tag/v0.28.1).

## Measured parity and limitations

The baseline tsup artifact and lockfile are preserved privately. Compiler output
is not byte-identical. Third-party ESM import specifiers are identical; Node
builtin modules remain identical, with explicit node: prefixes retained instead
of being stripped by tsup. Source-map sources and embedded contents are
identical and remain linked. The entry shebang and macOS executable mode 0755
are preserved. The entire current imported source graph is covered by the map;
there are no additional emitted asset files. This does not promise parity for
future asset imports, plugins or new build outputs.

A disposable build verifier copies current source/config into a temporary
directory, builds with the real API, checks the shebang/sourcemap and preserves
unrelated/sync-style sentinel output bytes. POSIX executable mode is checked;
Windows uses the separately verified installed npm shim, not a POSIX privacy
claim. The package verifier checks the actual installed npm bin/shim offline and
the existing SDK flow with22 tools. These are compiled CLI/protocol checks, not
native MCP client or LinkedIn provider validation.

The experimental Docker builder recipe now copies `scripts/build.mjs` instead of
the removed `tsup.config.ts`. A local `docker build --target builder` completed
on the Node 22 slim base image and produced both CLI outputs. This verifies the
builder stage only; it does not establish a working browser or login in Docker.

A fresh source install, source suite, lint, types, generated metadata, build,
exact15-file package, fresh consumer audit, clean/dirty protected-copy package
equality, hosted matrices, dry run and independent review are required at the
frozen head. The actual outcomes and archive hashes are recorded in the PR body
and private exact-head receipt. No version bump, merge or publication is part of
this dependency repair; a combined release candidate needs separate review.
Mandatory maintainer cash remains $0.
