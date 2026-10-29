# Hono adapter source-lock repair — October 29, 2026

The source lock retained `@hono/node-server` **1.19.17**, which falls in
[GHSA-rmxm-3fg6-px4f](https://github.com/honojs/node-server/security/advisories/GHSA-rmxm-3fg6-px4f)'s
affected range (`>=1.19.10 <2.1.3`). The advisory concerns a second path decode
in `serveStatic`, allowing static-prefix middleware to be bypassed. It does not
describe traversal outside the configured static root. The
[upstream fix](https://github.com/honojs/node-server/commit/982179278529d5673812116b042829f27794966f)
guards this static-serving path.

## Repair scope

Only the adapter's lock entry changes to **2.1.5**, with its official npm URL,
integrity, engine and peer metadata. Every other package resolution and the
root package manifest/version remain unchanged. There are no overrides or new
direct dependencies. The existing SDK 1.32.1 range, `^1.19.9 || ^2.0.5`, permits
the selection; Node `>=20` and the locked Hono 4.13.12 satisfy its requirements.

This is source-installation maintenance. It does not change the published
4.2.0 archive, tag, runtime code, tool count or wrapper assets. No version bump,
merge, publication or account access is part of this repair proposal.

## Reachability and exposure

- The SDK's Streamable HTTP transport imports the adapter's `getRequestListener`.
  The dependency is present and used; it must not be described as wholly unused.
- The application uses Node HTTP and the SDK transport, with exact local routes
  and bearer/origin checks. No application source or SDK transport path reviewed
  here imports or registers the separate `serveStatic` middleware. The advisory's
  vulnerable static-file path was not identified as reachable in this application.
  This is a source inspection finding, not exploit validation or a general
  security guarantee.
- A fresh public 4.2.0 consumer resolved SDK 1.32.2 and adapter 2.1.5, with zero
  audit findings. Existing consumer lockfiles may still retain an affected
  adapter; this source-only repair does not update those installations.
- The isolated npm 12.2.0 publisher has no Hono entry in either its source lock
  or actual patched installation. Its fresh production audit found zero issues.

## Verification boundary

The baseline source audit found one moderate adapter issue. After the change,
full-source and production audits found zero. Local validation passed 823 tests
with one platform skip, lint, types, metadata and build. Exact normal and
ignore-scripts 15-file package checks, installed CLI/SDK, compiled material-draft
checks and three offline client-configuration checks passed with 24 tools and
zero browser launches or LinkedIn requests. Hosted results and the baseline vs
repair archive comparison are recorded separately in the draft PR's evidence.

The lockfile and this report are outside the package allowlist. A matching
baseline/repair archive does not imply that the current main checkout's archive
equals the older immutable public archive: later packaged documentation can
already differ. No native-client, provider, cohort, erasure or directory
acceptance is established. Mandatory maintainer service spend remains $0.
