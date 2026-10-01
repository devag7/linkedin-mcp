# LinkedIn MCP 3.0.0 — core safety and guided setup

22 tools, local stdio, installed Chrome and manual login. Guided offline setup
exports client configuration for Claude Desktop, Cursor and VS Code. No mandatory
paid service or hosted deployment is required. Unofficial integration; account
restrictions remain possible.

**Upgrade:** regenerate your client configuration and read the
[migration guide](../SETUP_GUIDE.md#migrating-from-203-to-300). Writes default to
disabled. Every new enabled submission needs a five-minute server-issued preview
proof bound to the exact action/target/content/operation ID, plus explicit human
approval in the client. Prior journaled outcomes remain lookupable after timeout,
restart or token expiry; unknown outcomes never auto-retry. HTTP is authenticated
and loopback-only. Cold status/doctor/setup remain offline.

Other fixes: alias/junction-safe logout, actionable broken-profile setup diagnosis,
contradictory pagination remains uncertain without a next cursor, exact requested
numeric job identity before URL attribution, selected-job employer attribution,
strict 15-file packaging and verified
release destination/tag identity with a resume path.

Offline checks cover Node20/22 on Linux/macOS/Windows, installed SDK/configuration
flows and Chrome lifecycle. Current LinkedIn compatibility is unverified across
the tool set. Limited historical own-profile evidence is scoped in its execution
record; it is not a first-use cohort or full provider pass. The deferred feature
track's partial live result does not establish healthy job search/detail support.

Native first-use, coordinated erasure and Windows NTFS privacy proof remain open;
no broad promotion relies on those gaps. Docker runtime and official OAuth are
unverified/unavailable. New-thread messaging remains experimental. Stars and daily
GitHub Trending are measured ambitions. No feature from PR #5 is part of3.0.0.
See [core release evidence](RELEASE_READINESS_3.0.0.md).
