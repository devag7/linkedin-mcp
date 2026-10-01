# Reproducible 3.0.0 walkthrough

Scope: actual SDK process/configuration calls plus a synthetic job response.
No Chrome launch, LinkedIn account request, private profile or live listing.
The procedure is reproducible; runtime observation times and preview tokens vary.

Use the exact reviewed source SHA or verified release tag, Node 20/22 and npm:

```sh
npm ci
npm run build
npm run verify:package
npm run verify:setup
npm run demo:offline
npm run demo:brief
```

For a 90-second free terminal recording:

1. Show `node dist/index.js --version`, the source SHA and Node/OS versions.
2. Show the offline installed-entry/config verifier's three passing client flows.
   It uses disposable fixtures and redacts configuration paths from public output.
   These are SDK tests, not native Claude/Cursor UI claims.
3. Show cold status, disabled writes, local preview, synthetic checkpoint refusal
   and close from `demo:offline`. Do not display a real profile or a real token.
   Its issued token is disposable and confined to the terminated demo process.
4. Run `demo:brief`: display its **synthetic** label, source-linked job comparison,
   fetch time, unknown fields, partial metadata and request counters. The fixture
   URLs are illustrative; do not open them or call them observed live listings.
5. Explain the one-search/one-detail/three-attempt limit and distinguish provider
   attempts from browser navigation/assets. Finish with no saving or sending.

Expected assertions: 23 discovered tools; cold session `not_checked`; writes
false; blocked read `CHECKPOINT` (or the verifier's documented persisted-stop code);
brief JSON and MCP text agree; data/meta statuses agree; each fact's exact URL and
fetch time match its source; at most three attempts/two read-tool calls; clean
SDK/runtime closure. Automated gates verify these behaviors; a recording alone
is not a regression test. Keep demo output under a synthetic evidence label.

A live recording needs separate account and content-sharing consent. The pending
job-brief protocol authorizes no public raw output. Use only its redacted timing,
status/count and source-validation summary after the user answers that request.
