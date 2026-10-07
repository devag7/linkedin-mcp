# Core 3.0.0 SDK repair — October 7, 2026

## Scope and dependency policy

Separate repair from `efd3b53ffd8416c68ef703069d883ee1371cb533` after the fresh
production audit failed with one high [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h).
The shipped direct dependency is raised from `^1.12.1` to `^1.31.0`; the lock
selects exactly1.31.0, exercising the minimum supported patched version.
Only the root dependency range and SDK package lock entry change. Existing
transitive versions, including proxy-addr2.0.8, remain intact. No override,
lockfile-only fix, audit suppression or forced audit fix is used. Version stays
3.0.0, with22 tools and15 exact regular-file package entries; PR #5 is excluded.

## Upstream API and behavior review

Published registry metadata supplies source commits: old1.29.0
`e12cbd7078db388152f6e839abdbe09ba01f3f32`, new1.31.0
`4b0051f400219f8d8855f9a5433c6df35f15a639`. Review uses the
[actual source comparison](https://github.com/modelcontextprotocol/typescript-sdk/compare/e12cbd7078db388152f6e839abdbe09ba01f3f32...4b0051f400219f8d8855f9a5433c6df35f15a639)
and both published package contents, rather than unavailable guessed release URLs.
Export mappings and Node>=18 engine stay unchanged. The only upstream dependency
range change widens @hono/node-server to allow patched2.x; our compatible1.x lock
is unchanged. This project continues to require Node>=20.

| Change | Local integration / migration impact |
| --- | --- |
| OAuth credentials now carry/check authorization-server issuer | This project uses MCP server transports; fixture/demo clients use stdio or in-memory transport, without OAuth providers. The advisory excludes servers and stdio clients. No application exploit or credential reset is inferred, but the zero-production-audit requirement still blocks the affected SDK. Any separate HTTP OAuth consumer must follow upstream issuer/provider migration guidance. |
| Stdio read buffer defaults to10MiB and closes on overflow | Existing constructor calls remain compatible. Oversized inbound stdio requests may now close the transport; do not automatically retry writes with unknown outcomes. Installed SDK discovery/cold diagnosis/setup flows pass. |
| Parsed HTTP media types, bounded request bodies/batches | Project HTTP wrapper already authenticates loopback callers, enforces its stricter1MiB body ceiling and supplies parsed bodies. Existing hostile-boundary/lifecycle tests pass; no loosening of limits. |
| SSE keep-alive frames/timer cleanup and closed-session handling | HTTP wrapper uses enableJsonResponse:true, closes each request transport and disposes shared resources. Existing HTTP teardown tests pass; no SSE/live-provider interoperability claim. |
| Zod issue paths/error formatting and3.25 method-literal support | Application contracts use structured statuses, not exact upstream error strings. Typecheck, metadata validation and SDK contract cases pass without source/API changes. |

No application TypeScript source or test assertion was modified to accommodate
the upgrade. Existing531 tests/28 suites pass unchanged under locked SDK1.31.0.
Installed consumer flow additionally exercises public compatible SDK1.32.1.
These are offline compatibility checks; they do not prove live LinkedIn reads,
native client chats, Windows NTFS privacy or first-use cohorts.

## Fresh consumer gate

Each package verification installs the actual tar into a disposable project
without inherited repository lock/overrides. It checks every root/nested SDK
installed package version against its generated lock and requires>=1.31.0;
proxy-addr is checked the same way and requires>=2.0.8. Stable numeric versions
only; prereleases are rejected. The shipped range is asserted to be^1.31.0.
Consumer production audit must be zero before SDK/configuration smoke checks.
Observed current public resolution: SDK1.32.1, proxy-addr2.0.8, audit0,22 tools.
Existing consumer locks still need their own supported dependency update/audit.
Private registries and future dependency releases are not certified by this run.

## Remaining development finding — separate from production

Full audit exits1 for one low [esbuild GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr),
locked0.27.7 via tsup8.5.1; patched0.28.1 is outside tsup's supported^0.27.0
range. The mechanism requires the Windows esbuild HTTP development server with
servedir and backslash paths. Current build is trusted local one-shot tsup,
without serve/servedir/watch; Vitest runs Node fixtures, not a hosted file server.
The CLI/production consumer does not ship esbuild. No claim that upstream is
fixed, arbitrary contributor development servers are safe, or full audit is zero.
Supported tsup update or separately reviewed build migration follow-up: October8.
No unsupported override or audit-threshold weakening is introduced.

## Evidence and release gates

Local: clean locked installation,531 tests, lint, typecheck, metadata, build,
exact package/installed SDK/setup checks and synthetic demo pass. Application
production, fresh consumer and actual freshly installed isolated npm12.2.0
publisher audits report zero. Publisher cache guard assertions remain active.
All gate logs, raw audits, upstream metadata/source comparison and archive bytes
are preserved in the private sdk-repair-2026-10-07 backup. Exact archive SHA256:
`c79f78e5e77814febb3f68ab9a391ef860515bcfd2d6f97001eadd6e00f58fe5`.

Required next gates before merge: reviewed final diff, hosted OS/Node matrix,
exact release dry run and independently downloaded artifact equality. Record
actual run IDs/head/main SHA in the PR and separate evidence receipts after they
finish; pending runs are not evidence of success. Keep release workflow disabled
through merge until integrated source/artifact/fresh audits pass. Owner confirms
saved npm binding release.yml only; then restore the existing workflow and
attempt OIDC-only publication once. Stop on new failure, no token fallback.
Independently verify npm bytes/integrity/provenance, public scoped artifact,
active Registry metadata and exact finalized GitHub Release/tag.

Preserve original candidate/archive,57 sync copies,pr_diff and all backups.
No LinkedIn requests. P7 first-use/P8 erasure/Windows privacy stay open.
Required cash$0; existing monthly dependency/publisher review and per-release
fresh audit/consumer gates remain necessary.10,000 stars/Trending are measured
ambitions, not promised outcomes.
