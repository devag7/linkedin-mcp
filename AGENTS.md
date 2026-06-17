# AGENTS.md

Guidance for AI agents using or contributing to **LinkedIn MCP**
(`linkedin-mcp-tools`).

## What this is

An MCP server exposing LinkedIn to any MCP client (Claude, Cursor, …) as
structured JSON. It drives a real stealth Chrome to pass Cloudflare, then calls
LinkedIn's Voyager API from inside the authenticated page. 22 tools.

## Using it (as an agent / MCP client)

1. The human runs the one-time login: `npx -y linkedin-mcp-tools@latest --login`.
2. Configure the MCP server: command `npx`, args `["-y","linkedin-mcp-tools@latest"]`.
3. Call tools. Reads return structured JSON. **Writes require `confirm: true`** and
   count against daily safety caps — only call them when the user explicitly asks,
   and surface the returned `status` (`ok` / `duplicate` / `already_connected` /
   `restricted` / `quota_exhausted` / `not_allowed` / `failed`) back to the user.
4. Check `health_check` if a call fails — it reports login state, a live API probe,
   and remaining daily budget.

### Tool map

- Profiles: `get_my_profile`, `get_profile`
- Search: `search_people`, `search_jobs`, `get_job_details`, `search_companies`,
  `get_company`, `get_company_posts`, `get_company_employees`
- Feed/messaging: `get_feed`, `get_notifications`, `get_inbox`, `get_conversation`,
  `get_pending_invitations`
- Writes (gated): `connect_with_person`, `send_message`, `create_post`,
  `react_to_post`, `comment_on_post`
- Session: `whoami`, `health_check`, `close_session`

## Safety expectations

Automating LinkedIn can get an account restricted — there is no ban-proof tool.
Default to a secondary account, respect the built-in daily caps, never disable
pacing for real use, and stop immediately if `health_check` reports a checkpoint.

## Contributing (code agents)

- TypeScript, strict. `npm run build` (tsup), `npm run typecheck`, `npm test`
  (vitest), `npm run lint` (eslint) — all must pass; CI enforces them.
- Voyager endpoints rotate. Write endpoint shapes are captured live via
  `--writecapture` (intercept the SPA's POST, abort it — zero side effects) and
  verified via `--writeprobe`; do not guess payloads.
- Version is single-sourced from `package.json` (`src/version.ts`). Releases are
  automated on push to `main` when the version bumps (see `.github/workflows`).
