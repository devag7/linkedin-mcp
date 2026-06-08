# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
