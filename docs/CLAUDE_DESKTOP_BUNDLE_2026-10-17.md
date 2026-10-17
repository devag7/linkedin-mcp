# Claude Desktop local bundle: build and evidence

**Scope:** local `.mcpb` distribution of `linkedin-mcp-tools@4.1.0` after
independent public archive verification. This is a packaging candidate, not a
directory listing. It includes the offline worksheet and CSV tracker, but no
job application fill or submit action.

Run `npm run build:claude-mcpb -- /absolute/output/linkedin-mcp-tools-4.1.0.mcpb`.
The build pins the public npm archive SHA-256
`477c0cbfffe1901c9dea926dd8b9b4be6c9ff223154ff111854be949e798d8f9`
and the official MCPB toolchain version 2.1.2. It installs production
dependencies only, requires a zero-finding production audit, validates the
manifest, and starts the bundled MCP server through its actual entry point in a
disposable home. Cold discovery must return 24 tools and `whoami` must report
`not_checked` without creating a Chrome profile. It then emits the bundle and
its SHA-256. The builder unpacks the resulting `.mcpb` and repeats the cold
startup/discovery check against the unpacked bytes. No LinkedIn request is part
of the build. CI also runs that exact build on macOS and Windows with Node 22;
the local result alone is not cross-platform proof.

On Windows, CI creates its disposable state under the actual user profile with
the repository's private ACL helper. The verifier preserves the operating
system's real `USERPROFILE` so the server's native privacy guard can check it.

The bundle includes the npm package and its dependencies; it does not include
Chrome, a session, profile, credentials or private application data. The user
still needs Chrome and one manual `--login` using the published CLI before live
reads. The bundle is unsigned and is not posted as a GitHub Release asset.

The first local 4.1.0 build on macOS matched the independently fetched public
npm archive byte-for-byte, found zero production audit advisories, validated
the manifest and discovered 24 tools through both packed and unpacked startup.
It returned cold `whoami` without a browser profile or LinkedIn request. After
correcting the manifest author URL to the maintainer's GitHub profile, its
bundle SHA-256 is
`225fcefd270ffb96a1d23b3eff40e100c809ab958d168554d1d3982e331c4428`.
Hosted Mac/Windows bundle checks and native 4.1.0 Claude Desktop behavior
remain separate gates.

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

The 4.1.0 bundle has not yet been installed in Claude Desktop. Its native
discovery and cold status must be checked separately after the public archive
and exact bundle bytes are verified.

For another native check, install the `.mcpb` through Settings → Extensions →
Advanced settings → Install Extension, inspect its manifest and permissions,
then verify connection, tool discovery, cold `whoami`, and clean removal.
Record client version, OS and outcome without profile content. Any live
LinkedIn read needs its own scope and consent.

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
Local GitHub distribution remains possible after exact bundle and native checks.
A local plugin can run in Cowork and Claude
Code, while ordinary Claude chat does not start a plugin's local MCP server;
[Anthropic's plugin support table](https://claude.com/docs/plugins/build)
defines the surfaces. A remote Connector Directory entry requires public HTTPS,
account authentication and legitimate permission to proxy the underlying
service. This local browser architecture does not meet that remote gate.

No hosting charge is required to build or run this local bundle. Claude plan
requirements and any future directory review are external prerequisites.
