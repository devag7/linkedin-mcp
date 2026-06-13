# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.4] - 2026-06-13

### Changed — Honesty Audit

Live testing confirmed that all data tools fail against LinkedIn due to Cloudflare bot-management (302 redirect loops that plain HTTP cannot resolve). This release corrects all false/misleading claims across the project.

#### Documentation Corrections
- **README:** Removed "most reliable" tagline. Added Cloudflare limitation warning at top. Added "Known Limitations" section documenting Cloudflare blocking, OAuth dead code, and raw response format. Rewrote comparison table to be truthful (competitor's browser-based approach passes Cloudflare; ours doesn't).
- **package.json:** Description changed from "most reliable" to honest summary with Cloudflare note.
- **mcp-manifest.json:** Both `description_for_model` and `description_for_human` corrected.
- **AGENTS.md:** Added Cloudflare limitation warning. Corrected architecture claims (OAuth has 0 call sites, not "experimental"). Fixed `health_check` description.

#### Code Corrections
- **`whoami` tool:** Added `note` field to capabilities: "Cloudflare bot-management may block requests on some networks."
- **`health_check` tool:** Description now states it checks basic linkedin.com reachability, NOT Voyager API access. Explicitly warns that linkedin.com may be reachable while API calls are blocked.

## [1.0.3] - 2026-06-13

### Fixed

#### Critical
- **Cloudflare 302 cookie-bounce now handled.** All data tools were failing against live LinkedIn because Cloudflare's bot-management returns a 302 redirect with `Set-Cookie: __cf_bm`. Node `fetch()` auto-followed without capturing the cookie, causing an infinite redirect loop → "fetch failed" after 29s. Now uses `redirect: 'manual'` and a persistent cookie jar to capture and resend `__cf_bm`, `lidc`, `bcookie`, etc.
- **CSRF token (`LINKEDIN_CSRF_TOKEN`) is now required** for cookie authentication. Previously, a fabricated `ajax:<timestamp>` was used as placeholder when CSRF was missing — LinkedIn rejects this. Now throws a clear error with instructions to copy the `JSESSIONID` cookie.

#### Moderate
- **Cookie validation (`validateCookie`) also fixed** for Cloudflare bounces — uses `redirect: 'manual'` and captures Set-Cookie during validation.
- **429 rate limit no longer retried 3x** — immediately surfaces the error with the `retry-after` value.

### Changed
- `LINKEDIN_CSRF_TOKEN` marked as **required** in README, `.env.example`, and env var table.
- Cookie auth instructions now include step to copy `JSESSIONID` cookie.
- HTTP client uses `redirect: 'manual'` for all requests (enables cookie jar to work).

### Tests
- Added Cloudflare 302 bounce test (302 → capture Set-Cookie → retry with cookies → 200).
- Added too-many-redirects test (5+ bounces → clear error).
- Added cookie jar merge test (auth cookies preserved, jar cookies appended).
- Added CSRF-required test (missing CSRF → throws with instructions).
- 53 total tests, all passing.

## [1.0.2] - 2026-06-13

### Fixed

#### Critical
- **HTTP transport now shares rate limiter and cache across requests.** Previously, each POST to `/mcp` created a brand new `McpServer`, `AuthManager`, `LinkedInClient`, `RateLimiter`, and `Cache`, making rate limiting and caching completely useless in HTTP mode. Now uses `SharedDependencies` pattern to persist state across requests.
- **`search_people` filters (`connectionOf`, `network`) now work.** These parameters were accepted by the schema but silently ignored — the URL was built manually without using them. Now correctly wired into the Voyager API query.
- **OAuth documentation corrected.** All 36 tools use LinkedIn's internal Voyager API which requires cookie auth. OAuth is now clearly marked as experimental for future REST API tools.

#### Moderate
- **Version consistency.** `VERSION` constant now reads from `package.json` at runtime instead of a hardcoded string. MCP `initialize`, `whoami`, and `health_check` all report the correct version.
- **CORS origin is now configurable** via the `CORS_ORIGIN` environment variable. Previously hardcoded to `*` (wildcard), which allowed any website to make requests to the server. Defaults to `http://localhost:{port}`.
- **HTTP transport body size limit.** Added 1MB maximum request body size with proper 413 response. Previously, unbounded request bodies could exhaust server memory.

