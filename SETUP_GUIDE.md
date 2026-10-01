# Setup and client verification

These source changes are unreleased on the v2.0.3 baseline. Use the built source
or a locally packed artifact to test them; `@latest` may contain different code.
Node 20+ and installed Google Chrome are required. Login requires a local display.
No OAuth/cookie value copied into environment variables activates an official API
provider. There is no dotenv loader; use your shell or your client's env settings.

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
preview, then approve the identical target/content/operation ID/hash. No bulk send
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
