# Claude Desktop 4.1.0 native cold check

**Date:** October 18, 2026. **Client:** Claude for Mac 2.42304.0
(`e7f60e`). **Scope:** one temporary install of the unsigned local bundle,
24-tool discovery, one cold `whoami`, and removal. The owner explicitly
authorized the installer's warning that this local Node extension can access
everything their macOS user can access.

The selected bundle was `linkedin-mcp-tools-4.1.0.mcpb`, SHA-256
`225fcefd270ffb96a1d23b3eff40e100c809ab958d168554d1d3982e331c4428`.
Its build pins the independently verified public npm 4.1.0 archive. Before
installation, Claude showed no running task. The installer identified
**LinkedIn MCP (local)** version 4.1.0 and reported all requirements met.
Claude's configuration showed 18 read-only and 6 write/delete tools, all
defaulting to **Needs approval**.

In a fresh Claude chat, the selected **LinkedIn MCP (local)** extension's
`whoami` was called once. It returned `sessionState: not_checked` and
`loggedIn: null`. No `health_check`, login, profile read, other MCP tool,
LinkedIn request, or retry was part of this check. The test extension was
uninstalled through Claude's UI, and the installed-extension list then
showed the pre-existing, separately named **LinkedIn MCP Server** but no
**LinkedIn MCP (local)**.

An `MCP indian-options` disconnection notification appeared in
Claude during the test. Its cause and relationship to this install were not
established; this receipt does not claim that other extensions were unaffected.

The same exact bundle and adjacent checksum are attached to the existing
[v4.1.0 GitHub Release](https://github.com/devag7/linkedin-mcp/releases/tag/v4.1.0).
A fresh download of both assets passed the checksum file and byte comparison
against the frozen bundle. An unauthenticated download of the public bundle
URL also returned the same SHA-256. The release tag and npm package were not
changed.

This proves one native Mac cold start and tool discovery. It does not prove a
live LinkedIn read, fresh-user setup, other client/OS combinations, Claude
directory acceptance, or application submission. The 4.1.0 first-use cohort
remains 0/0 and unmeasured.
