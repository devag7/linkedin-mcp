# 4.2.0 readiness record — October 27, 2026

Target: additive application-evidence reuse and local resume/cover-letter drafts.
Base: merged main `ef56b65ba3e905031d2c10197438652ce0301a7c`.
The previously verified public 4.1.2 source/tag and archives remain unchanged.

## Preparation snapshot (preserved)

The source implementation is complete. Independent runtime/test review is clean;
final frozen-head documentation review and hosted gates remain pending. Local
verification passed 808 tests with one platform fixture skipped, plus lint,
typecheck and generated metadata checks. Do not infer npm,
registry, Release or wrapper availability from this record. The exact frozen
source, archive identity, test/audit results and hosted job evidence will be
added when verified. Native-client and draft usefulness remain unmeasured.

Source dependency audit on October 27 returned zero findings before the feature
changes; this work introduces no dependency changes. The target keeps 24 tools
and extends the existing worksheet with optional bounded inputs and outputs.

## Required release gates

- Meaningful pure-function and native SDK compatibility/privacy regressions.
- Full source tests, lint, types, generated metadata and production build.
- Exact 15-file archive checks, installed client flows and fresh-consumer audit.
- Independent final diff review; hosted source/package/Claude matrix and pinned
  release dry run at the reviewed source. Publishing steps must remain skipped
  in dry runs; failures/cancellations remain separately recorded.
- Public npm bytes/SRI/provenance and independent GitHub Packages, active MCP
  Registry metadata, finalized GitHub Release/tag readback after actual publication.

No account/native access or participant contact is part of these source/release
gates. All original failed receipts and protected files remain preserved.
Mandatory new maintainer service cost: $0.

## Completed local evidence

- Full suite: 808 passed, one platform fixture skipped. Lint, typecheck,
  generated metadata and production build passed.
- Exact 15-file archive, normal/ignore-scripts package paths, fresh installation,
  compiled SDK material drafting/unused-fact isolation and existing safety/
  retirement/client-export flows passed without LinkedIn requests.
- Fresh consumer resolves SDK 1.32.2, proxy-addr 2.0.8 and Zod 4.6.7; its
  production audit is zero. Source full audit is zero. No dependency resolutions
  were changed in this feature; only package/root-lock version fields changed.
- Claude Desktop, Cursor and VS Code configuration exports and SDK discovery
  passed offline. Native applications and draft usefulness remain unmeasured.

Candidate archive SHA-256:
`cd6ab6df8df54236e953de6a6f8cf7cf095746da5d92fbe1727e7228d2d44b0a`.

Candidate SRI:
`sha512-1YcuiUg0ZWawg/eRXp/IPq+z8dgmrYH0EipLq1RKf2n2cjRVXxYoKkCh+DkRlM6+miVn50/CUD7gJh/bG5ntBA==`.

This identifies the reviewed local candidate, not a public npm artifact. Existing
4.1.2 MCPB/plugin assets remain pinned to their verified public runtime; they do
not silently gain 4.2.0's new optional fields.

## Publication completion update

Core 4.2.0 is now independently verified at all four destinations. Source/tag
`bf729d63a72bdced8bda09407520dc2aea3d31f6`, archive/hash above, two registry
signatures and two signed attestations match. Final reviewed-head and merged-main
CI passed 14/14; final dry run 10/10. Production attempt 1 failed visibility after upload;
its failed-job-only same-source resume passed 10/10 and skipped another npm upload.
The original cause remains unknown. See [complete core evidence](RELEASE_EVIDENCE_4.2.0.md).
Claude wrapper publication/native acceptance remain separate; the current
4.2.0 local wrapper builds are recorded there with their remaining gates.
