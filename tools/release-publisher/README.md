# Isolated release publisher

The release job uses npm 12.2.1 on hosted Node 22 (at least 22.22.2). Its OIDC
exchange writes credentials only to process configuration and reports failures
without logging credentials. This installation never enters the 15-file package.

The original three bundled upstream dependencies required reviewed updates. Ordinary npm overrides
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
immutable cookies. The same prohibition covers direct stale-while-revalidate
decisions and stale-if-error fallback during revalidation. Ordinary cache
expiry/max-stale and permitted stale-error behavior still delegates to
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
the application. The October6 owner instruction supersedes the earlier token-mode recovery:
`NPM_PUBLISH_AUTH=oidc` only, no npm token/OTP/fallback. Publication waits for
confirmation that the saved Trusted Publisher workflow is `release.yml` only.
No parallel manual publication is permitted.

Advisories: [brace-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr),
[ip-address](https://github.com/advisories/GHSA-rpw4-54j3-4h4q),
[undici](https://github.com/advisories/GHSA-3wwx-pv8p-q78v).


October6: the fresh publisher audit also reports moderate
[postcss-selector-parser CPU exhaustion](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)
in bundled7.1.4. A fifth locked upstream replacement uses patched7.1.6, with
identical cssesc/util-deprecate dependency requirements and the same pre-mutation
version, identity, integrity and directory-alias validation. The disposable audit
lock records the actual7.1.6 bytes. No npm auth code or audit threshold changes.
The failed original audit and subsequent actual installer result are retained in
[dependency repair evidence](../../docs/DEPENDENCY_REPAIR_3.0.0_2026-10-06.md).


October 26: fresh ip-address/undici advisories make the baseline real installer
fail its final audit. Locked replacements advance to 10.7.5 and 6.29.1, retaining
exact old/new identity/version/integrity and dependency checks, lock rewriting
and the cache-policy guard. The repaired actual Node 24 installation passes a
zero production audit and reports npm 12.2.0. The raw blueprint describes npm's
original bundled modules and is not an installed-publisher audit. Baseline and
repaired installation outputs are preserved in the [security repair evidence](../../docs/SECURITY_REPAIR_2026-10-26.md).
No authentication, OIDC-only policy or publication permission changes.

November 4: the installed CLI audit started failing on two moderate advisories
published October 30 in npm's bundled glob and minimatch:
[glob AbortSignal bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
(fixed in 14.0.2) and
[minimatch globparts DoS](https://github.com/advisories/GHSA-g3hv-75wg-m249)
(fixed in 11.0.1). No npm release bundles either fix yet; npm 12.2.1 still
requires minimatch ^10.2.5 and glob ^13.0.6. The publisher moves to npm 12.2.1,
whose own bundle already includes the earlier brace-expansion 5.0.12,
http-cache-semantics 4.3.0 and postcss-selector-parser 7.1.6 fixes, so those
three replacements are retired. Locked replacements are now ip-address 10.7.5,
undici 6.29.1, minimatch 11.0.4, glob 14.0.3 and path-scurry 3.0.0, plus the
new minimatch dependency @isaacs/nonrecursive-glob-match 1.0.3 copied into the
bundle (refused if npm already ships it).

minimatch, glob and path-scurry are **major** replacements that npm has not
shipped together. Their changed dependency requirements must match a reviewed
table exactly; any other replacement must keep identical requirements. After
patching, every replaced or added module must resolve satisfying versions of its
dependencies inside npm's own bundle, using npm's bundled semver. The
http-cache-semantics guard is unchanged: npm 12.2.1's file has the same reviewed
SHA-256. npm calls glob only through `glob()`/`globSync()`, whose array results
are unchanged in glob 14. Publication passes an already packed tarball, so npm's
own file selection is not used to choose published bytes. Local evidence and
smoke results are in the [November 4 publisher repair](../../docs/SECURITY_REPAIR_2026-11-04.md).
Remove these majors once an npm release bundles fixed versions.
