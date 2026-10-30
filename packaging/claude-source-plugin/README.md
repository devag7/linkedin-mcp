# LinkedIn MCP source installation (unofficial)

This is a self-contained Claude Code plugin source folder, distinct from the
bundled ZIP template at `packaging/claude-plugin`. It contains a skill and an
exact-version npm launcher; no prebuilt `node_modules` directory is required.
Its plugin version is 1.0.0; the launched server version is **4.4.0** with 24 tools.
This is a custom community marketplace, not an Anthropic directory listing,
an approved LinkedIn integration or a remote HTTPS connector.

## Deliberate installation in Claude Code

Review these files before running local code. Node 20+ and npm/npx must be on
your client's PATH. With an existing Claude Code installation:

```text
/plugin marketplace add devag7/linkedin-mcp
/plugin install linkedin-mcp-source@devag7-linkedin-tools
```

These commands change your Claude configuration; they are instructions for a
deliberate user action, not something the build or tests perform. The catalog
tracks this repository's default branch. The npm server remains pinned to
4.4.0, never `latest`. Do not enable this alongside another LinkedIn MCP config,
MCPB or ZIP plugin: choose one installation to avoid duplicate tools/sessions.
To remove it deliberately, use `/plugin uninstall linkedin-mcp-source@devag7-linkedin-tools`.
Marketplace registration and npm's cache have separate lifecycles; uninstalling
this plugin does not erase browser profiles, client conversations or npm caches.

The first launch downloads the named public npm package and its dependencies
from registry.npmjs.org into npm's local cache. Later launches follow npm's cache
behavior; offline availability is not guaranteed. The package version is fixed,
but compatible transitive dependency resolutions are not frozen by this source
plugin. This differs from a reviewed ZIP's bundled dependency tree. No install
hook, auto-login, script download, custom registry file or hidden updater is added.
Package code and dependency install scripts run with your computer account's
permissions. Normal npm installation can execute dependency lifecycle scripts.

## Use and privacy

Cold `whoami` and the two application preparation/export tools can work without
LinkedIn login. Preparation uses only deliberately supplied facts, with no
server-owned evidence library or tracker storage. Client conversations and saved
exports have separate retention. No forms are filled, resumes uploaded, jobs
submitted or messages sent by this skill. The runtime's five write tools remain
registered but disabled by this configuration, including when the parent
environment requested writes. Do not change those settings as part of setup.

Google Chrome and a separately authorized manual login are needed only for
account reads. This plugin neither logs in nor grants permission to read an
account. `health_check` is live; use cold `whoami` for offline diagnosis. Stop at
checkpoints and uncertain cleanup. Never share cookies or an authenticated profile.

No native installation or directory acceptance is established by a static
validator or an SDK launch check. The source launcher is separately validated;
those checks do not establish native Claude Code, Cowork or Desktop behavior.
Use the separate MCPB for manual Desktop extension installation. Current
[directory research](https://github.com/devag7/linkedin-mcp/blob/main/docs/CLAUDE_DIRECTORY_RESEARCH_2026-10-27.md)
records unresolved provider/interface permission and review requirements. Exact
registry launchers are still held for directory review; do not advertise this
catalog as official approval. Local distribution needs no maintainer hosting or
paid service; users supply their existing client access, hardware, Node and Chrome.

[Privacy](https://github.com/devag7/linkedin-mcp/blob/main/docs/PRIVACY.md) and
[support](https://github.com/devag7/linkedin-mcp/issues): keep credentials, account
content, paths, logs and application records out of public issues. The runtime
can store browser/session and shared safety state after separately authorized
account use; plugin uninstall does not perform coordinated erasure.

## Maintainer checks

Run `node --test scripts/claude-source-plugin.test.mjs` from the repository for
structural refusals. `npm exec -- node scripts/verify-claude-source-plugin.mjs`
uses disposable npm storage, launches the declared command through an SDK client,
checks cold/local tools and write overrides, compares runtime JavaScript to the
verified public 4.4.0 file, and requires a zero-finding fresh production audit.
On Windows this runtime verifier refuses local/self-hosted execution: the
public runtime needs the real Windows home for native privacy checks, so its
shared safety-state reads cannot be redirected into the verifier scratch folder.
Use only a fresh GitHub-hosted Windows runner for that check; do not simulate CI
variables to bypass this refusal. Static validation remains available locally.
It does not register or install a plugin in Claude. npm network installation is
separate from its cold/local MCP checks. Normal user launches do not rerun this
audit or freeze transitive dependencies. Static validation, SDK execution and
real native-client use remain distinct results.
