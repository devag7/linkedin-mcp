# Published 3.0.0 volunteer kit

Prepared October 7, 2026. **No recruitment, participants or live test yet.**
This is a local, unofficial LinkedIn integration; account restrictions are possible.
There is no ban-proof setting. Use your own judgment and preferably a secondary
account. You can stop at any point. Do not buy a subscription for this study.

## Before starting — choose and consent

Choose **one** client: Claude Desktop, Cursor or VS Code. Use an already available
free client/model allowance or your own existing entitlement. If access is unavailable,
record that failure after a started attempt; do not purchase credits or hide it.
No maintainer service, API key, hosting, survey subscription or screen recording is required.
Client/model providers may process tool results under their own settings and terms.
Never send the coordinator your password, cookies, profile directory or returned profile.

The participant answers these separately, locally, before the timer starts:

- I consent to installing/configuring published `linkedin-mcp-tools@3.0.0` on my
  device and manually signing into my own LinkedIn account. Yes / No.
- I consent to **one** `get_my_profile` call after login, with at most **nine
  explicit Voyager GET attempts in the whole attempt**, including login verification
  and runtime identity checks. No health probe, retries, extra reads or writes.
  Ordinary Chrome navigation and background traffic may also occur. Yes / No.
- I consent to an anonymous started/success/failure tally, including if I stop or
  decline the read after starting. Published aggregates cannot identify my attempt
  and cannot be linked back for removal once irreversibly aggregated. Yes / No.
- I optionally consent to the minimal pseudonymous timing/status row described in
  [the results guide](FIRST_USE_RESULTS.md), retained until this chosen deletion
  date: ______. Default: delete within 30 days. Yes / No.
- I optionally consent to a repeat-use follow-up through a channel I arrange
  myself. No contact details go in the results file. Yes / No.

Do not begin a measured live attempt without the first three approvals. Declining
the private row or follow-up does not disqualify an otherwise started attempt.
An offline-only practice is separate and never counted as live first use.
This kit is a future participant authorization request, not permission for the
maintainer or an agent to operate any account now.

## Your short walkthrough

1. Start the timer **before** checking prerequisites or installing. Use Node20+
   and Google Chrome; use a stable installation outside temporary caches and
   synchronized folders. Follow the pinned install in [SETUP_GUIDE](../SETUP_GUIDE.md).
   On macOS/Linux:

   ```sh
   npm install --prefix "$HOME/.local/share/linkedin-mcp" linkedin-mcp-tools@3.0.0
   node "$HOME/.local/share/linkedin-mcp/node_modules/linkedin-mcp-tools/dist/index.js" --setup claude-desktop
   ```

   Substitute `cursor` or `vscode` for your chosen client. Windows commands are in
   the setup guide; native Windows privacy proof remains open. Do not use the
   source checkout, `latest`, PR #5 or a job brief for this cohort.
2. Resolve the offline diagnosis. Use the exact Node/bundle/profile from its
   command arrays. Merge only the generated `linkedin` entry, preserving other
   servers. Claude uses its Desktop developer config, Cursor uses
   `~/.cursor/mcp.json` or `.cursor/mcp.json`, VS Code uses `.vscode/mcp.json`.
   Restart the client if needed. Keep writes and experimental messages disabled.
   Start/discover the server and call **cold `whoami` only**; `not_checked` is expected.
   On VS Code1.140.0 a Start click before a chat runtime exists was refused; see
   [the offline client evidence](FIRST_USE_READINESS_2026-10-07.md). Do not mistake
   that error for expired LinkedIn credentials or repeatedly launch/login.
3. Stop the MCP server before running the report's exact `commands.login` yourself.
   This opens Chrome and verifies login with one `/me` GET. A checkpoint ends this
   study attempt: cancel/close rather than completing the challenge and continuing
   automation. Do not invoke `--spike`, `--doctor --live`, capture utilities or a
   second login. No session, profile or safety file is uploaded to the coordinator.
4. Restart that same installed MCP build. Once ready, tell your client:

   > Call get_my_profile exactly once. Show its returned status, source and partial
   > metadata and the profile to me. Do not call health_check, another read, a write,
   > retry or any other provider tool. Then call close_session. Stop on any checkpoint,
   > authentication, budget, timeout or changed-shape error.

   Confirm locally whether the name and headline are yours and useful. Record only
   yes/no plus status/partial, never those values. A source-linked useful partial
   profile can pass first use; it does not prove all sections are complete.
5. At 15 minutes stop active work and close the session/server. Record the result
   even on failure, cancellation, missing prerequisites or client access limits.
   A read already in flight may finish later; record eventual completion separately
   without making another call or resetting the timer. Stop all owned Chrome/server
   processes after `close_session`; idle close alone retains profile ownership.

The nine-attempt envelope comes from the reviewed source: login `/me`1, runtime
binding `/me`1, then tool `/me`1 + profile core1 + five section GETs. Sections can
already be in flight together when an error arrives; cancellation cannot undo them.
This is a source-derived bound for an uninterrupted session, **not a runtime
request limiter**. If the client cannot restrict calls or the browser restarts,
stop; do not assert that the ceiling was enforced. Mark request count `unknown`
unless observed without retaining request bodies/URLs. A future client runner with
an enforced limiter is separate work; do not weaken the server's safety controls.

## Afterward

Only share the allowed timing/status fields or an anonymous aggregate with the
coordinator. No screenshots, screen share or raw logs are needed. Stop all processes
before changing configuration. Remove only the entry you added. Your Chrome session
and external safety history remain locally retained; `close_session` is not erasure.
`--logout` removes the profile only and is an optional separate deletion decision.
Read [privacy/deletion limitations](PRIVACY.md) before retiring data; coordinated
erasure and native Windows ACL proof are not complete. Never delete safety history
to clear a checkpoint or reset allowances.

Optional repeat use: report voluntarily whether you used the tool in two distinct
weeks within28 days, and a broad failure category. No background tracker is used.
Contact and retention choices belong to you. Do not post private rows in GitHub.

Current client instructions are checked against
[Claude's developer connection guidance](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop),
[Cursor's MCP configuration](https://cursor.com/docs/mcp) and
[VS Code's MCP configuration](https://code.visualstudio.com/docs/agent-customization/mcp-servers).
These describe client mechanisms, not a verified live LinkedIn flow or free model
availability on every account.
