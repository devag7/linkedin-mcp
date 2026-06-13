# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0-alpha.1] - 2026-06-13

Complete rewrite of the data layer. v1 returned **zero data** in practice:
LinkedIn fronts the Voyager API with Cloudflare bot-management that rejects
stateless `fetch`/`curl` (endless 302 redirect even with a valid cookie).

### Changed — architecture
- **Stealth browser engine** ([patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright),
  an undetected Playwright fork) clears the Cloudflare challenge with a real
  browser fingerprint.
- **In-page Voyager fetch**: queries run inside the authenticated, challenge-passed
  page (same-origin, the exact path LinkedIn's web app uses) → structured JSON,
  not scraped DOM. Locale-independent, resilient to UI redesigns.
- One persistent browser per process; signal-handled teardown + process reap.

### Added — safety/reliability layer (130+ unit tests)
- Serial queue, human-paced jittered delays, per-action daily budgets, account
  warmup ramp, pending-invite ceiling, and a circuit breaker that hard-stops on
  any checkpoint/captcha/rate-limit (never auto-solves a challenge).

### Added — tools (live-verified)
- `get_my_profile`, `get_profile` (name, headline, summary, experience, education)
- `get_feed`, `get_notifications`, `search_jobs`, `get_inbox`, `get_conversation`
- `whoami`, `health_check`, `close_session`

### Added — CLI
- `--login` (headful interactive), `--spike` (verify), `--capture` (record live
  Voyager endpoints), plus `--status` / `--logout`.

### Removed
- v1's stateless Voyager tools (proven 0-data). OAuth path (backed no working
  tool). False README claims + the competitor comparison table.

### Notes
- Pre-release. Requires headful Chrome + a one-time `--login`. **No LinkedIn
  automation is ban-proof** — see [DISCLAIMER.md](DISCLAIMER.md).

## [1.0.0] - 2026-06-08

### Added

#### Core
- MCP server with Streamable HTTP and stdio transport
- TypeScript codebase with strict mode
- Zod schema validation for all tool parameters
- Structured JSON logging to stderr

#### Authentication
- LinkedIn OAuth 2.0 support with token validation
- Cookie-based authentication (li_at + CSRF)
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
