# Claude 4.4.0 distribution checkpoint — October 30, 2026

[Core 4.4.0 is publicly verified](RELEASE_EVIDENCE_4.4.0.md). Matching wrappers
were built from that exact public archive. Review, hosted integration and public
asset availability remain separate gates. Check the actual
[Release asset list](https://github.com/devag7/linkedin-mcp/releases/tag/v4.4.0).

## Local build evidence

[Local receipt](evidence/release-4.4.0-2026-10-30/wrapper-local-builds.json)
binds all eight proposed builder/template files and both output hashes.

| Asset | SHA-256 |
| --- | --- |
| `linkedin-mcp-tools-4.4.0.mcpb` | `5c5ed372ca8958395da5d8e6703c7cfa961472392602a813f23c587eeea5adb9` |
| `linkedin-mcp-local-4.4.0.zip` | `6690f1e2f7b06cfdb8dbdaf595f1fdc5f78d3370870d702e1a9cecff04bf29e2` |

Both production audits recorded zero findings. Staged/unpacked checks pass cold
whoami, 24-tool discovery, structural input bounds, legacy behavior, selected-fact
drafts/interview and follow-up groups. MCPB retains exact runtime JavaScript and
omits the source map (14 core files); ZIP embeds all 15 core files. Four template
privacy fixtures pass. Claude Code 2.1.285 strict static manifest validation passes
with isolated configuration and blocked proxy; no plugin was loaded.

MCPB is for manual Claude Desktop extension use; ZIP uses documented local plugin
surfaces. Verify downloads against matching .sha256 companions. Unsigned local
Node code runs with the computer user's permissions. No native 4.4.0 installation,
live account check or directory acceptance is established. Older assets remain
unchanged. The timing queue needs an explicit user-selected UTC reference; it
adds no scheduler, storage, provider access or sending. Easy Apply/ATS submission
and remote HTTPS connector eligibility remain open. Cohorts remain 0/0; required
new maintainer service expense remains $0.
