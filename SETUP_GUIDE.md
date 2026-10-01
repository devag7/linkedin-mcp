# Setup and client verification

These source changes are unreleased on the v2.0.3 baseline. Use the built source
or a locally packed artifact to test them; `@latest` may contain different code.
Node 20+ and installed Google Chrome are required. Login requires a local display.
No OAuth/cookie value copied into environment variables activates an official API
provider. There is no dotenv loader; use your shell or your client's env settings.

## Guided offline first run (review build)

Build this checkout, then run `node dist/index.js --setup cursor` (or
`claude-desktop` / `vscode`). The JSON report combines offline diagnosis, your
selected client configuration, and exact login/doctor command arrays. It never
opens Chrome, downloads software, changes a client file or accesses LinkedIn.
Exit 1 means a local issue needs attention; login status stays `not_checked`.
For just the JSON snippet, use `node dist/index.js --client-config cursor`.

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
an offline stop fixture. The installed tarball test repeats it. VS Code 1.139.1 also accepted the native export, launched it and discovered all22 tools in a disposable stopped profile. Claude/Cursor UI acceptance, full chat flows and authorized live first reads remain separate evidence gates.
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
npm version as a reference for published-package usage. It is not evidence that
this local work has been released. This guide does not guess settings formats for
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
