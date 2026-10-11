# LinkedIn MCP 3.1.0 release notes

Version 3.1.0 combines offline client configuration preview, local data
inventory and a patched development build chain. The verified 3.1.0 package is
the version-pinned installation target. [Publication evidence](RELEASE_EVIDENCE_3.1.0.md)
records the exact archive and every destination.

## New local commands

- `--setup <client> --config-file <path>` reads one explicitly chosen JSON/JSONC
  client file and reports whether the generated `linkedin` entry is absent,
  identical, conflicting or invalid. It proposes a reviewed addition only. It
  never writes the file, launches Chrome or contacts LinkedIn. See
  [setup instructions](../SETUP_GUIDE.md#preview-an-existing-client-configuration).
- `--data-inventory` reports fixed categories of local profile and safety state
  without paths or contents. It cannot authorize deletion or verify that owners
  have stopped. See the [privacy contract](PRIVACY.md#inventory-json-contract).

The development build uses a patched direct esbuild API. The CLI remains a
Node 20+ ESM stdio server with the same 22 registered tools and 15-file package
inventory. No write tool, provider route or LinkedIn account flow was added.

## Upgrade and limits

Install the verified 3.1.0 package at
the stable path used for the MCP client. Regenerate the client entry with
`--setup <client>` after upgrading. Existing 3.0.0 configuration continues to
work; the new preview is optional. The inventory is a read-only diagnostic, not
coordinated erasure. Native Windows ACL privacy, native-client first-use,
broader live-provider compatibility and official-provider support remain open.
The experimental job brief in PR #5 is excluded.

Release acceptance requires exact-head CI and dry run, a clean full dependency
audit, independent review, exact artifact verification and readback from npm,
GitHub Packages, MCP Registry and GitHub Release. A dry run does not publish.
