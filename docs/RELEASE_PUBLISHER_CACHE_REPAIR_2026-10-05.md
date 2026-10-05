# Release publisher cache repair — October5, 2026

Core3.0.0 remains22 tools,15 package files and the previously reviewed runtime.
The owner replaced the encrypted Actions secret at11:48:29UTC. Automated
[run37305417071](https://github.com/devag7/linkedin-mcp/actions/runs/37305417071)
passed all six Linux/macOS/Windows Node20/22 compatibility jobs but stopped before
authentication at the isolated publisher's audit: high-severity
[GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp),
http-cache-semantics4.2.0. That run did not exercise the replacement token; its
subsequent actual publication attempt and separate authentication failure are
recorded below.

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


## Final hosted verification and integration

Final review also covered direct stale-while-revalidate and stale-if-error paths.
PR #6 final head `cbb65369a7bc5ee8e7caa1f159352595cb6c425b` passed
[all12 PR checks](https://github.com/devag7/linkedin-mcp/actions/runs/37307796316)
and the [ten-job release dry run](https://github.com/devag7/linkedin-mcp/actions/runs/37307834907).
The downloaded15-file archive matches every approved shipped byte and SHA256
`bba2d6b40d1ea18944588347dcd11490641fc3190e7a084988f81fa17ea74239`.
Merge `5640dfaa6a05533143f3130b0663806378ac0afa` has the identical reviewed tree;
[main CI](https://github.com/devag7/linkedin-mcp/actions/runs/37308641622) passes12/12.

The [actual integrated release](https://github.com/devag7/linkedin-mcp/actions/runs/37308641551)
passed this publisher's audit and real cache assertions, all six compatibility
jobs and source/package gates, then failed npm publication with `EOTP` using the
replacement token. This authentication failure is independent of the repaired
cache blocker. All four3.0.0 destinations remain absent in post-failure read-back.
No audit was disabled, artifact enlarged, LinkedIn account accessed or security
policy weakened. See [final release evidence](RELEASE_READINESS_3.0.0.md#replacement-token-result-and-final-source--october5-2026).
