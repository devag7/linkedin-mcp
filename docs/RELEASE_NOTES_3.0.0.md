# LinkedIn MCP 3.0.0

A safer local research workflow with guided offline setup and source-linked job
briefs. 23 tools use local stdio by default; no hosted service or paid integration
is required. This is an unofficial LinkedIn integration with account risk.

**Upgrade action:** regenerate your client configuration and read the
[migration guide](../SETUP_GUIDE.md#migrating-from-203-to-300). Writes now default
to disabled and require a server-issued five-minute preview token for every new
submission, exact matching inputs and explicit human approval in the client.
Journal lookup preserves known/unknown outcomes across timeout/restart without
resubmitting. HTTP requires a loopback connection and bearer authentication.

`research_jobs` combines one job search with at most one detail read. Every fact
has its source URL, tool and observation time; missing fields and partial results
stay visible. It allows at most three explicit Voyager attempts including cold
identity, with no retry, automatic pagination, saving or inferred job fit. Ordinary
browser navigation/assets are outside that counter.

Other corrections include alias-safe logout, actionable broken-profile diagnosis,
contradictory-page handling, job/source identity matching, exact 15-file archives,
and independently verified publishing destinations with an interrupted-release
resume path. See [release readiness](RELEASE_READINESS_3.0.0.md) for exact builds,
tests, destination states and pending consented validation.

Offline CI covers Node 20/22 on Linux/macOS/Windows, installed SDK/config flows and
Chrome lifecycle. It does not prove live LinkedIn compatibility, native desktop
chat, Windows NTFS privacy or Docker runtime. Coordinated erasure and native ACL
proof remain open. Official OAuth is unavailable; new-thread writes remain
experimental. GitHub stars and daily Trending are measured ambitions, not results.
