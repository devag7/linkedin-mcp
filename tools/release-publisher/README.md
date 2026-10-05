# Isolated release publisher

The release job uses npm 12.2.0 on hosted Node 22 (at least 22.22.2). Its OIDC
exchange writes credentials only to process configuration and reports failures
without logging credentials. This installation never enters the 15-file package.

Three bundled upstream dependencies required reviewed updates. Ordinary npm overrides
and `audit fix` do not replace bundled modules. The installer copies separately
integrity-locked upstream patches into a new disposable CLI installation, after
checking exact old/new versions, names, unchanged dependency requirements and
absence of directory aliases. It updates that installation's lock to describe
the actual tree and requires a clean production audit before using the CLI.
It changes no npm authentication implementation or application dependencies.

October5: the installed CLI audit started reporting high-severity
[http-cache-semantics max-stale disclosure](https://github.com/advisories/GHSA-ch52-4w7c-c8xp).
The fourth locked replacement is upstream4.3.0, but **its version alone does not
fix the reported unsafe reuse**: synthetic shared-cookie/proxy-revalidate cases
reproduce on both4.2.0 and4.3.0. A publisher-only subclass explicitly requires
synchronous revalidation for non-storable/no-cache responses, shared
proxy-revalidate and shared cookies without explicit public opt-in, including
immutable cookies. Ordinary cache expiry/max-stale behavior still delegates to
upstream. This is a local mitigation, not a claimed upstream security fix.

Before installing that guard, exact upstream source SHA256 is checked; unexpected
bytes or directory aliases stop installation. The original locked file remains
alongside the wrapper. Every real installer exercises the actual patched library
with prohibited and ordinary requests, including serialization/restart. Unit
tests exercise the guard and pre-mutation byte refusal. The guard never enters
the application archive and must be reviewed/removed when upstream resolves the
behavior. Allow about2h/month for publisher dependency and mitigation review.

Only publication invokes this CLI explicitly. Source, packaging and installed
SDK checks use the runner's existing npm: npm 12 changes the pack-report format.

Review pins and remove the patches when upstream fixes its bundle. Monthly
maintenance and an audit on every release are required; cash cost is $0. Updating
the CLI requires a fresh hosted release dry run. Do not install this tooling into
the application. OIDC remains preferred. The maintainer explicitly authorized
the existing token-mode workflow on October2; this overrides the prior tooling
guidance against token fallback, without disabling2FA or requesting secrets in
chat. No parallel manual publication is permitted.

Advisories: [brace-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr),
[ip-address](https://github.com/advisories/GHSA-rpw4-54j3-4h4q),
[undici](https://github.com/advisories/GHSA-3wwx-pv8p-q78v).
