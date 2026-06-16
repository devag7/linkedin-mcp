# 📘 LinkedIn MCP — Setup & Usage Guide

> Connect Claude, Cursor, or any MCP client to LinkedIn in a few minutes.

---

## Contents

- [Requirements](#requirements)
- [Quick setup](#quick-setup)
- [Claude Desktop](#claude-desktop)
- [Claude Code (CLI)](#claude-code-cli)
- [Cursor](#cursor)
- [Tool reference](#tool-reference)
- [Headless / server](#headless--server)
- [Troubleshooting](#troubleshooting)
- [Account safety](#account-safety)

---

## Requirements

- **Node.js ≥ 20**
- **Google Chrome** installed (the engine drives your real Chrome). No Chrome?
  Run `npx patchright install chrome` once to install the bundled build.
- A LinkedIn account — ideally a **secondary/throwaway** one (see
  [Account safety](#account-safety)).

There are **no cookies or API tokens to paste.** You sign in once in a real
browser window; the session persists locally.

---

## Quick setup

### 1. Log in once

```bash
npx -y linkedin-mcp-tools@latest --login
```

A real Chrome window opens. Sign in to LinkedIn (solve any captcha/2FA yourself).
The authenticated, Cloudflare-cleared session is saved to
`~/.linkedin-mcp/profile/`. You won't need to do this again until the session
expires.

### 2. Verify

```bash
npx -y linkedin-mcp-tools@latest --status   # shows login/profile state
npx -y linkedin-mcp-tools@latest --spike    # fetches your profile as JSON
```

### 3. Add it to your AI client

Pick your client below.

---

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

Restart Claude Desktop. (Make sure you ran `--login` first.)

---

## Claude Code (CLI)

```bash
claude mcp add linkedin -- npx -y linkedin-mcp-tools@latest
```

---

## Cursor

Add to `.cursor/mcp.json` in your project (or the global Cursor MCP settings):

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

---

## Tool reference

**22 tools.** Reads return structured JSON. Writes are **gated** — they require
`confirm: true` and count against daily safety caps.

### Profile
| Tool | What it does |
|---|---|
| `get_my_profile` | Your own profile (experience, education, skills, certs, languages) |
| `get_profile` | A profile by public id, e.g. *"Get the profile of satyanadella"* |

### Search & discovery
| Tool | What it does |
|---|---|
| `search_people` | *"Find 5 recruiters at Google"* |
| `search_jobs` | *"Search software-engineer jobs in San Francisco"* |
| `get_job_details` | Full posting by job id |
| `search_companies` | *"Search for AI startups"* |
| `get_company` | Company overview by slug, e.g. *"Tell me about anthropicresearch"* |
| `get_company_posts` | A company's recent posts |
| `get_company_employees` | People LinkedIn surfaces for a company |

### Feed & messaging
| Tool | What it does |
|---|---|
| `get_feed` | Your home feed |
| `get_notifications` | Your notifications |
| `get_inbox` | Your messaging conversations |
| `get_conversation` | Messages in one conversation |
| `get_pending_invitations` | Pending invites (received + sent) |

### Writes ⚠️ (gated: `confirm: true` + daily caps)
| Tool | What it does |
|---|---|
| `connect_with_person` | Send a connection request (optional note) |
| `send_message` | Message a member, or reply into an existing thread |
| `create_post` | Publish a text post to your feed |
| `react_to_post` | React (LIKE / PRAISE / …) to a post |
| `comment_on_post` | Comment on a post |

Every write returns a **structured status** (`ok` / `duplicate` /
`already_connected` / `restricted` / `quota_exhausted` / `not_allowed` /
`failed`) — never a blind success.

### Session
| Tool | What it does |
|---|---|
| `whoami` | Server version, login state, tool count |
| `health_check` | Live Voyager probe + today's safety-budget headroom |
| `close_session` | Close the browser, free resources |

---

## Headless / server

The one-time `--login` needs a real window. After that the server runs
**headless** (verified). Run `--login` on a machine with a display (or via VNC),
copy `~/.linkedin-mcp/profile/` to your server, then:

```bash
LINKEDIN_HEADLESS=true npx -y linkedin-mcp-tools@latest
```

Use a **residential IP** — datacenter/VPN IPs are often pre-flagged by Cloudflare.

---

## Troubleshooting

**"Run --login" / auth errors when calling tools** — the session expired or never
completed. Re-run `npx -y linkedin-mcp-tools@latest --login`.

**Cloudflare challenge / HTML instead of JSON** — re-run `--login` headful on a
clean residential IP; datacenter IPs get challenged.

**Client doesn't detect the server** — confirm `npx` is on your PATH, the config
path is correct, and restart the client. Test directly with
`npx -y linkedin-mcp-tools@latest --spike`.

**Chrome won't launch** — install Google Chrome, or run
`npx patchright install chrome` once.

---

## Account safety

Automating LinkedIn violates its User Agreement and **can get an account
restricted or banned — no tool prevents that.** The built-in safety layer (daily
caps, human-paced delays, account warmup, and a circuit breaker that hard-stops
on any checkpoint) **reduces risk; it does not eliminate it.**

Use a **secondary account**, a **residential IP**, and warm it up slowly. Full
notice: [DISCLAIMER.md](DISCLAIMER.md).
