# 📘 LinkedIn MCP — Complete Setup & Usage Guide

> Get your AI assistant (Claude, Cursor, etc.) fully connected to LinkedIn in 5 minutes.

---

## Table of Contents

- [Quick Setup (2 minutes)](#quick-setup-2-minutes)
- [Authentication Setup](#authentication-setup)
- [Claude Desktop Setup](#claude-desktop-setup)
- [Claude Code (CLI) Setup](#claude-code-cli-setup)
- [Cursor Setup](#cursor-setup)
- [Tool Reference & Usage Examples](#tool-reference--usage-examples)
- [Troubleshooting](#troubleshooting)

---

## Quick Setup (2 minutes)

### Step 1: One-Time Login

```bash
npx -y linkedin-mcp-tools --login
```

This will prompt you to paste your LinkedIn `li_at` cookie. Here's how to get it:

1. Open **linkedin.com** in your browser and sign in
2. Open DevTools: `F12` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. Go to **Application** → **Cookies** → **https://www.linkedin.com**
4. Find the cookie named **`li_at`** — copy its value
5. Paste it when prompted

Your credentials are saved to `~/.linkedin-mcp/credentials.json` — you never need to do this again unless the cookie expires (typically lasts 6-12 months).

### Step 2: Verify Setup

```bash
npx -y linkedin-mcp-tools --status
```

Expected output:
```
🔗 LinkedIn MCP — Auth Status

  Saved credentials:  ✅ Found (~/.linkedin-mcp/credentials.json)
  Env LINKEDIN_COOKIE: ❌ Not set
  Env LINKEDIN_ACCESS_TOKEN: ❌ Not set

  Active method: Saved credentials
```

### Step 3: Add to Your AI Client

See the sections below for Claude Desktop, Claude Code, or Cursor.

---

## Authentication Setup

### Option A: Cookie Auth (Recommended — All 36 Tools)

```bash
npx -y linkedin-mcp-tools --login
# Select option 1 (Cookie Auth)
# Paste your li_at cookie
```

### Option B: OAuth 2.0 (Official API — Limited Tools)

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/)
2. Create an app → Get access token
3. Run:

```bash
npx -y linkedin-mcp-tools --login
# Select option 2 (OAuth)
# Paste your access token
```

### Option C: Environment Variables (CI/Docker)

```bash
export LINKEDIN_COOKIE="your_li_at_cookie_value"
npx -y linkedin-mcp-tools
```

> **Priority order:** Env vars → Saved credentials → None

---

## Claude Desktop Setup

### Method 1: Download Config File

1. Download `claude-desktop-config.json` from the [latest release](https://github.com/devag7/linkedin-mcp/releases)
2. Open Claude Desktop → Settings → Developer → Edit Config
3. Merge the contents into your config file
4. Restart Claude Desktop

### Method 2: Manual Config

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "npx",
      "args": ["-y", "linkedin-mcp-tools"]
    }
  }
}
```

> **Note:** Make sure you've run `npx -y linkedin-mcp-tools --login` first!

---

## Claude Code (CLI) Setup

```bash
# Add LinkedIn MCP to Claude Code
claude mcp add linkedin -- npx -y linkedin-mcp-tools
```

---

## Cursor Setup

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "npx",
      "args": ["-y", "linkedin-mcp-tools"]
    }
  }
}
```

---

## Tool Reference & Usage Examples

### 📋 Profile Tools (7 tools)

**Get someone's profile:**
> "Get the LinkedIn profile of satyanadella"

**Get your own profile:**
> "Show me my LinkedIn profile"

**Get someone's skills with endorsements:**
> "What skills does billgates have on LinkedIn?"

**Get recommendations:**
> "Show me recommendations for elonmusk"

**Get someone's recent activity:**
> "What has satyanadella been posting about recently?"

**Get related profiles:**
> "Show me profiles similar to sundarpichai"

---

### 💬 Messaging Tools (6 tools)

**Read your inbox:**
> "Show me my LinkedIn messages"

**Read a specific conversation:**
> "Show me my conversation with John Smith"

**Search messages:**
> "Search my LinkedIn messages for 'interview'"

**Send a message:**
> "Send a LinkedIn message to johndoe saying 'Great connecting with you!'"

**Reply to a thread:**
> "Reply to my latest LinkedIn conversation with 'Thanks for the update!'"

**Mark as read:**
> "Mark my LinkedIn conversation with Jane as read"

---

### 🏢 Company Tools (5 tools)

**Get company info:**
> "Tell me about Google on LinkedIn"

**Get company posts:**
> "What has Microsoft been posting on LinkedIn?"

**Search companies:**
> "Search for AI startups on LinkedIn"

**Get employees:**
> "Who are the engineers at OpenAI on LinkedIn?"

**Get company jobs:**
> "What jobs are open at Google?"

---

### 💼 Jobs Tools (4 tools)

**Search jobs:**
> "Search for software engineer jobs in San Francisco on LinkedIn"

**Get job details:**
> "Get details about this LinkedIn job: [job URL or ID]"

**Get saved jobs:**
> "Show me my saved LinkedIn jobs"

**Get applicants (recruiters):**
> "Who applied to our senior developer position?"

---

### 🤝 Network Tools (6 tools)

**Send connection request:**
> "Connect with satyanadella on LinkedIn with the note 'Loved your recent post!'"

**View connections:**
> "Show me my recent LinkedIn connections"

**View pending invitations:**
> "Show me my pending LinkedIn connection requests"

**Accept invitation:**
> "Accept the connection request from Sarah"

**Withdraw invitation:**
> "Cancel my connection request to that person"

**Network stats:**
> "How many LinkedIn connections do I have?"

---

### 📰 Feed Tools (5 tools)

**Read your feed:**
> "What's on my LinkedIn feed?"

**Create a post:**
> "Create a LinkedIn post about my new open-source project"

**React to a post:**
> "Like the latest post from sundarpichai"

**Comment on a post:**
> "Comment 'Great insights!' on that post"

**Search posts:**
> "Search LinkedIn for posts about 'artificial intelligence'"

---

### 🔧 Utility Tools (3 tools)

**Server info:**
> "What LinkedIn MCP tools do you have available?"

**Health check:**
> "Is the LinkedIn MCP connection working?"

**Notifications:**
> "Show me my LinkedIn notifications"

---

## Troubleshooting

### "Authentication error" when calling tools

```bash
# Check your auth status
npx -y linkedin-mcp-tools --status

# Re-login if needed
npx -y linkedin-mcp-tools --login
```

### Cookie expired

LinkedIn cookies typically last 6-12 months. If you get auth errors:

1. Get a fresh `li_at` cookie from your browser
2. Run `npx -y linkedin-mcp-tools --login` and paste the new cookie

### Claude Desktop not detecting the server

1. Verify config file location:
   - **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
2. Make sure `npx` is in your PATH
3. Restart Claude Desktop completely

### Rate limiting

The server includes built-in rate limiting (30 requests/minute by default). If you hit limits:

```bash
# Increase the limit via env var
RATE_LIMIT_RPM=60 npx -y linkedin-mcp-tools
```

---

## Need Help?

- 🐛 [Report a bug](https://github.com/devag7/linkedin-mcp/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/devag7/linkedin-mcp/issues/new?template=feature_request.md)
- ⭐ [Star the repo](https://github.com/devag7/linkedin-mcp) to support the project!
