# SDK security repair — October 21, 2026

The fresh full audit of main `09a28d2` exited 1: installed SDK 1.31.0 had one
high package finding covering four advisories. The original JSON is retained
privately; a later clean result does not replace it.

| Advisory | Vendor affected range | Vendor patch |
| --- | --- | --- |
| [GHSA-22jm-h49p-29qw](https://github.com/advisories/GHSA-22jm-h49p-29qw), experimental task/session binding | >=1.24.0 <1.32.0 | 1.32.0 |
| [GHSA-46jr-4wx8-v453](https://github.com/advisories/GHSA-46jr-4wx8-v453), validation resource exhaustion | >=1.3.0 <1.32.0 | 1.32.0 |
| [GHSA-6prh-2h8m-c8cw](https://github.com/advisories/GHSA-6prh-2h8m-c8cw), client cross-origin redirect disclosure | <1.32.0 | 1.32.0 |
| [GHSA-rvq5-wwqv-78pq](https://github.com/advisories/GHSA-rvq5-wwqv-78pq), bearer token audience | >=1.6.0 <1.32.0 | 1.32.0 |

These are vendor package findings, not proof that every advisory is reachable
through this project's enabled features. The repair requires `^1.32.1`, locks
1.32.1 and raises the fresh-consumer verifier's installed floor to 1.32.1.
No endpoint, identity validation, pacing or request limit is relaxed.

For validation resource exhaustion, the vendor explicitly says an upgrade
alone is insufficient. The production `McpServer` enables
`maxToolInputElements:10_000` before schema validation; the existing HTTP parser
keeps its 1 MiB body limit. A protocol regression submits an excessive array
inside that byte limit, verifies rejection before guard/provider work and then
verifies a normal cold call still succeeds. Existing maximum-size valid
application/export fixtures remain part of the full suite. No attempt is made
to reproduce a memory-exhaustion attack on a live service.

The 4.1.1 candidate also corrects current privacy documentation that still
called published 4.1.0 tools/retirement commands unreleased, and refreshes the
recorded offline contract date. The [complete scope audit](COMPLETION_AUDIT_2026-10-21.md)
lists all unfinished work. The original roadmap remains intact.

Source full audit after repair: zero findings. A fresh public 4.1.0 consumer
already resolved SDK 1.32.1 and had zero production findings; its signatures
verified (99 registry signatures, 15 attestations). The exact public 4.1.0
MCPB contains SDK 1.32.1. Existing installations retaining 1.31.0 still need
an update; a fresh resolution does not repair an existing user's lockfile.
Both the old package and its MCPB predate the new opt-in element guard. They
need the 4.1.1 runtime for that protection even when their installed SDK is
already 1.32.1. A 4.1.1 desktop bundle must be rebuilt from the verified patch
archive after publication; the 4.1.0 bundle is not patch-equivalent.

Local repair gates passed: 768 tests with one platform-specific skip, lint,
typecheck, metadata, build and installed-package verification. The fresh
15-file candidate exposes 24 tools, resolves SDK 1.32.1/proxy-addr 2.0.8 and
has zero production findings. The full source audit has zero findings.
Hosted and release gates remain pending at this snapshot.

Use the eventual public destination receipts for publication status; a version
in source or a dry run is insufficient.
