# Local Claude plugin candidate — October 22, 2026

## October 26 security and review update

The original `1c729f5` candidate passed all 14 hosted jobs, including macOS and
Windows plugin checks. Those results are historical. A fresh October 26 source
production audit now reports four affected packages (two high, two moderate),
including Zod 3.25.76; the pinned public runtime cannot currently meet the build's
zero-audit gate. Do not distribute this candidate as security-cleared or bypass
the audit. A separate reviewed runtime repair and replacement release are needed
before repinning the public wrapper. Public archive identity remains unchanged.

Independent review found the recursive template copy could include untracked
private files. The follow-up uses an exact four-file template allowlist and
rejects unexpected files or symlinks before copying. Four deterministic local
fixtures pass, including `.env` and nested private-file refusals. This changes
packaging only; it does not repair the runtime advisories.

## October 26 source integration checkpoint

This private integration preserves plugin head
`6f0942a7dc407439e6d80e5df74af865ccf8f7b2` and merges reviewed main
`c7d9af30508c0d2a7b69d5df033e784268089dcd` without rewriting history.
Main's repaired source dependencies do not change the plugin's immutable public
4.1.1 archive pin or template version. A replacement must first be published and
independently verified before the wrapper can be repinned and its package gates
rerun. No future archive is fetched or treated as verified here.

CI retains main's audited `--from-source` MCPB candidate build and the separately
audited public-runtime plugin build. The four template refusal fixtures run
before either package build, so a blocked public-runtime audit cannot hide their
result. The exact four-file template allowlist and all four fixtures are unchanged.
All four disposable built-in Node fixtures pass at this checkpoint; no full
suite, package build/audit, hosted dispatch, browser/native/account operation or
publication is claimed. Historical failed evidence remains failed. This source
integration is not permission to distribute the old wrapper as security-cleared.

## Scope

`packaging/claude-plugin` is a template for a local plugin containing the exact
public 4.1.1 runtime, its production dependencies and a job-preparation skill.
The builder verifies npm archive SHA-256
`3aa33f9a38e2928625f9a7d24d300b644102c87121dc0168766048e1cf7368ec`.
It does not build the runtime from this checkout or include experimental PR #5.
The plugin exposes the same 24 tools; runtime version and public release stay
4.1.1. The ZIP and its own checksum are separate artifacts from the npm archive
and the published MCPB.

## Build and verification

```sh
npm ci
npm run build:claude-plugin
```

Node 20+ and Python 3 must be on PATH. The script downloads and checks the pinned
public archive, installs production dependencies without lifecycle scripts,
requires zero production audit findings, removes installer metadata, and creates
a ZIP with Python's standard library. It refuses to overwrite an existing ZIP.
The build prints the output path and writes adjacent `.sha256` and
`.receipt.json` files. Keep receipts locally; no account information is needed.
Compatible dependency versions are recorded in the receipt. Later registry
resolution can change the ZIP hash; each candidate needs its own audit/checksum.

Both the staged folder and unpacked ZIP must pass 24-tool discovery, cold
`whoami`, the 10,000-element input guard and absence of profile creation. The
build checks the exact command/arguments and disabled-write configuration.
The ZIP rejects symlinks; unpacking rejects traversal and duplicate names.
These are packaging/protocol assertions, not native-client startup evidence.
CI runs the builder on macOS and Windows in the existing two Claude packaging
jobs; native Cowork/browser behavior is not inferred from runner success.

The generated ZIP contains `.claude-plugin/plugin.json`, `.mcp.json`, the skill,
README, license and `node_modules`. No top-level `bin/`, hooks, account secrets
or installer lockfile is included. The plugin launches `node` using
`${CLAUDE_PLUGIN_ROOT}` to locate the bundled server; users need Node on the
client's PATH. Python is required only to build, not to run the plugin.

## User flows and acceptance

| Flow | Available capability | Remaining acceptance |
| --- | --- | --- |
| Local setup | Metadata, skill and local MCP configuration; cold status | Native Claude Code and Cowork loading, permissions, clean removal and failure UX |
| Application worksheet | `prepare_job_application` from supplied facts | Native end-to-end user experience; no filling/upload/submission implied |
| CSV tracker | `export_application_tracker` from entered rows | Native user experience and user-selected file handling; no persistence implied |
| LinkedIn account reads | Existing public runtime only, separate manual login and consent | Consented useful live results and strict cleanup, scoped per run |
| Directory listing | Current plugin format prepared | Provider/§3F eligibility clarification, portal access, complete review materials and acceptance |

Never include a live read in the offline setup or preparation flow. The skill
requires explicit scope before account access and preserves unknown facts.
Writes are disabled in this package. Easy Apply, ATS form filling, application
submission, resume uploads and server-owned tracker persistence are absent.

## Current distribution rules

Anthropic's [submission guide](https://claude.com/docs/connectors/building/submission)
now deprecates desktop-extension directory listings and rejects standalone MCPB
submissions; local servers belong in plugins. The existing public MCPB remains
available for manual Desktop installation. The
[plugin structure guide](https://claude.com/docs/plugins/build) says local
command servers run in Claude Code and local Cowork sessions; ordinary Claude
chat ignores them. This local plugin does not supply a remote HTTPS/OAuth
connector and is not a cloud-chat integration.

The [Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
§3F ownership/control requirement still matters. Its plugin exception is for
approved Connectors. Do not infer permission to automate LinkedIn from accepting
a ZIP, or certify first-party control that the maintainer does not have.
Written eligibility/provider clarification is required before submission.
The portal also requires a paid Claude plan; local distribution does not.
No form, support message or directory submission is authorized by this build.

## Completion record

The first local candidate passed 768 source tests (one platform fixture skipped),
lint, types, metadata, build and exact 15-file npm inventory. Its staged and
unpacked cold checks passed with zero production audit findings. ZIP SHA-256:
`6479809cb4983665bf2fd12fd01284fd620adc90750bdfca480b7e27fe3a56fe`.
Runtime dependencies are recorded in the adjacent receipt; this build resolved
SDK 1.32.1, proxy-addr 2.0.8 and Patchright 1.64.1.

Claude Code 2.1.308's static `plugin validate --strict` passed against the
unpacked candidate under isolated configuration. It reported a directory-only
missing-icon warning and marketplace-install-line advice; neither changed its
manifest verdict. Directory artwork, distribution metadata, safety/policy review
and native startup remain open. No marketplace publication is claimed. An
initial invocation incorrectly passed the native executable to Node and failed;
the corrected invocation used the package's documented `cli-wrapper.cjs`.
Both outputs are preserved privately; the first is not counted as passing.

This is an unreleased packaging candidate. Record its exact source commit,
hosted results and independent review before distribution.
No native plugin installation or LinkedIn request is part of this milestone.
The public 4.1.1 release, its tag, bundle and separate first-use cohort remain
unchanged. First-use remains 0/0, unmeasured.
