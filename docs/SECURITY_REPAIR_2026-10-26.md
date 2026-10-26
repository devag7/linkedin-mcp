# Runtime and publisher dependency repair — October 26, 2026

## Baseline and decision

Main `ee337208990a0b2c8d1458f8ab6fa906bcc8b41f` and public core 4.1.1 are
unchanged. Their earlier zero-audit reports remain historical. Fresh source and
production audits now report four affected packages: two high and two moderate.
This draft repairs the source candidate; it does not publish or replace public
4.1.1. No account access, native installation, process exemption or paid service
is included. PR #5/#46 cleanup and usefulness blockers remain separate.

## Runtime changes

| Package | Before | Candidate | Evidence |
| --- | --- | --- | --- |
| Zod | 3.25.76; floor ^3.25.1 | 4.6.7; floor ^4.6.7 | [oversized collection advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), fixed from 4.6.6 |
| body-parser | 2.3.0 | 2.4.0 | [compressed-body DoS](https://github.com/advisories/GHSA-27r3-jxmh-p828) |
| fast-uri | 3.1.8 | 3.1.9 | [scheme spoofing](https://github.com/advisories/GHSA-w74x-v6f9-j3xg), [path equivalence](https://github.com/advisories/GHSA-xhq7-xmqj-769h), [host canonicalization](https://github.com/advisories/GHSA-wjr9-j795-jxcr), [suffix injection](https://github.com/advisories/GHSA-333x-w4r6-6crp) |
| ip-address | 10.7.2 | 10.7.5 | [quadratic zone parsing](https://github.com/advisories/GHSA-rxp7-6hxx-x8q5), fixed from 10.7.4 |

The lock also updates body-parser's compatible iconv-lite to 0.7.3 and qs to
6.16.1. Other runtime versions, including SDK 1.32.1, are retained. No forced
major update or override is applied to unrelated dependencies.

Zod 4 requires explicit record keys. Four source files now use
`z.record(z.string(), valueSchema)` for provider data, output contracts, circuit
state and shared budgets/journals. No `zod/v3` import is introduced. Existing
24-tool SDK contracts, cancellation, write previews, persistent stops, retirement
and budget round trips pass. The existing 10,000-element SDK input guard remains.
This is a reviewed library migration, not an audit-only manifest change.

## Publisher changes

The raw publisher blueprint includes npm's original bundled versions, which the
existing installer deliberately replaces after integrity/version/alias checks.
A raw blueprint audit is therefore not the actual installed-publisher audit.
The baseline real installer now fails its final audit on ip-address/undici;
its output is preserved. Replacement pins advance from 10.7.3 to 10.7.5 and
6.28.1 to 6.29.1. The real isolated Node 24 installer applies the exact reviewed
patches, retains its cache-policy guard, passes zero production findings and
reports npm 12.2.0. No authentication implementation or OIDC-only policy changes.
No token, OTP, workflow dispatch or publication is used in verification.

## Candidate gates and historical releases

Required CI now tests and audits the archive built from the current checkout.
`build:claude-mcpb -- --from-source` packages that exact current archive, verifies
24 tools/cold status/input guard before packing and after unpacking, and records
`sourceKind: checkout_candidate` with archive and bundle hashes. It is not proof
of an npm release. The default MCPB builder still verifies the fixed public
4.1.1 SHA-256 and enforces its zero production-audit gate; no exception is added.

Historical public 3.0.0/4.1.1 first-use observations are removed from required
candidate CI. Their verifier remains unchanged and available for explicit
published-release observations. Immutable old releases cannot pass the new Zod
audit; requiring them to pass would prevent validating their replacement. This
does not make either old release clear: its failed current audit remains a
release/distribution blocker. Candidate CI retains source audits, fresh candidate
consumer audits, exact 15-file checks, six real-browser jobs and two audited
candidate MCPB jobs. No audit threshold, timeout or cleanup rule is relaxed.
A new public version and independently verified destinations are still needed
before repinning the standalone Claude plugin or claiming current release
clearance.

## Verification and remaining work

The isolated candidate passed 768 tests with one platform fixture skipped, lint,
types, metadata, build, exact 15-file inventory and installed-package/client
checks. Full source and production audits pass with zero findings. The candidate
MCPB passed staged/unpacked cold checks and its production audit. The actual
patched publisher installation also passes its audit. Private reports preserve
baseline failures and new results; hosted exact-head checks and independent
review remain separate required gates.

The source package version stays 4.1.1 for this unreleased review checkpoint;
identify all candidate bytes by commit and archive hash, never by version alone.
Public release/tag/archive and MCPB bytes remain unchanged. First-use remains
unmeasured and no LinkedIn request was made. No full roadmap-completion claim is
made by this security repair.
