# LinkedIn MCP local Desktop extension

This extension packages the independently published `linkedin-mcp-tools@4.1.2`
archive and its production dependencies for Claude Desktop. It starts a local
MCP server. It does not include a logged-in browser profile, credentials or
application data. Install Chrome, then run the one-time manual login documented
in the [setup guide](https://github.com/devag7/linkedin-mcp/blob/main/SETUP_GUIDE.md)
before asking Claude for account reads. LinkedIn can change or restrict the
unofficial provider; no current live compatibility is guaranteed. Browser writes
remain disabled by default and always require a separate reviewed preview and
human approval. This extension does not fill or submit job applications.
It includes an offline worksheet and CSV export for user-entered application
statuses; neither tool checks whether a job application was submitted.

## Privacy Policy

All browser session data stays in the user's local profile unless the user or
their MCP client shares a tool result. LinkedIn receives requests only when a
live tool or manual login runs. The server has no maintainer-operated cloud
storage or telemetry. Local profile, safety-state, retention and deletion
details are in the [project privacy policy](https://github.com/devag7/linkedin-mcp/blob/main/docs/PRIVACY.md).
LinkedIn's [privacy policy](https://www.linkedin.com/legal/privacy-policy)
applies to use of its service. For support, use the
[issue tracker](https://github.com/devag7/linkedin-mcp/issues) without uploading
cookies, profile files, private results or credentials.
