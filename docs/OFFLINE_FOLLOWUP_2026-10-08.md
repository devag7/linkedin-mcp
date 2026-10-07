# October 8 offline follow-up

Inspected merged PR #10 and independently reviewed PR #11 at
`037d7f5a3230ae7c2c72c68e6e118c02941d0856` against main
`f07ad09ee3cee1c76a998042ad68ae752bfec62a`. No review findings.
PR #11 merged as `7aacea3b85e006cd935e28ede4068b78635bdd31`.
Its exact-head CI ran all 12 source/package checks successfully. Local metadata,
package inventory and installed-package checks passed. A fresh published install
also passed the three configuration exports and cold SDK flows: 22 tools, no
browser or LinkedIn requests. SDK flows are not native-client success.

After merge, the public 3.0.0 archive still has SHA-256
`c79f78e5e77814febb3f68ab9a391ef860515bcfd2d6f97001eadd6e00f58fe5`
and its recorded SHA-512 integrity. Version remains 3.0.0. The existing release
identity guard rejects publication of this new main SHA against the existing
v3.0.0 tag. Post-merge [CI 37671982172](https://github.com/devag7/linkedin-mcp/actions/runs/37671982172)
passed all 12 jobs. The redundant automatic
[Release run 37671982164](https://github.com/devag7/linkedin-mcp/actions/runs/37671982164)
was cancelled before the release job started after one Ubuntu/Node 22 Chrome
installation stalled; five compatibility jobs had passed. This cancelled run
is **not** a passing release gate. The exact local release plan returns
`eligible:false`, reason `version_tag_belongs_to_another_commit`. It initiated
no publication; the public tag still resolves to
`299225871a3ff925984ca658974f334e90103c57`.
No release dispatch, version bump, token fallback or publication was performed.

## Scheduled development audit

October 8 production audit: **zero findings**. Full audit: **one low**,
esbuild 0.27.7 through tsup 8.5.1, affected >=0.27.3 <0.28.1.
[Advisory GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr)
concerns file access through an esbuild development server on Windows.
Public registry metadata still gives latest tsup 8.5.1 with esbuild ^0.27.0;
latest esbuild 0.28.2 is patched but outside that supported range.
There is no compatible parent dependency repair today. No override, force fix,
audit suppression or unsupported replacement was applied.

The shipped package does not include esbuild. The reviewed build invokes one-shot
tsup, with no serve/servedir/watch. Contributors who run an exposed esbuild serve
mode remain within the advisory's exposure; this is not a claim that the full
build tree is vulnerability-free. Next manual review: October 15, or earlier
if a supported parent release appears. A build-tool migration needs its own PR,
source/package/publisher/consumer audits and the full OS/Node matrix. Required cash $0.

## Current native-client boundaries

- **VS Code 1.141.0**: installed `agentHostMain.js:301` has SHA-256
  `73e8e6482c6c2fdff492a6126ea338423f47800f5a305bb8e404cc580b290e60`.
  Its start method refuses an unresolved session control chat; a provisional
  session has no backing runtime. The exact error remains
  `Cannot start an MCP server before the session runtime has been created. Send a message first.`
  This is source inspection, not a new native launch reproduction. October 7's
  [temporary-profile probe](evidence/first-use-2026-10-07/native-vscode-temporary-profile.json)
  remains specific to 1.140.0. October 8 UI command selection did not expose a
  controllable temporary-profile window; the interaction then reported
  `noWindowsAvailable`. No new isolated configuration/start/tool discovery was
  completed. No model prompt was sent and no shared settings were edited.
- [VS Code's current documentation](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
  describes forwarding configuration to Agent Host and independent process
  management there. Setting `chat.mcp.autostart=never` does **not** prevent Agent
  Host starts. Before any owner-run runtime initialization, use a disposable
  workspace, temporary profile, disabled discovery, the stopped test profile
  and missing Chrome executable already used in the October 7 fixture. Inspect
  the effective configuration and ensure no real-profile servers are selected.
  A separate approved cold-only client prompt can then initialize the runtime;
  first verify native tools discovery and cold whoami/close. A participant's
  account read needs its own protocol consent. Do not bypass client safety gates.
- **Claude Desktop**: the installed bundle reports 2.26454.2 at the final version
  read; the running process version was not independently checked.
  Settings > Developer > Local MCP servers and Edit config are now visible.
  Inspecting the existing local entry shows a running **workspace dist/index.js**,
  not the published artifact. This is configuration/status inspection only;
  no tools were invoked. No supported isolated app configuration was established,
  no import/restart occurred, and no existing servers were changed. An owner-run
  disposable OS/client environment is needed to test the published package without
  replacing the user's shared configuration. The
  [official guide](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
  documents local installation; it does not prove this product's native flow.
- **Cursor**: not installed; native flow untested.

No private conversation, screenshot, local path or account field is included in
repository receipts. No LinkedIn access or volunteer contact was initiated.

## First measured attempts: owner checklist

1. Arrange willing adults yourself with existing client access; share the merged
   [volunteer kit](FIRST_USE_VOLUNTEER_KIT.md). Confirm version 3.0.0, manual login,
   one own-profile tool invocation including its implicit requests, no writes,
   stop rules, required separate anonymous-tally consent before study start,
   and optional private-row recording. Do not promise a
   numeric HTTP maximum. A participant requiring one must wait for enforcement.
2. Confirm each participant's declared new-user eligibility and first/later
   attempt status; choose one first client. Only with optional private-row consent,
   assign a random private person code and agree on a private non-synced results
   location and retention/deletion date. Otherwise retain only separately consented
   anonymous group/outcome tallies, with no linkable registry. Disclose uncertain
   eligibility as the results guide requires. No identities or private rows in GitHub.
3. Start timing **before** prerequisites/install. Every first started attempt,
   including failure, cancellation or entitlement problems, stays in the overall
   denominator once per person. A later successful client trial cannot replace it.
4. Run the pinned published install/setup path and only the consented sequence.
   Stop at checkpoints, restrictions or consent withdrawal; no retries/probes.
   Record useful partial results using the merged field/source/freshness criteria,
   separately from completeness, and record cleanup. Actual HTTP count may be unknown.
5. Keep later-client attempts and optional repeat-use observations separate.
   Share only aggregate counts and failure categories after participant approval.
   Select the next product fix from observed failures, not guessed provider changes.

Cohort remains **zero attempts**. 80% within 15 minutes is unmeasured.
Mandatory maintainer cash $0. 10,000 stars and daily Trending are outcomes to
measure, not promises or release gates. Highest-value next action: one consenting
new participant on an isolated, usable client, then inspect the first observed failure.

Coordinated erasure and native Windows second-user ACL proof remain open as specified
in [readiness](FIRST_USE_READINESS_2026-10-07.md). No actual private state was erased.
PR #5 remains a separate draft; its useful live brief gate requires fresh consent.


## Separate PR #5 offline milestone

[Draft PR #5](https://github.com/devag7/linkedin-mcp/pull/5) was fast-forwarded
through dependency repair and a merge of reviewed main; no history was rewritten.
The independent review found documentation inconsistencies, all corrected:
source-lock SDK versus fresh-consumer SDK; a publisher evidence link; unpublished
3.1.0 versus released 3.0.0; and optional private rows versus required anonymous
study tally consent. Reviewed core safety and the merged study materials remain intact.

Final draft head: `366600961d0a35530d788ffef85631181df8f223`. Its local source suite passes **562 tests** (26 research
tests), lint, typecheck, metadata, build, exact inventory and installed package checks.
A fresh consumer of the final archive has full audit zero, SDK 1.32.1 and proxy-addr
2.0.8. The reviewed source lock uses SDK 1.31.0 / proxy-addr 2.0.8, with direct SDK
floor ^1.31.0. Publisher audit zero under supported Node 24.16.0; its first local
bootstrap failed `EBADENGINE` under Node 22.14.0 and the failure is preserved.
No engine check, advisory or policy was bypassed. Source full audit retains the
same one low development-only esbuild finding.

Final macOS/Node 22 archive: 15 files, 23 tools, SHA-256 `a4e392f94bf61b65caf0d6ba110727812df5db1467e4258089efa12713180b35`.
This is a **draft artifact**, not a published version or provider proof.
[Exact-head source/package CI](https://github.com/devag7/linkedin-mcp/actions/runs/37674048405)
passed all 12 source/package jobs across Linux, macOS and Windows on Node 20/22.
The [exact-checkout release dry run](https://github.com/devag7/linkedin-mcp/actions/runs/37674107626)
passed all 10 jobs. Publishing/tag/finalization mutation steps were skipped.
Its hosted 15-file archive SHA-256 and integrity match the local final artifact
exactly. This validates offline compatibility, packaging, the audited publisher
and destination plans, not live client/provider or authenticated publication. The release workflow executes from main but
checks out the explicit draft SHA above with `dry_run=true`; no publish is authorized.
A mistakenly entered SHA dry run and an obsolete pre-integration dry run were
cancelled while pending, before any jobs/publication; they are not passing evidence.

The observer now asserts title-only partial results have zero useful entities,
consistent data/meta status, exact provenance and three attempts/two tools. Counts
from the consumed live checks cannot identify the provider's underlying cause.
REST-primary remains provisional. No live usefulness claim, feature merge or
release is permitted without its remaining gates and fresh useful-brief consent.

All 60 backed-up preservation files, including the 57 sync copies and pr_diff.txt,
were compared byte-for-byte with the original workspace and remain unchanged.


## Remaining public listing limitation

The [Glama public page](https://glama.ai/mcp/servers/devag7/linkedin-mcp),
read October 8, still serves generic hosted Deploy Server instructions and a
source excerpt saying publication is pending. Its 22-tool core list does not
include research_jobs, but its short write description omits the mandatory
server preview proof. Main README and contracts already explain published 3.0.0,
local stdio and the reviewed preview requirement. Do not treat the listing as
verified deployment instructions. A directory-side source/cache refresh and
correction of its generic deployment/write copy remain open; no such
correction or hosted support is claimed by this offline milestone.
