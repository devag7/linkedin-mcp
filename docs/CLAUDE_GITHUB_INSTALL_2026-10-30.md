# GitHub source plugin installation — October 30, 2026

Status: source candidate, separate from public 4.4.0 core and its existing MCPB/ZIP.
The install commands become available from the default branch only after this
change is reviewed and merged. No native plugin installation is performed here.

## Product requirement and implementation

A user should be able to select a GitHub-hosted plugin without first building or
unpacking a ZIP. The existing `packaging/claude-plugin` remains a ZIP template
whose runtime is supplied by its builder. A new self-contained source folder at
`packaging/claude-source-plugin` instead declares the exact public npm package
`linkedin-mcp-tools@4.4.0`. Root `.claude-plugin/marketplace.json` exposes only this
new folder as `linkedin-mcp-source@devag7-linkedin-tools`.

The source plugin has its own version 1.0.0. It uses the reviewed preparation
skill, overrides both write flags to false and never logs in automatically. Its
launcher explicitly uses the public npm registry. There is no hook or secondary
bootstrap script, vendored dependency tree, package-source configuration file,
extra server tool or modification of the 15-file public core.

First launch needs npm network access and can run normal dependency lifecycle
scripts with the user's account permissions. npm owns its cache. Pinning the core
version does not freeze compatible transitive dependencies or guarantee a later
offline launch. The source route differs from the existing reviewed ZIP's bundled
dependency tree. Use one installation at a time to avoid duplicate sessions.
Read the [source README](../packaging/claude-source-plugin/README.md) before
intentionally changing Claude configuration. Uninstall does not erase npm caches,
browser profiles, conversations or shared safety state.

## Current official documentation

- [Claude Code marketplace documentation](https://code.claude.com/docs/en/plugin-marketplaces)
  documents a root catalog with relative plugin folders and explicit user add/install commands.
- [Manifest reference](https://code.claude.com/docs/en/plugins-reference) distinguishes
  strict static validation from loading a native client.
- [Directory pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist)
  requires exact package launcher versions and still holds registry launchers for
  review because dependencies resolve during installation. A custom catalog does
  not establish official directory approval. These sources were checked October 30.

Provider/interface permission, directory eligibility and actual client workflows
remain open under the [directory research](CLAUDE_DIRECTORY_RESEARCH_2026-10-27.md).
No directory portal, account connection, submission, purchase or remote hosting is
part of this source work. No runtime/provider permission is inferred from installability.

## Verification and acceptance

Structural fixtures reject latest/ranged changes, alternate registries, write
opt-in, catalog path escape, unexpected private files, symlinks and a changed
consent skill. Static plugin/catalog checks use an isolated Claude configuration
and blocked proxy; no add/install command is executed.

A separate launcher verifier starts the exact declared command through the MCP
SDK in disposable storage. npm downloads packages; MCP calls remain cold/local:
24-tool discovery, version/cold identity, five disabled write capabilities,
synthetic worksheet and tracker timing. It checks the launched JavaScript against
the independently verified public 4.4.0 runtime hash and audits the fresh npm-cache
installation, requiring zero production findings at verification time. This is
not an audit on every end-user launch. The check deliberately requests writes in
its parent environment and proves the plugin's false overrides win. Chrome is
unavailable and the synthetic profile must remain absent; the client is closed
and temporary storage is removed. This is SDK source-launcher evidence, not
native Code/Cowork/Desktop, LinkedIn compatibility or general process-ownership proof.
Mac and Windows hosted launcher checks are required before merging this source
route. Exact-head review and checks are separate from a local pass.

The first local worksheet fixture incorrectly supplied an array to a string
field; the fixture was corrected. The first strict catalog pass warned that a
description was missing; a description was added. Those initial results remain in
private evidence rather than being counted as passing native/provider attempts.
Required new maintainer service expense remains $0. First-use cohorts remain 0/0.