#### Minor
- **`whoami` category counts corrected** from `feed (5 tools)` / `utility (3 tools)` to `feed & content (6 tools)` / `utility (2 tools)`.
- **Removed dead `visibilityMap` code** in `create_post` that mapped each value to itself.
- **Updated User-Agent** from Chrome 120 (Dec 2023) to Chrome 131 (current) in both HTTP client and cookie validation to reduce bot detection risk.

### Changed
- `create_post` tool description updated from "text or image post" to "text post" (image posts not yet supported).
- README comparison table corrected: auth methods listed as "Cookie (all 36 tools)" instead of "OAuth 2.0 + Cookie".
- `createServer()` now accepts optional `SharedDependencies` parameter for HTTP transport reuse.
- Exported `VERSION` constant and `createSharedDependencies()` from server module.

### Added
- `CORS_ORIGIN` environment variable in config schema.
- 7 new unit tests (VERSION validation, SharedDependencies, shared deps reuse, package.json version sync).
- 49 total tests across 3 test suites (up from 42).

## [1.0.0] - 2026-06-08

### Added

#### Core
- MCP server with Streamable HTTP and stdio transport
- TypeScript codebase with strict mode
- Zod schema validation for all tool parameters
- Structured JSON logging to stderr

#### Authentication
- Cookie-based authentication (li_at + CSRF) — works with all 36 tools
- OAuth 2.0 support (experimental — for future official REST API tools)
- Unified AuthManager with automatic method detection
- Cached credential validation (5-minute TTL)

#### Tools — Profile (7)
- `get_profile` — Get any LinkedIn profile with full details
- `get_my_profile` — Get authenticated user's profile
- `get_profile_skills` — Skills with endorsement counts
- `get_profile_recommendations` — Recommendations given/received
- `get_profile_activity` — Recent posts and activity
- `get_sidebar_profiles` — "People also viewed" suggestions
- `search_people` — Search with keyword, location, company filters

#### Tools — Messaging (6)
- `get_inbox` — List inbox conversations
- `get_conversation` — Read conversation thread
- `search_conversations` — Search messages by keyword
- `send_message` — Send message (native multiline support)
- `reply_to_thread` — Reply to existing thread
- `mark_conversation_read` — Mark conversation as read

#### Tools — Company (5)
- `get_company` — Company profile and details
- `get_company_posts` — Company feed posts
- `get_company_employees` — Employee listing with filters
- `search_companies` — Search companies by keyword
- `get_company_jobs` — Open positions at company

#### Tools — Jobs (4)
- `search_jobs` — Search with keyword and location
- `get_job_details` — Detailed job posting info
- `get_saved_jobs` — User's saved/bookmarked jobs
- `get_job_applicants` — Applicant info (recruiter)

#### Tools — Network (6)
- `connect_with_person` — Send connection request with note
- `get_connections` — List 1st-degree connections
- `get_pending_invitations` — Sent/received invitations
- `withdraw_invitation` — Cancel sent invitation
- `accept_invitation` — Accept received invitation
- `get_network_stats` — Network growth metrics

#### Tools — Feed & Content (6)
- `get_feed` — Home feed posts
- `create_post` — Create text post
- `react_to_post` — React (like, celebrate, etc.)
- `comment_on_post` — Add comment
- `search_posts` — Search by keyword/hashtag
- `get_notifications` — Recent notifications

#### Tools — Utility (2)
- `whoami` — Server info, auth status, capabilities
- `health_check` — Health and connectivity status

#### Infrastructure
- Token bucket rate limiter with burst support
- LRU cache with TTL expiration
- Retry with exponential backoff
- Multi-stage Docker build (~50MB image)
- Docker Compose for self-hosting
- GitHub Actions CI (lint, typecheck, test, build)
- 42 automated tests across 3 test suites
