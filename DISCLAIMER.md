# Unofficial integration and account risk

LinkedIn MCP uses a local authenticated Chrome session and undocumented Voyager
endpoints or visible page data. It is not affiliated with or endorsed by LinkedIn.
Endpoints, query IDs, response shapes and challenges can change without notice.
Local tests establish their tested cases; current live compatibility is unknown.

Review the [LinkedIn User Agreement](https://www.linkedin.com/legal/user-agreement)
and [prohibited software guidance](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions)
before deciding whether this integration is appropriate. Automation can result in
restrictions. Caps, pacing, warmup and persisted stops cannot guarantee access or
compliance. Do not create fake accounts or bypass checkpoints to use this tool.

Writes are alpha, disabled by default, and require a deliberate runtime opt-in and
explicit approval for the exact action. Preview the target/content first. An
unknown outcome requires manual inspection; repeating the same operation ID is a
lookup, not a retry. New message threads have a separate experimental opt-in.

Chrome credentials remain in a local private profile. Returned LinkedIn data is
sent to the MCP client you choose; that client's storage and model/service policies
apply. No telemetry is added here. See [privacy and retention](docs/PRIVACY.md).
Manual capture/probe utilities can display personal content and must never be
included unreviewed in public issues or fixtures.

The MIT license supplies the warranty terms. Use does not grant any platform or
personal-data permissions. Review applicable requirements for your intended use.
