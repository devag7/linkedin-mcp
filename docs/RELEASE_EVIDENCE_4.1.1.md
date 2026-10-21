# LinkedIn MCP 4.1.1 publication status

**Not yet verified as published.** The patch's source, package and hosted
checks are preparation evidence; public destination receipts will be added
only after independent readback.

[PR #42](https://github.com/devag7/linkedin-mcp/pull/42) merged the SDK repair
and input guard at `a3af39ac47c07d06f42904cd67cd797bf6fb747e`. Its final head
passed 14 hosted checks. The runtime/package-identical earlier head passed
a 10-job nonpublishing dry run after a failed registry-read attempt; those
failed receipts remain preserved.

The first production run
[39568406417](https://github.com/devag7/linkedin-mcp/actions/runs/39568406417)
was cancelled during compatibility checks, before the publisher job started,
because the packaged README/setup commands still pinned 4.1.0. That initial
archive is superseded by the corrected install-guidance candidate. It is not
an approved public 4.1.1 receipt.

The [security repair](SDK_SECURITY_REPAIR_2026-10-21.md) and
[release notes](RELEASE_NOTES_4.1.1.md) describe the patch. There are 24 tools;
job research briefs remain outside the release. A rebuilt 4.1.1 Claude bundle
and new native/live evidence are separate verification steps. The
[4.1.0 receipts](RELEASE_EVIDENCE_4.1.0.md) remain historical.
