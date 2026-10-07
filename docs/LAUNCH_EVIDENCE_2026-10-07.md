# Released core 3.0.0 — independent launch verification

Observed October 7, 2026. Core version **3.0.0 is released**, with **22 tools**;
`research_jobs` remains in [draft PR #5](https://github.com/devag7/linkedin-mcp/pull/5)
at `00830eae830012bf83f3635c6e5430d4552407ac`, excluded from the release.
No new LinkedIn request or Chrome launch was made during these checks.

## Immutable publication

Source/tag: `299225871a3ff925984ca658974f334e90103c57`.
Approved and publicly downloaded npm archive SHA256:
`c79f78e5e77814febb3f68ab9a391ef860515bcfd2d6f97001eadd6e00f58fe5`.
Public npm integrity:
`sha512-bB5q7EhQm88hvvJuEZpvaf5Ws/jtdHPjXtQz6K7C90KSH46itlJwT0gpGPKGOzrRpnHI50HJQvVYVYAPhhQmYw==`.

| Destination | Version and public URL | Independent verification | Limitation / next action |
| --- | --- | --- | --- |
| npm | [3.0.0](https://www.npmjs.com/package/linkedin-mcp-tools/v/3.0.0) | Downloaded tar matches approved SHA256/SRI, all 15 allowlisted files and their bytes. Fresh install and signature/attestation verification pass. | Published README is immutable and retains the earlier pending copy; corrected GitHub docs do not alter this archive. Refresh packaged copy only in a later reviewed version. |
| GitHub Packages | [@devag7/linkedin-mcp-tools 3.0.0](https://github.com/devag7/linkedin-mcp/pkgs/npm/linkedin-mcp-tools) | Public repository-linked scoped package; downloaded tar integrity and exact 15 files match expected name-only package metadata difference. | Separate scoped identifier; npm is the quick-start destination. |
| Official MCP Registry | [active 3.0.0](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.devag7%2Flinkedin-mcp/versions/3.0.0) | Active namespace/version, exact npm identifier and stdio transport, no remote endpoint; metadata matches reviewed server.json. | Registry metadata does not prove provider behavior. |
| GitHub | [v3.0.0 release](https://github.com/devag7/linkedin-mcp/releases/tag/v3.0.0) | Finalized release, non-draft, exact tag resolves to the intended source SHA. | Keep tag fixed when launch documentation advances main. |

[Successful automated resume 37576665533](https://github.com/devag7/linkedin-mcp/actions/runs/37576665533)
finished all 10 jobs at that source. The earlier OIDC upload run37575316004 returned
202 but initially failed the bounded package-visibility check; that historical
failure is preserved in [release readiness](RELEASE_READINESS_3.0.0.md), not erased.
The published attestation binds to that original upload invocation, not the later
resume. npm's signature/attestation command passes with no invalid or missing
entries; the package's decoded publish/SLSA subjects match the actual tar SHA512,
and SLSA resolves the exact source above and `.github/workflows/release.yml` on main.
No token fallback or second manual publication was used in this verification.

## Published consumer and setup proof

Fresh public-package install in a disposable directory resolves SDK1.32.1
(direct floor ^1.31.0) and proxy-addr2.0.8. Production audit reports zero findings.
Real SDK stdio checks start two fresh published-build processes, discover22 tools,
verify preview/confirmation refusal, persistent stop, blocked health and clean close.
Generated Claude Desktop, Cursor and VS Code configurations execute successfully
through SDK stdio. Broken-profile setup returns actionable offline JSON. These
are configuration/protocol fixtures, **not native client UI or live provider proof**.

The [synthetic setup demonstration](RELEASE_DEMO_3.0.0.md) and
[dated output](OFFLINE_DEMO.txt) were generated from that public installed bundle.
All three setup formats report needs_attention for intentionally missing Chrome
and a persisted stop; cold session remains unchecked, writes stay disabled and
manual login is not run. Preview output contains no proof token/private path.

Launch source checks:531 tests across28 suites, lint, typecheck, metadata and build
pass; the exact15-file package/isolated consumer smoke passes, including all three
setup formats. Source demo asserts22 tools and absence of research_jobs. Production
audit remains zero. The documentation update changes README/setup bytes in a local
archive; it must never be passed off as the immutable published archive above.
[Hosted launch CI37581168882](https://github.com/devag7/linkedin-mcp/actions/runs/37581168882)
passes all12 source/package/Chrome jobs at258c62963757fdb79f45aafc598b4546037c3d36
on Node20/22 across Linux, macOS and Windows. This proves the tested source,
installed artifacts and offline browser lifecycle, not LinkedIn access or native
Windows ACL privacy. [Launch PR #9](https://github.com/devag7/linkedin-mcp/pull/9)
records the final documentation-head checks and post-merge listing refresh.
A main documentation push at unchanged version is ineligible to republish because
v3.0.0 already resolves to a different source; no version bump or tag movement.

## Distribution and remaining evidence

- [Glama](https://glama.ai/mcp/servers/devag7/linkedin-mcp): owner description saved
  with released3.0.0,22 tools/local stdio/manual login, no hosted deployment or
  research brief, and provider/first-use/privacy limitations. Source refresh and
  generated hosting UI state are recorded after the launch README reaches main.
  Auto-Release is confirmed off. The hosting label remains Hybrid and Glama
  retains an old2.0.3 hosted release; the owner editor offers no hosting-label or
  generated-instructions field. Do not enable automatic hosted builds to
  manufacture compatibility evidence. See PR #9 for post-sync public read-back.
- [awesome-MCP PR15490](https://github.com/punkpeye/awesome-mcp-servers/pull/15490):
  existing-entry correction, head13f904d5a3dbbb07902b79e07abf207bbb1a4fba, now
  open and ready for upstream review. Body updated to released3.0.0; entry contains
  no job brief or hosted capability. Maintainer acceptance is still pending.
  Checked current contribution rules: installable public repository, existing
  alphabetical placement, concise accurate single-line entry.
- No mandatory paid service, paid placement, new domain or hosted deployment.
  Native first-use cohorts all remain0. Coordinated erasure and native Windows
  ACL proof remain open. One low development-only esbuild finding retains its
  October8 supported-update follow-up and documented build exposure.
- PR #5 partial live result still fails usefulness. Diagnose redacted provider
  shape/error evidence offline before proposing another bounded check; fixture
  success cannot establish live compatibility. Further account access requires
  fresh, specific consent and has not been requested or performed here. Offline
  review of the current draft shows an existing REST-primary candidate, not a
  verified provider fix. The redacted earlier detail response retained nested
  provider errors without an identified cause; strict rejection must remain.
  Its direct SDK floor is still ^1.12.1 and dev Vitest^3.2.1; carry the reviewed
  core dependency repairs into that draft with new history before fresh gates.
- GitHub API reports10 stars on October7. Weekly traffic/first-use/reuse samples
  and monthly net-star summaries are planned. API traffic sampled at
  06:25UTC covers September22–October5:55 views/21 unique visitors,1161
  clones/262 unique cloners. These overlapping-window aggregates include
  automation and do not establish users or repeat use. No cohort data exists.
  10,000 stars and daily Trending are
  observed ambitions, not claimed results or release gates.

Private receipts are preserved under the existing core-release backup's
`launch-2026-10-07`: destination-receipts, provenance-binding-receipt,
published-install-receipt, public tarballs, consumer audits/signatures and fixture
logs. All60 original protected snapshot files remain byte-identical, including
the57 user-identified sync copies, pr_diff.txt and Git backup files. Released source,
prior candidates and historical evidence are retained.
