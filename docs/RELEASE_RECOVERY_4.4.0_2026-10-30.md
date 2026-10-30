# 4.4.0 finalization recovery — October 30, 2026

The immutable core source is `87dae34902cc6f14d5c60a11a901808782a95555`.
Its reviewed 15-file archive SHA-256 is
`df8ecf6fa8d4143bbc8625b1f8b494e5a3445667b9134f8a94e9db614e2cc1a8`.
The package is verified on npm, public GitHub Packages and the active MCP
Registry. GitHub's unique release `428280123` remains a draft at this source.
This checkpoint does not establish final release completion.

## Preserved failures

- Dry run `40928200140` attempt 1 failed a Windows process-preflight timeout
  before Chrome launch. A same-source failed-job-only retry passed all ten jobs.
  No timeout, ownership or cleanup rule was changed; the first cause is unproven.
- Production `40933053202` attempt 1 exchanged OIDC successfully (201) and
  uploaded (202), then failed `PACKAGE_NOT_VISIBLE`. Subsequent anonymous reads
  verified exact bytes/SRI, two registry signatures and both attestations. The
  upload remains bound to attempt 1. The failure's precise cause is unproven.
- Attempt 2 skipped another npm upload and passed nine jobs, then failed its
  finalizer with generic `RELEASE_CHECK_FAILED` after roughly 15 seconds.
  A finalizer-only attempt 3 failed similarly. Both failures remain preserved;
  no further blind retry is part of this recovery.

A read-only replay using the immutable helper on local Node 24 reproduced a
15-second Registry timeout. Python reads of both the canonical and
`include_deleted=true` endpoint returned matching active metadata. A Node replay
with a declared release-verification User-Agent passed every read-only check,
including the existing draft, source and tag. This demonstrates a local transport
difference; it does not prove the exact operation or cause of the hosted errors.

## Narrow recovery workflow

`finalize-4.4.0.yml` runs only through an explicit dispatch on main. It checks
out the reviewed helper at the dispatch SHA separately from the immutable core
source and downloads the original producer's preserved artifact. It installs
and publishes no package, uses no OIDC/npm token and opens no browser.

The one-incident runner requires all of the following before publication:

- Actual GitHub Actions/main/repository context, the dispatch helper SHA, exact
  human-selected confirmation source, core HEAD and tag, and archive SHA/SRI.
- Original producer identity/source/path/event and all nine successful prerequisite
  jobs. A missing, cancelled or failed prerequisite refuses finalization.
- Fresh npm integrity, active source-matching Registry metadata, exact scoped
  4.4.0 version/integrity and separate public scoped-package visibility. The
  scoped integrity is pinned to the independently downloaded archive whose 15
  file bytes/modes match npm except the package name. Missing or different
  scoped versions refuse finalization even if older public versions remain.
- The source-matching draft and remote tag. The only permitted non-GET request
  is `PATCH /repos/devag7/linkedin-mcp/releases/428280123` with exactly
  `{"draft":false}`. Uploads, creation/deletion of tags or releases, changed
  targets and credential forwarding to other hosts are refused.

The runner verifies source/tag again after the patch. If already finalized, it
verifies the same release without another mutation. Existing 15-second request
deadlines, redirect refusal, 2 MiB response bounds and metadata checks remain.
Release checks declare their client identity and return redacted
destination-specific transport failures. No mismatch or network error becomes
permission to publish. The workflow's result and fresh public readback are
required before claiming finalization; the original production run stays failed.

Tests use synthetic destinations only and cover changed source/artifact/context,
blocked uploads/tag mutations, failed producer/Registry states, check ordering,
idempotent finalization and transport redaction. Independent review and hosted
checks are separate gates before dispatch.

The [Vite development lock repair](SECURITY_VITE_2026-10-30.md) clears the newly
reported source audit without changing the public archive. Native clients,
provider compatibility, participant outcomes and Claude package distribution
remain separate. No LinkedIn access, real-state deletion, outreach or mandatory
new service expense is part of this recovery.
