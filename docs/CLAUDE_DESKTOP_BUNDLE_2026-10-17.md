# Claude Desktop local bundle: build and evidence

## October 29: 4.3.0 public-runtime build

The current builder wraps the [independently verified public 4.3.0 core](RELEASE_EVIDENCE_4.3.0.md),
SHA-256 `3896b31a25fe442fa23246dbf5e814dc1b7efde33636d81d72e858603aed20f9`.
It adds the optional evidence-linked interview kit to the existing preparation
flow. The Desktop MCPB local build has SHA-256 `761b8511deed46c2b689bb9574b843df5bc24c3cc427237b0bc8f12fb7b1c650`.
[Local receipt](evidence/release-4.3.0-2026-10-29/wrapper-local-builds.json)
records the stage/unpack, zero-audit, cold 24-tool and new interview checks.

Use `npm run build:claude-mcpb` with a new output path for a current build. The installer
formats remain distinct: MCPB is for manual Claude Desktop extension use;
plugin ZIP is for documented local plugin surfaces. Check the
[4.3.0 Release asset list and distribution notes](https://github.com/devag7/linkedin-mcp/releases/tag/v4.3.0)
for actual public downloads, checksums and final integration status. A local
archive or successful SDK probe alone is not public distribution evidence.

Static Claude Code 2.1.285 manifest validation passes with an isolated config
and blocked network proxy. No plugin load, native 4.3.0 installation, account
read or directory submission was performed. Local Node code runs with the
user's account permissions; review the unsigned-code warning before installing.
The server stores no evidence library or draft; the client controls its copies.

The 4.2.0 and earlier blocks below are historical version-specific evidence and
recipes. They do not establish 4.3.0 native use or upgrade an installed 4.2.0
bundle. Use the current builder/version above for new local builds.


## Current 4.2.0 build and installation

The default builder pins verified public core 4.2.0, archive SHA-256
`cd6ab6df8df54236e953de6a6f8cf7cf095746da5d92fbe1727e7228d2d44b0a`.
Build with `npm run build:claude-mcpb -- /absolute/output/linkedin-mcp-tools-4.2.0.mcpb`.
The local unsigned MCPB SHA-256 is
`d53f67ef5a226b96003baf9b157f8e5efa8449ec65eed1813d911296c6887109`.
Audits, staged/unpacked cold status, 24 tools, input bounds, selected-fact drafts
and unused-fact isolation pass. [4.2.0 evidence](RELEASE_EVIDENCE_4.2.0.md)
separates local, hosted and public asset results.

When both matching files are available in the [4.2.0 release assets](https://github.com/devag7/linkedin-mcp/releases/tag/v4.2.0),
download the MCPB and its `.sha256` companion. On macOS, run
`shasum -a 256 -c linkedin-mcp-tools-4.2.0.mcpb.sha256`; on PowerShell compare
`(Get-FileHash .\linkedin-mcp-tools-4.2.0.mcpb -Algorithm SHA256).Hash`.
Review the unsigned local-code warning before any intentional installation:
Node code runs with the computer user's permissions. Account reads require
separate manual login and scoped consent; local drafts use supplied facts only.
Native 4.2.0 installation/live use and directory acceptance remain unverified.
Explicit `--from-source` mode still labels an unreleased checkout candidate and
never substitutes it for default verified-public mode.

The following 4.1.2/4.1.1/4.1.0 commands, hashes and observations are historical,
not current installation recommendations. Their receipts remain unchanged.

## Historical 4.1.2 build and installation

The current builder targets the verified public `linkedin-mcp-tools@4.1.2`
archive, SHA-256 `6a03ee1a415d064fb573455689e142c5cbec1f140040b66f5674dcab23370947`.
Build with `npm run build:claude-mcpb -- /absolute/output/linkedin-mcp-tools-4.1.2.mcpb`.
The local unsigned bundle hash is
`526b183e36f40139c8a351335859268ca680bd3d309f5980fcc92f3e27d81ba7`.
Production audit and staged/unpacked 24-tool cold status/input-guard checks pass.
Use the [4.1.2 release evidence](RELEASE_EVIDENCE_4.1.2.md) for current asset,
hosted-check and independent public-download status before installing.

When the matching 4.1.2 bundle and checksum are present in the
[release assets](https://github.com/devag7/linkedin-mcp/releases/tag/v4.1.2),
download both into the same folder and check
`shasum -a 256 -c linkedin-mcp-tools-4.1.2.mcpb.sha256` on macOS, or compare
`(Get-FileHash .\linkedin-mcp-tools-4.1.2.mcpb -Algorithm SHA256).Hash` on PowerShell.
Install through Claude Desktop's Extensions advanced settings only after
reviewing its unsigned local-code access warning. Native 4.1.2 installation,
live LinkedIn use and directory acceptance are not established by package checks.
The explicit `--from-source` mode produces a separately labeled unreleased
checkout bundle; it is never interchangeable with verified public-archive mode.

## Historical 4.1.1 build instructions and evidence

The following pins, commands and receipts are historical, not current install
recommendations. Newly reported advisories prevent treating 4.1.1 as security-cleared.

**Historical build target:** published `linkedin-mcp-tools@4.1.1`. The unsigned
4.1.1 bundle and checksum are verified public Release assets; hosted Mac and
Windows packed/unpacked checks passed. The existing public 4.1.0 bundle/native receipt below is historical.
Neither bundle is a Claude directory listing, and neither fills or submits jobs.

Run `npm run build:claude-mcpb -- /absolute/output/linkedin-mcp-tools-4.1.1.mcpb`.
The builder pins public npm archive SHA-256
`3aa33f9a38e2928625f9a7d24d300b644102c87121dc0168766048e1cf7368ec`
and MCPB toolchain 2.1.2. It installs production dependencies only, requires a
zero-finding audit, validates the manifest, and starts the bundled server in a
disposable home. Packed and unpacked startup both require 24 tools, cold
`whoami: not_checked`, rejection of excessive tool inputs by the 10,000-element
guard, and no browser profile creation. No LinkedIn request is part of this build.

The October 21 local 4.1.1 build passed those checks. Its SHA-256 is
`373844201bb51f54b9f69f5373abe974b30287a2b064fe00a3ddc49e6a584b87`;
[redacted local receipt](evidence/release-4.1.1-2026-10-21/claude-bundle-local.json).
Disposable npm installer metadata is excluded and checked absent after unpacking.
This checksum identifies that exact local artifact; other dependency resolutions
or packaging hosts may emit different bundle bytes. CI builds and checks the
pinned runtime on macOS and Windows. No native Claude 4.1.1 install/check has run.

Download the [4.1.1 bundle](https://github.com/devag7/linkedin-mcp/releases/download/v4.1.1/linkedin-mcp-tools-4.1.1.mcpb)
and [checksum](https://github.com/devag7/linkedin-mcp/releases/download/v4.1.1/linkedin-mcp-tools-4.1.1.mcpb.sha256)
into the same folder. On macOS use
`shasum -a 256 -c linkedin-mcp-tools-4.1.1.mcpb.sha256`.
On PowerShell use `(Get-FileHash .\linkedin-mcp-tools-4.1.1.mcpb -Algorithm SHA256).Hash`
and compare with the exact SHA-256 above. Install through Claude Desktop Settings
→ Extensions → Advanced settings → Install extension. Review the unsigned-code
warning; local Node code runs with your computer account's access. The independent
[public receipt](evidence/release-4.1.1-2026-10-21/claude-bundle-public.json) and
[hosted receipt](evidence/release-4.1.1-2026-10-21/claude-bundle-hosted.json) describe
what passed and what remains untested.

On Windows, CI creates its disposable state under the actual user profile with
the repository's private ACL helper. The verifier preserves the operating
system's real `USERPROFILE` so the server's native privacy guard can check it.

The bundle includes the npm package and its dependencies; it does not include
Chrome, a session, profile, credentials or private application data. The user
still needs Chrome and one manual `--login` using the published CLI before live
reads. The bundle is unsigned and runs local Node code with the user's
filesystem access. Verify its checksum before installing it in Claude Desktop.

## Historical 4.1.0 bundle and native receipt

The first local 4.1.0 build on macOS matched the independently fetched public
npm archive byte-for-byte, found zero production audit advisories, validated
the manifest and discovered 24 tools through both packed and unpacked startup.
It returned cold `whoami` without a browser profile or LinkedIn request. After
correcting the manifest author URL to the maintainer's GitHub profile, its
bundle SHA-256 is
`225fcefd270ffb96a1d23b3eff40e100c809ab958d168554d1d3982e331c4428`.
The reviewed [PR #37 CI](https://github.com/devag7/linkedin-mcp/actions/runs/39039351970)
passed all 14 jobs, including actual bundle builds and cold checks on macOS
and Windows. Its native Mac cold check is recorded below.

## Native 4.1.0 result and install

On October 18, the owner authorized the installer's broad local-code warning
and a temporary install on Claude for Mac 2.42304.0. The exact bundle above
showed all requirements met and 24 native tools: 18 read-only and 6
write/delete, each requiring approval by default. A fresh chat called this
extension's cold `whoami` once and returned `sessionState: not_checked`,
`loggedIn: null`. The test extension was then removed; the pre-existing
**LinkedIn MCP Server** extension remained installed. The
[redacted native receipt](evidence/claude-native-4.1.0-2026-10-18.md) records
the bounds and a separately named Claude extension notification.

Download the [bundle](https://github.com/devag7/linkedin-mcp/releases/download/v4.1.0/linkedin-mcp-tools-4.1.0.mcpb)
and [checksum file](https://github.com/devag7/linkedin-mcp/releases/download/v4.1.0/linkedin-mcp-tools-4.1.0.mcpb.sha256)
into the same folder. On macOS, run
`shasum -a 256 -c linkedin-mcp-tools-4.1.0.mcpb.sha256` in that folder.
On Windows PowerShell, run
`(Get-FileHash .\linkedin-mcp-tools-4.1.0.mcpb -Algorithm SHA256).Hash`
and compare it with the SHA-256 above. Then use Claude Desktop Settings →
Extensions → Advanced settings → Install extension. Review the unsigned-code
access warning before installing. This route is a local extension, not a
listed Claude web connector.

## Historical native 4.0.0 result

On October 17, the owner explicitly authorized a temporary installation into
their existing Claude Desktop 2.42304.0 on macOS, including the installer's
broad local-code access warning. The locally built unsigned bundle was pinned
to the independently verified public 4.0.0 archive SHA-256
`4f08eb94eb97cdb2c2baf1a3643651397c83251f017d9bb4331cd511fd885e28`;
the installed candidate's SHA-256 was
`667b46bdb4de0471cf566e11bfdf4ffa1178b1d0ad81fc9bb90450777c0e8e82`.
Claude recognized the extension as **LinkedIn MCP (local)**, showed all
requirements met and discovered 22 tools with default per-tool approval.
In a fresh chat, Claude called only this extension's `whoami` and returned
`sessionState: not_checked`, `loggedIn: null`. The extension was then
uninstalled; the pre-existing, separately named LinkedIn MCP Server extension
remained. No LinkedIn request or manual login occurred. This is native cold
startup evidence for one Mac and one client version, not live-provider or
cross-platform native proof.

Any later live LinkedIn read needs its own scope and consent. This Mac cold
check does not establish native behavior on Windows or other Claude versions.

## Directory paths — updated October 22, 2026

Anthropic's current [connector submission guide](https://claude.com/docs/connectors/building/submission)
says desktop-extension directory listings are deprecated and standalone MCPB
listings are no longer accepted. Local MCP servers must be included in a plugin.
This supersedes the October 17 interest-form discussion; the old form is not a
current verified route. Manual installation of this public MCPB remains a
separate distribution method.

The [local plugin candidate](CLAUDE_PLUGIN_2026-10-22.md) prepares that format;
packaging alone does not prove eligibility. The current
[Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
§3F requires ownership/control of connected resources. Its plugin exception
concerns already-approved Connectors, not a blanket exception for third-party
browser automation. This project does not own LinkedIn's interfaces. Obtain
written clarification or permitted provider access before claiming eligibility
or submitting. No directory submission has occurred.

A local plugin command server loads in Claude Code and local Cowork sessions;
ordinary Claude chat ignores it. Native browser/login compatibility remains
unverified. A remote Connector entry instead needs HTTPS, account authentication
and legitimate provider access. See [plugin support](https://claude.com/docs/plugins/build).

Local builds/distribution need no paid hosting. The directory portal's paid-plan
requirement and any review or provider prerequisites remain separate.
