# Claude Desktop local bundle: build and evidence

**Scope:** local `.mcpb` distribution of published `linkedin-mcp-tools@4.0.0`.
This is a packaging candidate, not a directory listing or a native-client
acceptance result. It does not contain PR #32 or the draft application worksheet.

Run `npm run build:claude-mcpb -- /absolute/output/linkedin-mcp-tools-4.0.0.mcpb`.
The build pins the public npm archive SHA-256
`4f08eb94eb97cdb2c2baf1a3643651397c83251f017d9bb4331cd511fd885e28`
and the official MCPB toolchain version 2.1.2. It installs production
dependencies only, requires a zero-finding production audit, validates the
manifest, and starts the bundled MCP server through its actual entry point in a
disposable home. Cold discovery must return 22 tools and `whoami` must report
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

To check native behavior, use an isolated Claude Desktop environment rather
than changing an existing account's settings. Install the `.mcpb` through
Settings → Extensions → Advanced settings → Install Extension, inspect its
manifest and permissions, then verify connection, tool discovery, cold
`whoami`, and clean removal. Record client version, OS and outcome without
profile content. A successful SDK stdio test does not establish this native
flow. Any live LinkedIn read needs its own scope and consent.

## Directory paths

As checked October 17, Anthropic's
[connector submission guide](https://claude.com/docs/connectors/building/submission)
says a standalone local MCPB cannot be submitted through the remote connector
portal; it suggests a plugin. Its
[Desktop extension help](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
also links a separate Desktop extension submission form. These are distinct
routes and the documentation is not fully aligned. The bundle should be tested
natively before attempting either. A local plugin can run in Cowork and Claude
Code, while ordinary Claude chat does not start a plugin's local MCP server;
[Anthropic's plugin support table](https://claude.com/docs/plugins/build)
defines the surfaces. A remote Connector Directory entry requires public HTTPS,
account authentication and legitimate permission to proxy the underlying
service. This local browser architecture does not meet that remote gate.

No hosting charge is required to build or run this local bundle. Claude plan
requirements and any future directory review are external prerequisites.
