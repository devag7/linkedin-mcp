<div align="center">

# 🔗 LinkedIn MCP

### LinkedIn for AI assistants — structured data via a real, stealth browser session

[![CI](https://github.com/devag7/linkedin-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/devag7/linkedin-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/linkedin-mcp-tools?color=cb0000&logo=npm)](https://www.npmjs.com/package/linkedin-mcp-tools)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![Glama score](https://glama.ai/mcp/servers/devag7/linkedin-mcp/badges/score.svg)](https://glama.ai/mcp/servers/devag7/linkedin-mcp)

**Structured LinkedIn reads for MCP clients — profiles, jobs, companies and inbox data, with guided offline setup and explicit safety limits.**

**22 tools** · local browser reads · five explicitly confirmed writes · persisted safety limits and operation journals.

> This is an unofficial LinkedIn integration and accounts can be restricted.
> Review [Account safety](#-account-safety) and [SECURITY.md](SECURITY.md) before use.

</div>

---

## Guided first run

**3.0.0 is released: 22 tools, guided local setup and manual Chrome login.**
This is a local stdio tool; Glama's generic “Deploy Server” or browser-hosting
controls are not supported installation instructions. No hosted service is required.
[Verified publication receipts](docs/LAUNCH_EVIDENCE_2026-10-07.md) cover npm,
GitHub Packages, the official MCP Registry and the GitHub release.

Start with the [quick start](#-quick-start) and [setup guide](SETUP_GUIDE.md).
Setup reports local issues, client configuration and exact next steps without
contacting LinkedIn. Merge the generated entry into your existing client file.
See the [synthetic setup demonstration](docs/RELEASE_DEMO_3.0.0.md): real published
package, disposable fixtures, no login or LinkedIn request.

`research_jobs` is **not included**; its job-research brief remains in
[draft PR #5](https://github.com/devag7/linkedin-mcp/pull/5). The
[execution plan](docs/PRODUCT_EXECUTION_PLAN_2026.md) tracks first use, privacy,
future features and measured distribution outcomes.

## What it does

The server uses Patchright to open a persistent Google Chrome profile and makes
Voyager requests from its authenticated page. Results are shaped into JSON for
MCP clients. Some discovery tools fall back to page data. Undocumented endpoints,
query IDs, browser behavior and response shapes can change.

Useful starting workflows are profile research, job/company research and inbox
triage. Alpha writes are disabled by default. When enabled they require a reviewed server-issued preview token and `confirm:true`, consume conservative attempt budgets, and
return a status including `unknown` when completion cannot be established.

## Verification status

3.0.0 introduces breaking safety and client requirements; read the
[migration guide](SETUP_GUIDE.md#migrating-from-203-to-300).
[Hosted source/package/browser checks](https://github.com/devag7/linkedin-mcp/actions/workflows/ci.yml)
cover Node20/22 across Linux, macOS and Windows. Exact core-only candidate/head
results are recorded in [release readiness](docs/RELEASE_READINESS_3.0.0.md). One explicitly consented macOS
maintainer health/own-profile read also passed with partial metadata;
[scope and evidence](docs/ZERO_COST_EXECUTION_EVIDENCE_2026-10-01.md#7-consented-maintainer-live-read--passed-limited-scope)
do not establish fresh-user or broader live compatibility.
The exact published 3.0.0 artifact is independently verified; native-client first-use cohorts
and broad live-provider compatibility remain unverified.
See [execution progress](docs/ROADMAP_PROGRESS.md) and the linked evidence.

| Area | Current evidence |
| --- | --- |
| HTTP boundary, checkpoints, write accounting | Offline regression and MCP protocol fixtures |
| Account identity, profile ownership, shared budgets | Production tool fixtures plus independent Node-process contention/crash tests |
| Setup diagnostics and cold saved sessions | Offline platform/path fixtures and production runtime fixtures |
| Packed artifact | Isolated install, version/doctor checks and compiled MCP smoke; no LinkedIn request |
| Profiles, feed, jobs, companies and inbox | Registered tools; repository notes contain historical live claims. Current live availability is unknown. |
| Five write tools | Conservative classifiers and transaction fixtures. No live writes were sent in this implementation. New-thread messaging remains experimental. |
| Official OAuth provider | Not connected to the active MCP runtime |

Local checks and CI configuration are evidence of the cases they exercise,
not a guarantee of current provider compatibility or account safety.

---

## 🚀 Quick start

Use Node.js 20 or later and Google Chrome. The commands below pin the published
3.0.0 package. Setup is offline; login and subsequent reads are deliberate account
actions. For a stable installation path and Windows commands, see the
[setup guide](SETUP_GUIDE.md).

**1. Diagnose offline:**

```bash
npm install --prefix "$HOME/.local/share/linkedin-mcp" linkedin-mcp-tools@3.0.0
node "$HOME/.local/share/linkedin-mcp/node_modules/linkedin-mcp-tools/dist/index.js" --setup cursor
```

Also accepts `claude-desktop` or `vscode`. Resolve the reported local issues, then
merge the generated entry into your existing client file. Setup performs no login
or account request. Use a stable local installation and regenerate its entry
after upgrades; the report pins its installed build rather than a temporary path.

**2. Log in once** (opens a real Chrome window — sign in, solve any captcha/2FA):

```bash
node "$HOME/.local/share/linkedin-mcp/node_modules/linkedin-mcp-tools/dist/index.js" --login
```

Needs Google Chrome installed (or run `npx patchright install chrome` once). Your
session — Cloudflare clearance and all — persists to `~/.linkedin-mcp/profile/`.

**3. Configure your client.** Prefer the generated entry above. For clients
accepting `mcpServers`, this version-pinned example is an alternative:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "npx",
      "args": ["-y", "linkedin-mcp-tools@3.0.0"]
    }
  }
}
```

Start with `whoami` for local status. When you deliberately authorize an account
read, try *"Read my own profile once and report its returned status and any partial
metadata, then close the session. Do not retry or write."* Stop at a checkpoint.
Current provider availability is uncertain; preserve empty, partial and error
statuses. First-use results across Claude Desktop, Cursor and VS Code have not yet
been measured.

<details>
<summary><b>From source / contributing</b></summary>

```bash
git clone https://github.com/devag7/linkedin-mcp.git
cd linkedin-mcp
npm ci
npm run setup:browser     # installs the Chrome patchright drives
npm run login             # manual account login; only with your deliberate consent
npm run spike             # live own-profile request; requires separate authorization
npm run build             # produces dist/
node dist/index.js --doctor # local setup checks; no browser or network
npm run verify:package     # install/test the packed artifact offline against LinkedIn
```

MCP config: `"command": "node", "args": ["/absolute/path/to/dist/index.js"]`.
</details>

### Diagnose this source checkout

```bash
npm run build
node dist/index.js --doctor
```

The report shows package/Chrome availability, profile accessibility and ownership,
safety-state validity, selected transport and next steps. It omits cookies, tokens,
profile content and private paths. It does not open Chrome or contact LinkedIn.

After you have logged in and stopped other processes using the profile, explicitly
select a live identity read with `node dist/index.js --doctor --live`. The probe
has a 30-second deadline followed by browser cleanup; a deadline does not prove
that an already-started read was cancelled. No write is part of diagnosis.

`whoami` reports `sessionState: "not_checked"` and `loggedIn: null` on a cold
runtime. `health_check` deliberately opens the saved session and performs a live
API check. A saved profile or cookie alone is not reported as a healthy API.

Headful login needs a local display. The normal server defaults to headless Chrome.
Remote browser/profile deployment and profile copying are not verified here.

---

## Local HTTP clients

Stdio remains the default. HTTP is an explicit, **loopback-only** option for a
local MCP client that can send an `Authorization` header. Remote hosts, reverse
proxies, browser CORS clients, and serverless deployment are unsupported.

Generate a local secret and start the server from this checkout:

```bash
npm run build
export LINKEDIN_HTTP_TOKEN="$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')"
node dist/index.js --transport http --port 3000
```

Configure your client with URL `http://127.0.0.1:3000/mcp` and the header
`Authorization: Bearer <the same LINKEDIN_HTTP_TOKEN value>`. Keep the secret in
your client's protected configuration; do not put it in a URL or commit it.
The token must contain 32–256 letters, digits, underscores, or hyphens. Generate
it randomly; length validation cannot prove a token is unpredictable.

- Every endpoint, including `GET /health`, requires the token. Missing or invalid
  credentials return `401`. Health reports listener status, not LinkedIn login.
- HTTP binds to `127.0.0.1`. Host must be `127.0.0.1:<port>` or
  `localhost:<port>`; an Origin, if present, must exactly match `http://<Host>`.
  Invalid hosts/origins return `403`. No CORS access is granted.
- `POST /mcp` accepts uncompressed JSON up to 1 MiB. Body upload has a 10-second
  deadline; responses have a 180-second deadline. There are at most 16 active
  HTTP requests and 32 TCP connections. Excess requests return `503`.
- Protocol connections share one browser, queue, pacer, budget tracker, and
  circuit breaker in this process. Closing a client does not close the browser;
  shutting down the listener closes the shared runtime.
- A timeout or disconnect **does not prove an action was cancelled**. Long pacing
  waits may outlast the response deadline. Check LinkedIn before retrying a write;
  HTTP does not retry it automatically. Prefer stdio for long-running workflows.

Browser profile ownership and account budget transactions are shared across local
processes. A second owner is refused before Chrome opens. These controls do not
establish account safety. See [SECURITY.md](SECURITY.md).

---

## 🛡️ Account safety

**Read this.** Automating LinkedIn violates its User Agreement and **can get your account restricted or banned** — no tool can prevent that, including this one. The built-in safety features (daily caps, human pacing, warmup, circuit breaker) **reduce risk; they do not eliminate it.**

Defaults err conservative:

- Connections **20/day**, messages **50/day**, likes+comments **50/day** combined, follows **30/day** — combined write cap **150/local day**.
- Profile views **80/day**, searches **30/day**.
- Conservative **warmup limits**, a **pending-invite ceiling**, and **acceptance-rate** pauses. The first verified use starts a persisted warmup clock. Week 1 blocks messages; weeks 2 and 3 gradually permit them. This measures local tool use, not LinkedIn account age.
- Reads paced 4–12s apart, writes 45–150s, with long breaks and a working-hours gate.
- A **persistent circuit breaker** blocks further automated calls after an observed checkpoint URL, HTTP 999, challenge HTML from a JSON endpoint, or supported challenge-page signal. It never tries to solve a checkpoint. Already in-flight requests cannot be undone.

Review platform rules and decide whether the integration is appropriate for your
account. Caps and pacing cannot prevent restrictions. Resolve challenges manually;
never treat the safety layer as a compliance or evasion guarantee.

---

## Recovering from a checkpoint

`CHECKPOINT_REQUIRED` means a challenge was observed; `CIRCUIT_OPEN` means the
stored stop is still active. `health_check` reports `blocked` without probing
LinkedIn while stopped. `whoami` and `close_session` remain available.

1. Stop every server/probe using the profile.
2. Run `linkedin-mcp --login`, complete the checkpoint manually in Chrome, and
   open your LinkedIn feed.
3. Restart the server only after login reports that both the session and API
   were verified. A cookie alone, restarting, or `--logout` does not clear the stop.

Breaker state is stored beside the profile: `<LINKEDIN_PROFILE_DIR>.circuit.json`
(default `~/.linkedin-mcp/profile.circuit.json`). A successful interactive recovery
clears the hard stop and preserves action cooldowns. Invalid/unreadable state
fails closed; restore the state or repair storage rather than deleting it to
resume automation.

Normal login expiry returns `AUTH_REQUIRED` without a hard trip. Opaque redirects
hide their destination, so they are reported as authentication required rather
than guessed to be checkpoints. Detection uses bounded response/page signals;
it does not establish live compatibility with every LinkedIn challenge variant.

---

## Write outcomes and operation IDs

All five alpha write tools require `LINKEDIN_ENABLE_WRITES=true` and `confirm:true`. With confirmation omitted/false they return a local preview without opening Chrome. Review its target, content, audience and route; after explicit human approval, use the returned operation ID as `operation_id` and token as `preview_token`. Tokens expire after five minutes, are bound to the exact action, target and content, and are consumed on submission. Missing or changed proofs are refused before dispatch. The token proves that the server issued a preview; it cannot prove human consent. Starting new message threads also requires `LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES=true` and has no current live success evidence. Supply a unique `operation_id`
(8–128 letters, digits, `_` or `-`) before the approved call. For example:

```json
{
  "text": "The draft you reviewed",
  "visibility": "PUBLIC",
  "confirm": true,
  "operation_id": "<operationId returned by the reviewed preview>",
  "preview_token": "<token returned by that same preview>"
}
```

The placeholders above must be replaced with the actual preview values; the
example is not a submission to copy unchanged.

The result includes `operationId`, `replayed`, `status`, `ok`, and `httpStatus`.
Repeating the same tool, ID, and inputs retrieves the stored outcome without
submitting again, including after restart. Changed inputs with the same ID are
rejected. A preview can generate an ID when omitted; every new submission must include
that preview ID and its token. Previously journaled outcomes can be looked up
with identical tool/ID/inputs after expiry or restart without a fresh token.
Never generate a replacement ID to retry an uncertain submission.

`unknown` means the request may have reached LinkedIn: a disconnect, timeout,
server error, unreadable body, or unrecognized success response cannot establish
whether it completed. Inspect the target manually. The server never automatically
retries; the same ID remains a lookup. A bare HTTP 409 is `failed` unless its body
provides an explicit duplicate/already-connected signal. Quota and account
restriction outcomes activate the corresponding action cooldown.

Safety limits count every reserved attempt, including known failures and unknown
outcomes. Only confirmed connections increment sent/pending invitation analytics.
Uncertain invitations also count conservatively toward invitation safety gates
across days. `health_check` includes journaled `attempted`, `successful`, and
`uncertain` totals; historical counts from older versions remain in `actions.used`
and are not guessed to be successful.

The journal is part of `~/.linkedin-mcp/budgets.json`, alongside existing counters.
It retains IDs, input hashes, action buckets, dates, and status codes; it does not
store message/post text or raw response details. Replays return stored status/code
with a generic explanation. Corrupt or unreadable state blocks startup; save
failures stop further data/action work until storage is repaired. The file is
replaced atomically with owner-only permissions. The journal stops new writes at
10,000 entries or an 8 MiB state file; IDs are never automatically discarded.
Deleting the state erases both safety counts and replay protection.

The runtime derives a hashed account key from authenticated `/me` identity;
it does not use a cookie, profile path or public username as the account key.
Different profiles for the same member share the global budget/journal file.
Identity is reverified on browser launch and before writes. A changed member
stops the runtime with `ACCOUNT_CHANGED`; restart only after reviewing the account.
Missing or ambiguous identity returns `ACCOUNT_UNRESOLVED` before submission.

Budget reserve/commit reload and save under a shared local filesystem lock. Failed
read attempts count toward metered read limits. Existing `default` counts remain
an unattributed conservative allowance reduction; they are not assigned to a new
member or invented as successful writes. Unattributed legacy operation IDs return
`unknown` rather than asserting they belong to the verified member. On a fresh
runtime, a hard checkpoint prevents the identity read required for journal lookup.

Profile ownership uses `<canonical-profile>.owner.lock`; shared budget transactions
use `<canonical-budget-file>.lock`. `close_session` and idle closing retain profile
ownership while the process can relaunch Chrome. Stop the server to release it.
Locks are never stolen by timeout or PID guessing. After a crash, stop all users
and associated Chrome processes, preserve safety files, then manually repair only
the orphaned lock directory. Never delete budgets or journals to resume automation.
Local filesystems are the supported state-sharing boundary; network filesystems
and power-loss durability are not certified.

See [write evidence](docs/PHASE0_WRITE_EVIDENCE.md) and
[account/ownership evidence](docs/PHASE0_ACCOUNT_EVIDENCE.md).

---

## ⚙️ Configuration

| Variable | Default | Description |
|---|---|---|
| `LINKEDIN_PROVIDER` | `browser` | Official mode is unavailable and refuses before browser creation. |
| `LINKEDIN_HEADLESS` | `true` | Server runs headless. `--login` always opens a real window regardless. Set `false` to watch the browser. |
| `LINKEDIN_CHROME_PATH` | — | Explicit Chrome binary path (else patchright's). |
| `LINKEDIN_PROFILE_DIR` | `~/.linkedin-mcp/profile` | Persistent browser profile. |
| `LINKEDIN_IDLE_TIMEOUT_MS` | `300000` | Close the browser after this idle time (0 disables). |
| `LINKEDIN_CONCURRENCY` | `1` | Only serial execution is supported. |
| `LINKEDIN_ENABLE_WRITES` | `false` | Deliberate opt-in for alpha browser writes; per-call approval still required. |
| `LINKEDIN_ENABLE_EXPERIMENTAL_MESSAGES` | `false` | Separate opt-in for unverified new-thread messaging. |
| `TRANSPORT` | `stdio` | `stdio` (primary) or local-only `http`. |
| `LINKEDIN_HTTP_TOKEN` | — | Required random bearer secret for HTTP; unused by stdio. |

---

## Tool contracts and verification

<!-- capabilities:start -->

22 registered tools. Native contract version 1 returns structuredContent and identical JSON text, with fetchedAt, source, partial and status metadata. [Full route and verification inventory](docs/CAPABILITIES.md).

| Group | Tools |
| --- | --- |
| Session | `whoami`, `health_check`, `close_session` |
| Reads | `get_my_profile`, `get_profile`, `get_feed`, `get_notifications`, `search_people`, `search_jobs`, `get_inbox`, `get_job_details`, `search_companies`, `get_company`, `get_company_posts`, `get_company_employees`, `get_pending_invitations`, `get_conversation` |
| Opt-in alpha writes | `connect_with_person`, `send_message`, `create_post`, `react_to_post`, `comment_on_post` |

<!-- capabilities:end -->

## Offline walkthrough

Build this checkout, then run `npm run demo:offline`. It makes real local MCP
calls with synthetic inputs and a persisted stop: cold status, capabilities, a
reviewable draft preview, blocked read and clean close. It opens no browser and
sends no LinkedIn request. [Dated sample output](docs/OFFLINE_DEMO.txt) is labeled
synthetic; a real first-read recording remains a consented validation step.

## Bounded workflows and setup

[Job/company research, profile comparison and inbox triage](docs/WORKFLOWS.md)
contain explicit call limits and source-link rules. [Client setup](SETUP_GUIDE.md)
separates locally exercised MCP transport from untested client applications.
[Privacy and deletion](docs/PRIVACY.md) explains retained safety history.
[Roadmap coverage](docs/ROADMAP_COVERAGE.md) tracks every acceptance requirement.
[Official-provider pilot](docs/OFFICIAL_PROVIDER_PILOT.md) describes the app/scopes
and integration evidence still needed. Docker files are an experimental Linux
recipe; no container build, display/login or runtime has been verified locally.

## 🛠 Development

```bash
npm run dev          # run from source (stdio)
npm run typecheck
npm test             # vitest (safety layer + smoke)
npm run build
```

---

## 📄 License

MIT — see [LICENSE](LICENSE). Missing files caused by cloud synchronization were recovered from the committed revision with maintainer authorization. The 3.0.0 core scope and destination receipts are tracked in release readiness. Not affiliated with LinkedIn.

<div align="center">

[![linkedin-mcp MCP server](https://glama.ai/mcp/servers/devag7/linkedin-mcp/badges/card.svg)](https://glama.ai/mcp/servers/devag7/linkedin-mcp)

Made by [Dev Agarwalla](https://github.com/devag7)

</div>
