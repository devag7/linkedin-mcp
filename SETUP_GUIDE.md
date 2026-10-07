# Setup and client verification

This guide targets the released 22-tool core **3.0.0**. Publication is independently
verified in [launch evidence](docs/LAUNCH_EVIDENCE_2026-10-07.md). Native-client
first-use cohorts and broader live-provider compatibility remain unverified.
Node 20+ and installed Google Chrome are required. Login requires a local display.
No OAuth/cookie value copied into environment variables activates an official API
provider. There is no dotenv loader; use your shell or your client's env settings.

## Guided offline first run

Install the published package at a stable path, then request the client report.
On macOS/Linux:

```sh
npm install --prefix "$HOME/.local/share/linkedin-mcp" linkedin-mcp-tools@3.0.0
node "$HOME/.local/share/linkedin-mcp/node_modules/linkedin-mcp-tools/dist/index.js" --setup cursor
```

On Windows PowerShell:

```powershell
npm install --prefix "$env:LOCALAPPDATA\linkedin-mcp" linkedin-mcp-tools@3.0.0
node "$env:LOCALAPPDATA\linkedin-mcp\node_modules\linkedin-mcp-tools\dist\index.js" --setup cursor
```

Use `claude-desktop` or `vscode` instead of `cursor` for that client. The JSON
report combines offline diagnosis, configuration and exact login/doctor command
arrays. It never opens Chrome, downloads software, changes a client file or
accesses LinkedIn. Exit1 means a local issue needs attention; login remains
`not_checked`. For only the snippet, replace `--setup cursor` with
`--client-config cursor`. Resolve diagnosis before merging the generated entry.
Run its exact login command yourself when ready; use the same installed bundle
and profile for login and MCP. Native Windows privacy remains unverified.

Source contributors can instead run `npm ci`, `npm run build`, then
`node dist/index.js --setup cursor` from a stable reviewed checkout.

The generated entry uses the absolute Node executable and this installed build,
sets the same profile for login and MCP, forces stdio and disables writes. Merge
only its `linkedin` entry into your existing configuration; preserve other servers.
Keep the installation at a stable path outside temporary caches/iCloud. Regenerate
when Node/package paths change or after an upgrade. Do not share local path details
in public issue reports. No cookie or token is exported.

Claude Desktop/Cursor exports use `mcpServers`; VS Code exports target native
`.vscode/mcp.json` with `servers`. VS Code's newer portable `.mcp.json` format is
also supported by the client but is not the selected export format. The generated
commands are arrays, so paths with spaces require no shell-escaping guesses.

`npm run verify:setup` tests all three generated entries with a real SDK client and
an offline stop fixture. The installed tarball test repeats it. VS Code 1.139.1 also accepted the native export, launched it and discovered 22 tools on the earlier setup-only build in a disposable stopped profile. Claude/Cursor UI acceptance, full chat flows and authorized live first reads remain separate evidence gates.
See the [execution plan](docs/PRODUCT_EXECUTION_PLAN_2026.md) for current proposals,
maintenance/cash estimates and distribution measures.

```bash
npm ci
npm run build
node dist/index.js --doctor
```

Doctor performs local checks without opening Chrome or contacting LinkedIn. Repair
a reported package/Chrome/permission/state issue first. The normal server keeps
Chrome headless; `--login` opens a visible window for manual authentication.
After deliberate login, `--doctor --live` or `health_check` performs a live identity
read. A cold `whoami` correctly reports `not_checked`; it does not validate a cookie.

```bash
node dist/index.js --login
node dist/index.js --doctor --live
```

