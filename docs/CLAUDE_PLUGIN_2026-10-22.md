# Local Claude plugin candidate — October 22, 2026

## October 30: 4.4.0 current build

The builder pins verified public core 4.4.0. See the
[4.4.0 distribution checkpoint](CLAUDE_DISTRIBUTION_4.4.0.md) for hashes,
checks and public asset status. Older sections are preserved version-specific
evidence; native 4.4.0 use remains unverified.

## October 29: 4.3.0 public-runtime build

The current builder wraps the [independently verified public 4.3.0 core](RELEASE_EVIDENCE_4.3.0.md),
SHA-256 `3896b31a25fe442fa23246dbf5e814dc1b7efde33636d81d72e858603aed20f9`.
It adds the optional evidence-linked interview kit to the existing preparation
flow. The local plugin ZIP local build has SHA-256 `e514616d244270b4d2cf8e3f920815165bb416da47672b7e88cee03117b9224c`.
[Local receipt](evidence/release-4.3.0-2026-10-29/wrapper-local-builds.json)
records the stage/unpack, zero-audit, cold 24-tool and new interview checks.

Use `npm run build:claude-plugin` with a new output path for a current build. The installer
formats remain distinct: MCPB is for manual Claude Desktop extension use;
plugin ZIP is for documented local plugin surfaces. Check the
[4.3.0 Release asset list and distribution notes](https://github.com/devag7/linkedin-mcp/releases/tag/v4.3.0)
for actual public downloads, checksums and final integration status. A local
archive or successful SDK probe alone is not public distribution evidence.

Static Claude Code 2.1.285 manifest validation passes with an isolated config
and blocked network proxy. No plugin load, native 4.3.0 installation, account
read or directory submission was performed. Local Node code runs with the
user's account permissions; review the unsigned-code warning before installing.
The server stores no evidence library or draft; the client controls its copies.

The 4.2.0 and earlier blocks below are historical version-specific evidence and
recipes. They do not establish 4.3.0 native use or upgrade an installed 4.2.0
bundle. Use the current builder/version above for new local builds.


## Current 4.2.0 target and checks

The default builder now pins the verified public 4.2.0 core archive, SHA-256
`cd6ab6df8df54236e953de6a6f8cf7cf095746da5d92fbe1727e7228d2d44b0a`.
Build with `npm run build:claude-plugin -- /absolute/output/linkedin-mcp-local-4.2.0.zip`.
The local ZIP SHA-256 is
`17980a241c2bac77a8296b4ac8e8f3e001368c9baa6a9ede681c740aca64605e`.
Both staged/unpacked runtimes pass cold status, 24-tool discovery, input bounds,
selected-evidence drafts and unused-fact isolation; production audit is zero.
Four template privacy fixtures pass. Claude Code 2.1.285 static strict manifest
validation passes under isolated configuration; it does not load the plugin or
prove native Code/Cowork/Desktop behavior. [4.2.0 evidence](RELEASE_EVIDENCE_4.2.0.md)
records the separate hosted and public distribution gates. Check the matching
[release assets/checksums](https://github.com/devag7/linkedin-mcp/releases/tag/v4.2.0)
before using a downloaded ZIP.

The plugin skill checks the installed schema, uses only explicit user-provided
mappings, preserves unverified lineage and never invokes account reads, writes,
application submission or file/library persistence as part of local drafting.
Unsigned local Node code has the user's account permissions; review it before
intentional installation. The [current directory research](CLAUDE_DIRECTORY_RESEARCH_2026-10-27.md)
distinguishes manual packages, plugin submissions and remote connectors.

All 4.1.2/4.1.1 preparation and validation sections below are historical. They
are preserved as version-specific evidence, not current build instructions.

## Historical 4.1.2 target

The current plugin template and builder target public core 4.1.2, SHA-256
`6a03ee1a415d064fb573455689e142c5cbec1f140040b66f5674dcab23370947`.
Local ZIP hash: `cd0417c9dda049792b7095432690de1a065af9e04fd1ca458b3f9d1d1524de62`.
Both staged/unpacked protocol checks and production audits pass. See
[4.1.2 release evidence](RELEASE_EVIDENCE_4.1.2.md) for hosted and public-asset
status; no native, live-provider or directory acceptance is implied.
The 4.1.1 preparation/failure records below remain historical.

## Historical 4.1.1 security and review update

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

## Historical source integration checkpoint

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

## Historical 4.1.2 scope

`packaging/claude-plugin` is a template for a local plugin containing the exact
public 4.1.2 runtime, its production dependencies and a job-preparation skill.
The builder verifies npm archive SHA-256
`6a03ee1a415d064fb573455689e142c5cbec1f140040b66f5674dcab23370947`.
It does not build the runtime from this checkout or include experimental PR #5.
The plugin exposes the same 24 tools; runtime version and public release stay
4.1.2. The ZIP and its own checksum are separate artifacts from the npm archive
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

## October 26 verified public runtime repin

The public npm 4.1.2 archive is now downloadable and matches the reviewed
15-file candidate byte for byte, SHA-256
`6a03ee1a415d064fb573455689e142c5cbec1f140040b66f5674dcab23370947`.
The wrapper manifest and both public builders now target that exact public
runtime. Historical 4.1.1 results and its new advisory failures above remain
unchanged. This update does not claim the new wrapper ZIP/MCPB is published,
native-client tested or directory accepted. New wrapper results and independent
review must be recorded before distribution. The completed 4.1.2 core release
and all destination readbacks are tracked separately.

Local public-runtime wrapper checks now pass: production audits zero, staged and
unpacked 24-tool discovery/cold status/input guard, and all four dirty-template
fixtures. MCPB SHA-256 `526b183e36f40139c8a351335859268ca680bd3d309f5980fcc92f3e27d81ba7`;
plugin ZIP SHA-256 `cd0417c9dda049792b7095432690de1a065af9e04fd1ca458b3f9d1d1524de62`.
Claude Code 2.1.308 static strict validation passes with the same directory-only
missing-icon warning and marketplace advice. Hosted final-head checks and
independent review remain separate; these local files are not yet release assets.
