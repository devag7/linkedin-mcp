# LinkedIn MCP local Desktop extension

This extension packages the independently published `linkedin-mcp-tools@4.4.0`
archive and its production dependencies for Claude Desktop. It starts a local
MCP server. It does not include a logged-in browser profile, credentials or
application data. Install Chrome, then run the one-time manual login documented
in the [setup guide](https://github.com/devag7/linkedin-mcp/blob/main/SETUP_GUIDE.md)
before asking Claude for account reads. LinkedIn can change or restrict the
unofficial provider; no current live compatibility is guaranteed. Browser writes
remain disabled by default and always require a separate reviewed preview and
human approval. This extension does not fill or submit job applications.
The offline preparation tool can reuse evidence explicitly selected by the user
and return deterministic resume bullets and a cover-letter draft when requested.
Inspect the tool's supported input schema before sending optional library,
reference or draft fields. Facts and source labels remain user-supplied and
unverified; labels are not files or URLs to open. Exact selected evidence stays
in structured lineage; draft display text is quoted and control-escaped. Missing
facts remain gaps. No evidence library or tracker is saved by the server. CSV
export formats user-entered statuses and does not verify submission.

This is unsigned local Node code running with your computer account's permissions.
Inspect the archive and checksum before allowing it to run. Offline package
checks do not establish native-client, live-provider or directory acceptance.

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

## Offline interview kit

The pinned 4.4.0 runtime supports `include_interview_prep:true` on
`prepare_job_application`, independently of resume/cover-letter drafts. Practice
questions reference only selected evidence; unknown answers and STAR fields stay
blank. A follow-up template requires truthful human completion after verifying
the real interview and recipient. No message, application, provider request or
server-owned record is created. Inspect the advertised schema and returned kit;
4.2.0 bundles do not upgrade themselves. Native 4.4.0 use remains untested.

## Optional follow-up timing

The 4.4.0 runtime supports `include_follow_up_plan:true` with an explicit UTC
`as_of` on `export_application_tracker`. The returned index groups refer to
unchanged records/CSV; rejected and withdrawn records stay closed. Missing
actions stay blank. Nothing is stored, scheduled or sent. Inspect the installed
schema; older 4.3.0 packages do not acquire this option automatically. Native
4.4.0 usefulness remains unmeasured.
