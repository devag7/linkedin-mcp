<div align="center">

# 🔗 LinkedIn MCP

### LinkedIn for AI assistants — structured data via a real, stealth browser session

[![CI](https://github.com/devag7/linkedin-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/devag7/linkedin-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/linkedin-mcp-tools?color=cb0000&logo=npm)](https://www.npmjs.com/package/linkedin-mcp-tools)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![Glama score](https://glama.ai/mcp/servers/devag7/linkedin-mcp/badges/score.svg)](https://glama.ai/mcp/servers/devag7/linkedin-mcp)

**Give Claude, Cursor, and any MCP client access to LinkedIn — profiles, people/job/company search, feed, messaging, and your network — as clean structured JSON.**

**22 tools** · reads + **gated writes** (connect, message, post, react, comment) · a real **safety layer** (daily caps, human pacing, circuit breaker) · **166 tests**.

> ⚠️ Automating LinkedIn violates its User Agreement and can get an account restricted. **No tool is ban-proof — and this one says so up front.** Use a secondary account; read [Account safety](#-account-safety) and [DISCLAIMER.md](DISCLAIMER.md) first.

</div>

---

## Why this exists

LinkedIn's internal **Voyager API** (the one its own web app uses) returns rich, structured JSON — but it sits behind **Cloudflare bot-management**, which rejects plain HTTP requests (a stateless `fetch` or `curl` gets stuck in an endless redirect, even with a valid cookie). The only reliable way to read LinkedIn data programmatically in 2026 is from inside a **real browser** that clears the challenge.

**This project's approach:**

1. Drive a real Chrome via [**patchright**](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright) (an undetected Playwright fork) so Cloudflare's challenge is solved with a genuine browser fingerprint.
2. Query Voyager **from inside the authenticated page** — same-origin, the exact network path LinkedIn's own SPA uses → **structured JSON, not scraped DOM text**.

That last point is the edge over DOM-scraping tools: in-page API calls are **locale-independent and resilient to UI redesigns**, so they don't break on a moved CSS selector or a translated label.

---

## ✨ What's good here

| | |
|---|---|
| 🧩 **Structured JSON** | In-page Voyager API calls return normalized data, shaped into compact objects — not brittle innerText scraping. |
| ✍️ **Writes are API calls, not button-clicking** | `connect` / `message` / `post` / `react` / `comment` POST straight to Voyager — the **exact requests the web app sends, captured and verified live**. No hunting for a "Connect" button under a sticky navbar, no composer-dialog race. Every write returns a **structured status** (`ok` / `duplicate` / `already_connected` / `restricted` / `quota_exhausted` / …) — never a blind "sent: true". |
| 🛡️ **Safety layer built in** | Serial queue, human-paced jittered delays, per-action **daily budgets**, account **warmup ramp**, and a **circuit breaker** that hard-stops on any checkpoint/captcha. (Risk reduction — *not* a safety guarantee.) |
| 🔥 **One warm session** | A single persistent browser per process (cookies + Cloudflare clearance survive restarts). Explicit `close_session`, signal-handled teardown — no zombie Chrome. |
| 🌍 **Locale-independent** | API + embedded-JSON parsing, not English-only DOM selectors — survives UI redesigns and translations. |
| 🔒 **Local & private** | Session stored under `~/.linkedin-mcp/` with `0700/0600` perms; no cookies/tokens to paste, none ever logged. |

---

## How it compares

| | DOM-scraping LinkedIn MCPs | **This** |
|---|---|---|
| Reads | scraped page text (brittle, locale-bound) | **structured API JSON** |
| Writes (connect/message/post) | click rendered buttons (break on sticky navbars, dialog races, localized labels) | **direct Voyager `POST`, captured + verified live** |
| Write feedback | "clicked it" → hope | **structured status** (ok / duplicate / restricted / quota_exhausted / …) |
| Resilience | breaks on UI tweaks / translations | **API + embedded-JSON, locale-proof** |
| Safety (caps, pacing, circuit breaker) | none | **✅ built-in, 166 tests** |
| Zombie browser processes | common | **✅ reaped on close** |
| Language | Python | TypeScript + official MCP SDK |

We hit LinkedIn's own API from inside the challenge-passed browser — reads *and*
writes — so you get the structured response and a real status, not parsed HTML
and a hopeful click.

## 📦 Status

**Stable — v2, all 22 tools shipping.** Full transparency on exactly where every piece stands:

| Area | State |
|---|---|
| Stealth browser engine (patchright) | ✅ built, **live-proven** |
| In-page Voyager fetch (the core mechanism) | ✅ **live-verified** (returns structured JSON) |
| Safety layer (queue / pacer / budgets / circuit-breaker) | ✅ built, 166 unit tests |
| **Profile** — `get_profile`, `get_my_profile` (name, headline, summary, experience, education, skills, certifications, languages) | ✅ live-verified |
| **Feed / notifications** — `get_feed`, `get_notifications` | ✅ live-verified |
| **Jobs / messaging** — `search_jobs`, `get_job_details`, `get_inbox`, `get_conversation` | ✅ live-verified |
| **People / companies** — `search_people`, `search_companies`, `get_company`, `get_company_posts`, `get_company_employees` (DOM fallback) | ✅ live-verified |
| **Network** — `get_pending_invitations` (received + sent) | ✅ |
| **Session** — `whoami`, `health_check` (live Voyager probe + budget headroom), `close_session` | ✅ |
| **Write tools** — `connect_with_person`, `send_message`, `create_post`, `react_to_post`, `comment_on_post` | ✅ all 5 endpoints captured + live-verified on a burner; gated (`confirm:true` + daily caps), structured statuses. ⚠️ These take real, often irreversible actions — keep the gate on and use a throwaway account. |

**22 tools.** typecheck + 166 tests green.

**Login is headful, the server is headless.** The one-time `--login` opens a real
Chrome window (to clear Cloudflare and let you solve any captcha/2FA). After that
the persistent profile carries the clearance, so the server runs **headless** —
verified returning live data. Use a **residential IP**; datacenter/VPN IPs are
often pre-flagged by Cloudflare regardless of headless vs headful.

---

## 🚀 Quick start

**1. Log in once** (opens a real Chrome window — sign in, solve any captcha/2FA):

```bash
npx -y linkedin-mcp-tools@latest --login
```

Needs Google Chrome installed (or run `npx patchright install chrome` once). Your
session — Cloudflare clearance and all — persists to `~/.linkedin-mcp/profile/`.

**2. Point your MCP client at it.** Claude Desktop / Cursor / Claude Code config:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "npx",
      "args": ["-y", "linkedin-mcp-tools@latest"]
    }
  }
}
```

Then just ask: *"Get my LinkedIn profile and summarize my experience"* or *"Find 5
recruiters at Google."*

<details>
<summary><b>From source / contributing</b></summary>

```bash
git clone https://github.com/devag7/linkedin-mcp.git
cd linkedin-mcp
npm install
npm run setup:browser     # installs the Chrome patchright drives
npm run login             # log in once
npm run spike             # verify: fetches your profile as JSON
npm run build             # produces dist/
```

MCP config: `"command": "node", "args": ["/absolute/path/to/dist/index.js"]`.
</details>

### Headless / server deployment

The one-time `--login` needs a window; the server then runs **headless** (verified
returning live data). Run `--login` on a machine with a display (or via VNC),
copy `~/.linkedin-mcp/profile/` to your server, and run there:

```bash
LINKEDIN_HEADLESS=true npx -y linkedin-mcp-tools@latest   # no display needed
```

Use a **residential IP** — datacenter/VPN IPs are frequently pre-flagged by
Cloudflare regardless of headless vs headful.

---

## 🛡️ Account safety

**Read this.** Automating LinkedIn violates its User Agreement and **can get your account restricted or banned** — no tool can prevent that, including this one. The built-in safety features (daily caps, human pacing, warmup, circuit breaker) **reduce risk; they do not eliminate it.**

Defaults err conservative:

- Connections **20/day**, messages **50/day**, likes+comments **50/day** combined, follows **30/day** — combined write cap **150/24h**.
- Profile views **80/day**, searches **30/day**.
- New-account **warmup ramp** over the first weeks; **pending-invite ceiling** and **acceptance-rate** pauses.
- Reads paced 4–12s apart, writes 45–150s, with long breaks and a working-hours gate.
- A **circuit breaker** stops automatically on any checkpoint, captcha, or "unusual activity" page — and never tries to solve one.

**Recommendations:** use a **secondary/throwaway account**, run from a **residential IP**, warm it up slowly. See [DISCLAIMER.md](DISCLAIMER.md) for the full legal/ToS notice.

---

## ⚙️ Configuration

| Variable | Default | Description |
|---|---|---|
| `LINKEDIN_HEADLESS` | `true` | Server runs headless. `--login` always opens a real window regardless. Set `false` to watch the browser. |
| `LINKEDIN_CHROME_PATH` | — | Explicit Chrome binary path (else patchright's). |
| `LINKEDIN_PROFILE_DIR` | `~/.linkedin-mcp/profile` | Persistent browser profile. |
| `LINKEDIN_IDLE_TIMEOUT_MS` | `300000` | Close the browser after this idle time (0 disables). |
| `LINKEDIN_CONCURRENCY` | `1` | Serial by default; >1 is ban-risky. |
| `TRANSPORT` | `stdio` | `stdio` (primary) or `http`. |

---

## 🛠 Development

```bash
npm run dev          # run from source (stdio)
npm run typecheck
npm test             # vitest (safety layer + smoke)
npm run build
```

---

## 📄 License

MIT — see [LICENSE](LICENSE). Not affiliated with LinkedIn. Use at your own risk; see [DISCLAIMER.md](DISCLAIMER.md).

<div align="center">

[![linkedin-mcp MCP server](https://glama.ai/mcp/servers/devag7/linkedin-mcp/badges/card.svg)](https://glama.ai/mcp/servers/devag7/linkedin-mcp)

Made by [Dev Agarwalla](https://github.com/devag7)

</div>
