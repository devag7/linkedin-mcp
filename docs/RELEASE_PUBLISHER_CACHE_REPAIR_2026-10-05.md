# Release publisher cache repair — October5, 2026

Core3.0.0 remains22 tools,15 package files and the previously reviewed runtime.
The owner replaced the encrypted Actions secret at11:48:29UTC. Automated
[run37305417071](https://github.com/devag7/linkedin-mcp/actions/runs/37305417071)
passed all six Linux/macOS/Windows Node20/22 compatibility jobs but stopped before
authentication at the isolated publisher's audit: high-severity
[GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp),
http-cache-semantics4.2.0. The replacement token's publication ability has not
yet been exercised; this failure is distinct from the old token's `EOTP`.

## Scope and acceptance

Repair only private release tooling. Keep application dependencies, runtime,
version, exact archive, protected sync copies, PR #5 draft status and account
access boundaries unchanged. Require zero reported publisher production findings
and actual behavioral rejection of the advisory's cache-reuse cases. Never
disable audits or clear an advisory by version selection alone. Run source/package
gates, twelve PR checks and the existing ten-job release dry run at the repair
head before integration/publication. After integration, verify the resulting
source and artifact and each independent destination.

## Implementation and evidence

Locked official npm http-cache-semantics4.3.0 provides newer Vary/header fixes and
clears the advisory's reported <=4.2.0 range. It **does not fix the max-stale
behavior**: disposable synthetic shared-cookie and proxy-revalidate cases return
unsafe cached reuse on both4.2.0 and4.3.0. No network or account data is involved.
The advisory currently lists no patched version. See also the
[upstream report](https://github.com/kornelski/http-cache-semantics/issues/56).

A small publisher-only subclass requires synchronous revalidation for
non-storable/no-cache entries, shared proxy-revalidate and shared cookies without
explicit public opt-in, including immutable cookies. Ordinary reuse delegates to
upstream. Review also reproduced protected-entry reuse through direct
stale-while-revalidate and revalidation's stale-if-error fallback; both paths are
guarded and exercised against the real library, while ordinary stale-error reuse
remains allowed. The installer refuses unexpected upstream source bytes and aliases,
retains the exact locked original beside its wrapper, then exercises the real
guarded library through direct and serialized policies. Security-prohibited cases
refuse reuse; ordinary fresh/expired public entries preserve allowed max-stale.
This is an explicitly maintained local mitigation, not an upstream-fix claim.

Local source:531 tests/28 suites, metadata, lint, typecheck, build and installed
package/setup pass. Focused publisher/release suite:69 tests. Actual installer on
supported Node24.19.0 runs real policy assertions and reports zero production
findings with npm12.2.0. These checks do not establish LinkedIn compatibility or
successful publication. Hosted checks and artifact equality must be recorded from
their actual results rather than assumed.

Dependencies: existing public npm/GitHub infrastructure, supported hosted Node,
the owner's private secret and reviewed cache-guard source/hash. Required cash$0.
Maintenance: about2h/month for dependency/mitigation review, an audit and real cache
assertions every release, and removal after upstream behavior is verified fixed.
No mandatory hosting or paid integration is introduced. P7 first-use and P8
erasure/Windows privacy remain open; no broad promotion or Trending result follows
from this repair. Failure logs, before/after regression counts and protected hash
receipts remain in the existing private release backup.