Stop other owners of this profile first. One runtime owns it, including during
idle/close_session. Resolve checkpoint stops manually using the documented
[recovery](README.md#recovering-from-a-checkpoint); do not delete safety history.
Metered reads observe daily/monthly budgets and paced working hours, so a queued
call may wait. HTTP is local-only and requires bearer authentication; see README.

## Client matrix

| Client/surface | Configuration | Evidence in this session |
| --- | --- | --- |
| SDK stdio client | Node + absolute built binary | Executed from source and fresh installed tarball; no LinkedIn calls |
| SDK loopback HTTP client | 127.0.0.1 URL + bearer header | Local protocol/security tests |
| Claude Desktop / Cursor compatible JSON config | Example below | Configuration example; application UI/first read untested |
| Other MCP clients | Use their documented stdio settings | No compatibility claim until a client/OS/version record exists |

For a client accepting `mcpServers`, use an absolute path to the built file:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["/absolute/path/to/linkedin-mcp/dist/index.js"]
    }
  }
}
```

[claude-desktop-config.json](claude-desktop-config.json) pins the current declared
npm version as a reference. Its contents follow package.json; publication receipts
are independently recorded in launch evidence. This guide does not guess settings formats for
untested applications. [First-use protocol](docs/FIRST_USE_VALIDATION.md) records
client/OS/version and real completion evidence before adding a verified entry.

Writes are disabled by default. If an account owner deliberately enables alpha
writes, put LINKEDIN_ENABLE_WRITES=true in that client's env, review a local
preview, obtain explicit human approval, then submit identical inputs with its operation ID and `preview_token` within five minutes. No bulk send
example is provided. New message threads require separate experimental opt-in.

Docker is experimental: a Debian/Chrome recipe and stdio compose example are
included, but no container build, GUI login, profile portability or container
runtime has been verified. A persistent browser cannot be a stateless/serverless
service. Do not expose container HTTP ports; the listener binds only to loopback.

## Local browser lifecycle evidence

On 2026-10-01, the source-only `npm run verify:browser` check passed on macOS /
Node22.14.0 / Chrome154 with an empty temporary profile, synthetic local content,
observed process cleanup and released ownership. This is a browser lifecycle
check, not a LinkedIn first read or client-application certification. See the
[zero-cash execution record](docs/ZERO_COST_EXECUTION_EVIDENCE_2026-10-01.md).

If `--setup` reports `profile: invalid`, it returns JSON with
`status: needs_attention`, `configuration: null` and `commands: null`. Repair the
selected `LINKEDIN_PROFILE_DIR`, including broken symlink/junction targets or parent
aliases, before regenerating configuration. Stop owners first and preserve safety
history. This diagnosis does not open Chrome, repair the path or access LinkedIn.

## Migrating from 2.0.3 to 3.0.0

3.0.0 is a major version because existing write and HTTP clients must change.
Read tools remain available, but consumers must handle contract metadata and
partial/empty/error states instead of assuming successful arrays are complete.

1. Stop every server and associated Chrome process using the profile/shared
   budget file. Back up the profile and external circuit/budget/journal files in
   a private directory outside synchronization; do not upload these credentials.
2. Install a verified 3.0.0 artifact at a stable path, regenerate `--setup` or
   `--client-config`, and merge only its entry into the existing client config.
   Node 20/22 and Chrome lifecycle are tested offline on Linux/macOS/Windows;
   this does not certify live LinkedIn or native desktop chat on those platforms.
3. Start in default read-only mode. Writes now require deliberate runtime opt-in,
   then a local preview with `confirm:false`, explicit human approval of its exact
   action/target/content, and an identical new submission with `confirm:true`,
   returned `operation_id` and five-minute `preview_token`. The server verifies
   its preview proof, not the human's consent. Old `confirm:true` calls alone fail.
4. Keep the same operation ID and inputs for lookup of prior journaled outcomes,
   including after timeout/restart/expired tokens. Never automatically resend an
   `unknown` result or reset state to recover a checkpoint.
5. HTTP is restricted to loopback and requires `LINKEDIN_HTTP_TOKEN` plus a bearer
   header. Remote unauthenticated deployment and shared cloud profiles are not
   supported migration paths. Prefer local stdio; generated configs force it.
6. `whoami` is local and reports a cold session as `not_checked`. `health_check`,
   `--doctor --live` and research reads can access the account; authorize those
   separately. Offline diagnosis and fixture demos never prove authentication.
7. State schema 1 retains counters and journal IDs; warmup uses verified local
   first use, not guessed account age. Unknown/corrupt state fails closed. Old
   versions that strip new fields must not share this state. A downgrade needs a
   stopped runtime and separately preserved compatible state, not cap deletion.
8. Logout refuses symlink/junction/ancestor aliases. A custom profile requires
   explicit deletion confirmation; external safety files remain. Coordinated
   erasure tooling and NTFS ACL enforcement are still open: verify Windows
   native directory privacy before any account use and do not infer it from CI.

Pagination emits a continuation only when returned start/count/total agree with
observed rows. Contradictory zero/short pages remain partial with no next cursor.
Job details must identify the requested numeric job URN before a canonical URL is
attached. Official OAuth remains unavailable; v1 cookie/OAuth
environment variables do not enable it. New-thread messaging remains experimental.
