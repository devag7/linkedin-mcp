# LinkedIn MCP 4.1.1

Security maintenance patch: npm and GitHub Packages are independently verified.
MCP Registry timeouts still block final GitHub Release completion; see the
[release evidence](RELEASE_EVIDENCE_4.1.1.md).

- Require MCP TypeScript SDK 1.32.1 or later in the 1.x line and lock 1.32.1
  for source builds. This excludes the versions affected by the four
  [October 21 SDK advisories](SDK_SECURITY_REPAIR_2026-10-21.md).
- Require the same minimum in the fresh installed-package verifier.
- Enable the SDK's 10,000-element tool-input guard before schema validation;
  retain the existing HTTP byte limit and verify rejection before provider work.
- Correct current privacy documentation for the 4.1.0 offline application
  helpers and selected-profile retirement commands; refresh the recorded
  offline contract check date.

The tool count remains 24. The [full-scope audit](COMPLETION_AUDIT_2026-10-21.md)
records unfinished research, privacy, native/live validation, submission and
distribution work.

Update the stable installation from the verified public npm package with:

```sh
npm install --prefix "$HOME/.local/share/linkedin-mcp" linkedin-mcp-tools@4.1.1
```

Regenerate the client entry using that installed build's `--setup` command and
restart the client. A source checkout should use the updated committed lockfile
with `npm ci`. Merely leaving an existing SDK 1.31.0 lock in place does not apply
this repair. The public 4.1.0 Claude extension already bundles SDK 1.32.1 but
predates the new element guard. It needs a rebuilt 4.1.1 runtime for this
protection; its earlier native cold check does not establish a 4.1.1 check.
