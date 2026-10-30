# Vite development lock repair — October 30, 2026

The six source jobs in main CI `40933053318` stopped at their full dependency
audit for [GHSA-8g5g-mxqh-grgj](https://github.com/advisories/GHSA-8g5g-mxqh-grgj).
The advisory identifies Vite 6.4.4 as affected and 6.4.5 as patched. Its described
exposure requires a network-exposed Vite development server and particular
filesystem allow/deny conditions. This is a development dependency; the regular
MCP runtime and fresh-consumer production graphs do not install it. This scope
distinction does not waive the full source-audit gate.

The repair changes only the locked Vite entry's version, registry URL and integrity
to 6.4.5. The published manifests have identical dependency ranges, engines and
peer/optional dependency declarations. No other resolution, package.json field,
runtime code, project version, safety limit or provider route changes.

Actual `npm ci` installs 6.4.5 and the full source audit records zero findings.
The existing root range `^6.4.4` admits the patched lock; contributors should use
this reviewed lock rather than the older immutable release tag's development
lock. A discarded or deliberately downgraded lock is not covered by this proof.
There is no claim that every development-server configuration was live-tested.

Rebuilding with the repaired development tree preserves the exact public 4.4.0
15-file archive SHA-256
`df8ecf6fa8d4143bbc8625b1f8b494e5a3445667b9134f8a94e9db614e2cc1a8`.
The package version, public bytes, tag and earlier failed source audits remain
unchanged. Follow-up source/helper tests and hosted review checks are recorded
in the recovery PR; no new package publication is needed for this source lock.
