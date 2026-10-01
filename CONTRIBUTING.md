# Contributing

Read [AGENTS.md](AGENTS.md), the [technical roadmap](PRODUCT_TECHNICAL_ROADMAP_2026.md)
and [current evidence](docs/ROADMAP_PROGRESS.md). Keep changes reviewable and
preserve user work. Use TypeScript with strict types. The active runtime is
`src/server.ts` → browser/guard/tools; v1 auth/client/middleware code is isolated
and does not provide a shipped OAuth adapter.

Install with `npm ci`. Normal development and tests never need a LinkedIn account
or a browser launch. Before submitting code, run:

```bash
npm run metadata:check
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:package
```

Tests must replace provider work with redacted synthetic fixtures. Label fixtures
as synthetic or consented live captures, recording schema, locale/state, capture
date and verification scope. Do not label a hand-written fixture a capture.
Never commit cookies, tokens, real member IDs or message/profile text.

To change a tool, use `src/tools/register.ts` for native output schemas,
annotations and registration tracking; update `contracts.ts`, `capabilities.ts`,
and protocol cases in `tests/contracts.test.ts`. Generate metadata with
`npm run metadata:sync`. Maintain text JSON for existing clients, error codes,
explicit partial state, bounded results and one-page calls. Do not invent a
continuation token or silently crawl. Profile fanout is explicitly bounded.

Voyager endpoints are undocumented. Preserve existing write payloads unless a
consented `--writecapture` proves the current shape; probe only an exact action
explicitly approved by the account owner. Manual live writes are excluded from
normal CI. A rejection alone does not establish that a new-thread route works.
Checkpoints stop automation; corrupt safety state fails closed. Do not add mass
outreach, pacing bypasses, automated challenge solving or automatic retries.

PR descriptions should explain the problem/result, verification, remaining
limitations and rollback. The package version is single-sourced from package.json.
Publishing is separate from local implementation: main-branch version bumps can
trigger release automation. Do not claim publication or a hosted matrix result
until it actually happened. Report any failing gate with exact scope.

Useful contributions: consented locale/browser fixture coverage, supported-client
first-use evidence, accessible troubleshooting, and bounded research examples.
An issue should describe a user problem and evidence rather than a growth promise.

For release or browser changes, run `npm run verify:browser` with installed Chrome.
It uses an empty temporary profile and local content; it does not log in or open
LinkedIn. Review [release/dependency evidence](docs/ZERO_COST_EXECUTION_EVIDENCE_2026-10-01.md)
before publication. Normal fixture tests disable the Vitest API; do not expose
mock/browser/build-tool development servers.
