<div align="center">

# 🔗 LinkedIn MCP

### The most reliable LinkedIn MCP server for AI assistants

[![npm version](https://img.shields.io/npm/v/@devag7/linkedin-mcp?color=cb0000&logo=npm)](https://www.npmjs.com/package/@devag7/linkedin-mcp)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-≥20-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple?logo=anthropic&logoColor=white)](https://modelcontextprotocol.io/)
[![CI](https://img.shields.io/github/actions/workflow/status/devag7/linkedin-mcp/ci.yml?label=CI&logo=github)](https://github.com/devag7/linkedin-mcp/actions)
[![GitHub stars](https://img.shields.io/github/stars/devag7/linkedin-mcp?style=social)](https://github.com/devag7/linkedin-mcp/stargazers)

**Give Claude, Cursor, and any MCP-compatible AI assistant full access to LinkedIn — profiles, messaging, jobs, companies, and more. Zero local dependencies.**

```bash
npx -y @devag7/linkedin-mcp --login   # One-time setup
```

[Quick Start](#-quick-start) · [36 Tools](#-available-tools) · [Setup Guide](SETUP_GUIDE.md) · [Authentication](#-authentication) · [Compare](#-comparison-with-alternatives)

</div>

---

## ✨ Why LinkedIn MCP?

| | Feature | Description |
|---|---|---|
| 🚀 | **Remote-First** | Zero install — add a URL to your Claude config and go. No Python, no browser, no Docker required. |
| 🔧 | **36 Tools** | The most comprehensive LinkedIn MCP available. Profiles, messaging, jobs, companies, network, feed, and more. |
| 🔒 | **Secure** | OAuth 2.0 + cookie authentication. Rate limiting, CORS, origin validation built-in. |
| ⚡ | **Fast & Lightweight** | API-based — no headless browser needed. ~50KB bundle vs 500MB+ browser-based alternatives. |
| 🌍 | **Reliable** | No session expiry loops, no browser crashes, no dialog collisions. Stateless HTTP design. |
| 🌐 | **Locale-Independent** | Works worldwide. No English-only DOM selectors. API-based, not scraping. |

---

## 🚀 Quick Start

### Method 1: Remote URL (Recommended)

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "linkedin": {
      "url": "https://your-deployed-url.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### Method 2: npx (No Install)

First, save your credentials once:

```bash
npx -y @devag7/linkedin-mcp --login
```

Then add to Claude config (no env vars needed!):

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "npx",
      "args": ["-y", "@devag7/linkedin-mcp"]
    }
  }
}
```

### Method 3: Clone & Run

```bash
git clone https://github.com/devag7/linkedin-mcp.git
cd linkedin-mcp
npm install
npm run dev
```

---

## 🛠 Available Tools

### 👤 Profile Tools

| Tool | Description |
|---|---|
| `get_profile` | Get any LinkedIn profile with full details (experience, education, skills) |
| `get_my_profile` | Get the authenticated user's own profile |
| `get_profile_skills` | Get detailed skills with endorsement counts |
| `get_profile_recommendations` | Get recommendations given and received |
| `get_profile_activity` | Get a user's recent posts and activity |
| `get_sidebar_profiles` | Get "People also viewed" profile suggestions |
| `search_people` | Search people with advanced filters (location, company, title) |

### 💬 Messaging Tools

| Tool | Description |
|---|---|
| `get_inbox` | List inbox conversations with read/unread filters |
| `get_conversation` | Read a specific conversation thread |
| `search_conversations` | Search messages by keyword |
| `send_message` | Send a message (supports multiline, rich text) |
| `reply_to_thread` | Reply to an existing conversation by thread ID |
| `mark_conversation_read` | Mark a conversation as read |

### 🏢 Company Tools

| Tool | Description |
|---|---|
| `get_company` | Get company profile, description, and details |
| `get_company_posts` | Get recent posts from a company's feed |
| `get_company_employees` | List employees with filters |
| `search_companies` | Search companies by keyword and industry |
| `get_company_jobs` | Get open job positions at a company |

### 💼 Job Tools

| Tool | Description |
|---|---|
| `search_jobs` | Search jobs with keyword, location, and experience filters |
| `get_job_details` | Get detailed information about a job posting |
| `get_saved_jobs` | Get the user's saved/bookmarked jobs |
| `get_job_applicants` | Get applicant information (recruiter accounts) |

### 🤝 Network Tools

| Tool | Description |
|---|---|
| `connect_with_person` | Send a connection request with optional personalized note |
| `get_connections` | List 1st-degree connections, sorted by recently added |
| `get_pending_invitations` | View sent and received connection invitations |
| `withdraw_invitation` | Cancel a sent connection invitation |
| `accept_invitation` | Accept a received connection invitation |
| `get_network_stats` | Get network growth metrics and connection statistics |

### 📰 Feed & Content Tools

| Tool | Description |
|---|---|
| `get_feed` | Get posts from the home feed |
| `create_post` | Create a new text or image post |
| `react_to_post` | React to a post (like, celebrate, support, etc.) |
| `comment_on_post` | Add a comment to a post |
| `search_posts` | Search posts by keyword or hashtag |

### 🔧 Utility Tools

| Tool | Description |
|---|---|
| `whoami` | Get server info, auth status, and capabilities |
| `health_check` | Check server health and LinkedIn connectivity |
| `get_notifications` | Get recent LinkedIn notifications |

---

## 🔐 Authentication

### One-Time Setup (Recommended)

Run the interactive login once — credentials are saved and reused automatically:

```bash
npx @devag7/linkedin-mcp --login
```

This guides you through pasting your LinkedIn cookie or OAuth token, and saves it to `~/.linkedin-mcp/credentials.json`. You never need to set env vars again.

```bash
# Check your current auth status
npx @devag7/linkedin-mcp --status

# Clear saved credentials
npx @devag7/linkedin-mcp --logout
```

### Cookie Auth (Works with All 36 Tools)

1. Log in to LinkedIn in your browser
2. Open DevTools (F12) → Application → Cookies → `linkedin.com`
3. Copy the `li_at` cookie value
4. Run `linkedin-mcp --login` and paste when prompted

### OAuth 2.0 (Official API)

1. Create an app at [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Get your access token
3. Run `linkedin-mcp --login` and select OAuth option

### Environment Variables (Alternative)

For CI/Docker, you can use env vars instead (they override saved credentials):

```bash
export LINKEDIN_COOKIE="your_li_at_cookie_value"
# or
export LINKEDIN_ACCESS_TOKEN="your_oauth_token"
```

---

## ⚡ Comparison with Alternatives

| Feature | **LinkedIn MCP** | stickerdaniel/linkedin-mcp-server |
|---|---|---|
| **Architecture** | ✅ API-based (Voyager/REST) | ❌ Browser scraping (Patchright + Chromium) |
| **Transport** | ✅ Remote HTTP + stdio | ⚠️ stdio + experimental HTTP |
| **Install Required** | ✅ No — `npx linkedinmcp` | ❌ Python + uv + Chromium (~500MB) |
| **Language** | TypeScript (official MCP SDK) | Python (fastmcp — 3rd party) |
| **Tools** | **36** | 17 |
| **Auth Methods** | OAuth 2.0 + Cookie | Browser login only |
| **Multiline Messages** | ✅ Native support | ❌ Buggy (#441 — splits into multiple) |
| **Session Stability** | ✅ Stateless — no session to expire | ❌ Browser session expiry loops |
| **Connection Requests** | ✅ API-based, reliable | ❌ 4 open bugs (#407, #432, #448, #454) |
| **Post/React/Comment** | ✅ Create, react, comment, search | ❌ Feed read-only |
| **Network Management** | ✅ Connections, invitations, withdraw | ❌ No network tools |
| **Rate Limiting** | ✅ Built-in token bucket | ❌ None |
| **Response Caching** | ✅ LRU with TTL | ❌ None |
| **Retry Logic** | ✅ Exponential backoff | ❌ None |
| **Locale Support** | ✅ Worldwide (API returns JSON) | ⚠️ DOM-based, locale issues (#454) |
| **Docker Image** | ~50MB (Alpine) | ~500MB+ (includes Chromium) |
| **Known Critical Bugs** | 0 | 7+ open issues |

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `LINKEDIN_ACCESS_TOKEN` | One of these | — | LinkedIn OAuth access token |
| `LINKEDIN_COOKIE` | One of these | — | LinkedIn `li_at` session cookie |
| `LINKEDIN_CSRF_TOKEN` | No | — | LinkedIn `JSESSIONID` for CSRF protection |
| `PORT` | No | `3000` | HTTP server port |
| `TRANSPORT` | No | `stdio` | Transport mode: `stdio` or `http` |
| `LOG_LEVEL` | No | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `CACHE_TTL` | No | `300` | Cache TTL in seconds |
| `RATE_LIMIT_RPM` | No | `30` | Max requests per minute |
| `REQUEST_TIMEOUT` | No | `30000` | Request timeout in milliseconds |

---

## 🛠 Development

```bash
# Clone the repo
git clone https://github.com/devag7/linkedin-mcp.git
cd linkedin-mcp

# Install dependencies
npm install

# Run in development mode (stdio)
npm run dev

# Run in HTTP mode
npm run dev -- --transport http --port 3000

# Run tests
npm test

# Type checking
npm run typecheck

# Lint
npm run lint

# Build for production
npm run build
```

---

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## ⚠️ Disclaimer

This project is not officially affiliated with LinkedIn. Use responsibly and in accordance with LinkedIn's Terms of Service. The authors are not responsible for any misuse or account restrictions.

---

<div align="center">

**If you find this useful, please give us a ⭐! It helps others discover the project.**

Made with ❤️ by [Dev Agarwalla](https://github.com/devag7)

</div>
