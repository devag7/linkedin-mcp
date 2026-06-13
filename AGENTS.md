# LinkedIn MCP Server — AI Agent Instructions

> This file helps AI assistants understand and use this project effectively.

## What This Project Is

**linkedin-mcp-tools** is a Model Context Protocol (MCP) server that gives AI assistants (Claude, Cursor, Windsurf, etc.) full access to LinkedIn. It provides 36 tools across 7 categories.

## Installation

```bash
npx linkedin-mcp-tools --login    # One-time credential setup
npx linkedin-mcp-tools            # Start the server
```

## How to Use in Claude Desktop

Add to `claude_desktop_config.json`:

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

## Available Tools

### Profile Tools
- `get_profile` — Get a LinkedIn profile by username
- `get_my_profile` — Get the authenticated user's profile
- `get_profile_skills` — Get skills with endorsement counts
- `get_profile_recommendations` — Get recommendations
- `get_profile_activity` — Get recent posts by a user
- `get_sidebar_profiles` — Get "People also viewed" suggestions
- `search_people` — Search for people on LinkedIn

### Messaging Tools
- `get_inbox` — List inbox conversations
- `get_conversation` — Read a specific conversation
- `search_conversations` — Search messages by keyword
- `send_message` — Send a message to a user
- `reply_to_thread` — Reply to an existing conversation
- `mark_conversation_read` — Mark conversation as read

### Company Tools
- `get_company` — Get company profile
- `get_company_posts` — Get company's recent posts
- `get_company_employees` — List employees
- `search_companies` — Search for companies
- `get_company_jobs` — Get open positions

### Jobs Tools
- `search_jobs` — Search jobs by keyword, location
- `get_job_details` — Get detailed job information
- `get_saved_jobs` — Get saved/bookmarked jobs
- `get_job_applicants` — Get applicant info (recruiter)

### Network Tools
- `connect_with_person` — Send connection request
- `get_connections` — List 1st-degree connections
- `get_pending_invitations` — View pending invitations
- `withdraw_invitation` — Cancel sent invitation
- `accept_invitation` — Accept connection request
- `get_network_stats` — Network growth metrics

### Feed & Content Tools
- `get_feed` — Get home feed posts
- `create_post` — Create a new post
- `react_to_post` — React to a post (like, celebrate, etc.)
- `comment_on_post` — Add a comment to a post
- `search_posts` — Search posts by keyword
- `get_notifications` — Get recent notifications

### Utility Tools
- `whoami` — Server info and capabilities
- `health_check` — Check server and LinkedIn connectivity

## Architecture

- **API-based**: Uses LinkedIn Voyager/REST API, not browser scraping
- **Stateless**: Each request is independent, no session management needed
- **Transport**: Supports stdio (local) and Streamable HTTP (remote)
- **Auth**: Cookie-based authentication (all 36 tools); OAuth experimental
- **Persistent credentials**: Saved to `~/.linkedin-mcp/credentials.json`

## Development

```bash
git clone https://github.com/devag7/linkedin-mcp.git
cd linkedin-mcp
npm install
npm run dev         # Development mode
npm test            # Run tests
npm run build       # Production build
```
