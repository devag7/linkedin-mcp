# Claude Desktop local bundle: build and evidence

**Current build target:** published `linkedin-mcp-tools@4.1.1`. The unsigned
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

## Directory paths

As checked October 17, Anthropic's
[connector submission guide](https://claude.com/docs/connectors/building/submission)
says a standalone local MCPB cannot be submitted through the remote connector
portal; it suggests a plugin. Its
[Desktop extension help](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
also links a separate [Desktop extension interest form](https://clau.de/desktop-extention-submission).
The accessible form asks for a public GitHub repository, a `.mcpb` upload,
contact details, a first-party confirmation and agreement to directory terms.
The truthful first-party answer for this project is **No**; Anthropic says the
form indicates interest and does not guarantee inclusion. The form and remote
portal are distinct routes, and the documentation is not fully aligned.
More importantly, the current [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
requires developers to verify they own or control any API endpoint, domain or
interface their software connects to. The [terms](https://support.claude.com/en/articles/13145338-anthropic-software-directory-terms)
require a representation that the submission satisfies that policy. This
unofficial browser extension connects to LinkedIn's interface, which the
maintainer does not own or control. Do not submit the form or claim directory
eligibility without written clarification or a permitted provider agreement.
Local GitHub distribution is available from the exact release assets.
A local plugin can run in Cowork and Claude
Code, while ordinary Claude chat does not start a plugin's local MCP server;
[Anthropic's plugin support table](https://claude.com/docs/plugins/build)
defines the surfaces. A remote Connector Directory entry requires public HTTPS,
account authentication and legitimate permission to proxy the underlying
service. This local browser architecture does not meet that remote gate.

No hosting charge is required to build or run this local bundle. Claude plan
requirements and any future directory review are external prerequisites.
