<div align="center">

# 🔗 LinkedIn MCP

### LinkedIn for AI assistants — structured data via a real, stealth browser session

[![npm version](https://img.shields.io/npm/v/linkedin-mcp-tools?color=cb0000&logo=npm)](https://www.npmjs.com/package/linkedin-mcp-tools)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)

**Give Claude, Cursor, and any MCP client access to LinkedIn — profiles, search, jobs, companies, messaging, and your network — as clean structured JSON.**

> ⚠️ **v2 is a work in progress.** The architecture and safety layer are built and tested; the tool surface is being expanded. Read [Status](#-status) and the [Disclaimer](DISCLAIMER.md) before use. There is **no such thing as a ban-proof LinkedIn tool** — see [Account safety](#-account-safety).

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
| 🔥 **One warm session** | A single persistent browser per process (cookies + Cloudflare clearance survive restarts). No per-call relaunch, explicit `close_session`, signal-handled teardown — no zombie Chrome. |
| 🛡️ **Safety layer built in** | Serial queue, human-paced jittered delays, per-action **daily budgets**, account **warmup ramp**, and a **circuit breaker** that hard-stops on any checkpoint/captcha. (Risk reduction — *not* a safety guarantee.) |
| 🌍 **Locale-independent** | API + embedded-JSON parsing, not English-only DOM selectors. |
| 🔒 **Local & private** | Session stored under `~/.linkedin-mcp/` with `0700/0600` perms; cookie values are never logged. |

---

## How it compares

| | DOM-scraping LinkedIn MCPs | **This** |
|---|---|---|
| Data | scraped page text (brittle, locale-bound) | **structured API JSON** |
| Resilience | breaks on UI tweaks / translations | **API + embedded-JSON, locale-proof** |
| Headless / server | flaky | **✅ verified** |
| Safety (caps, pacing, circuit breaker) | none | **✅ built-in, 135 tests** |
| Zombie browser processes | common | **✅ reaped on close** |
| Language | Python | TypeScript + official MCP SDK |

We hit LinkedIn's own API from inside the challenge-passed browser — so you get
the structured response, not parsed HTML. (Shipping checklist + launch notes:
[LAUNCH.md](LAUNCH.md).)

## 📦 Status

This is an honest, in-progress v2. Here's exactly where it stands:

| Area | State |
|---|---|
| Stealth browser engine (patchright) | ✅ built, **live-proven** |
| In-page Voyager fetch (the core mechanism) | ✅ **live-verified** (returns structured JSON) |
| Safety layer (queue / pacer / budgets / circuit-breaker) | ✅ built, 130+ unit tests |
| **Profile** — `get_profile`, `get_my_profile` (name, headline, summary, experience, education, skills, certifications, languages) | ✅ live-verified |
| **Feed / notifications** — `get_feed`, `get_notifications` | ✅ live-verified |
| **Jobs / messaging** — `search_jobs`, `get_job_details`, `get_inbox`, `get_conversation` | ✅ live-verified |
| **People / companies** — `search_people`, `search_companies`, `get_company`, `get_company_posts`, `get_company_employees` (DOM fallback) | ✅ live-verified |
| **Network** — `get_pending_invitations` (received + sent) | ✅ |
| **Session** — `whoami`, `health_check` (live Voyager probe + budget headroom), `close_session` | ✅ |
| **Write tools** — `connect_with_person`, `send_message`, `create_post`, `react_to_post`, `comment_on_post` | ⚠️ alpha — hardened + gated (`confirm:true` + caps), structured statuses; live payload verify pending |

**22 tools.**

The live data path requires a **headful** Chrome (a real window) — that's what passes Cloudflare. Headless/server environments are unreliable and frequently IP-flagged.

---

## 🚀 Quick start

```bash
git clone https://github.com/devag7/linkedin-mcp.git
cd linkedin-mcp
npm install
npm run setup:browser        # installs the Chrome patchright drives

npm run login                # opens a real Chrome — log in to LinkedIn once
npm run spike                # verify: should fetch your profile as JSON
```

`login` persists your session to `~/.linkedin-mcp/profile/`. After that, point your MCP client at the server:

### Headless / server deployment

The **one-time `--login` needs a real window** (to clear the Cloudflare
challenge and let you solve any captcha/2FA). After that, the persistent
profile carries the Cloudflare clearance + session, so the server runs
**headless** — verified returning live data:

```bash
LINKEDIN_HEADLESS=true node dist/index.js     # server/CI friendly, no display
```

Run `--login` once on a machine with a display (or via VNC/remote desktop),
copy `~/.linkedin-mcp/profile/` to your server, then run headless there. Use a
**residential IP** — datacenter/VPN IPs are frequently pre-flagged by Cloudflare
regardless of headless vs headful.


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

Run `npm run build` first to produce `dist/`.

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
| `LINKEDIN_HEADLESS` | `false` | Headful is strongly recommended (passes Cloudflare; allows manual login). |
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

Made by [Dev Agarwalla](https://github.com/devag7)

</div>
