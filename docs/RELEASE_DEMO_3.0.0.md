# Synthetic setup demonstration — published core 3.0.0

**Synthetic, offline demonstration. No login, Chrome launch or LinkedIn request.**
[Recorded output](OFFLINE_DEMO.txt) was generated on October 7 from the actual
public npm 3.0.0 bundle, not a job-brief branch. The sample uses disposable missing
Chrome and persistent-stop fixtures to show actionable diagnosis rather than
pretend a real account is ready.

The walkthrough exports Claude Desktop, Cursor and VS Code setup status, discovers
22 tools through the real MCP SDK, reports a cold unchecked session, makes a local
synthetic post preview with writes disabled, refuses a read at the persistent stop,
and closes the session. Manual login is shown as **not run**. The script asserts
that the deferred research tool is absent. Public output omits private paths and
preview tokens. Generated formats do not prove native application UI acceptance.

Reproduce with Node 20 or later from the reviewed repository:

```sh
npm ci
# Install the published package at a disposable or stable local path; no login.
npm install --prefix /absolute/demo-install --ignore-scripts linkedin-mcp-tools@3.0.0
node scripts/demo-offline.mjs /absolute/demo-install/node_modules/linkedin-mcp-tools/dist/index.js
```

Windows: replace `/absolute/demo-install` with an absolute local directory.
For a source-build comparison, run `npm run build && npm run demo:offline`.
The script removes only fixtures it creates, never the chosen installation or
real profile. Diagnosis deliberately returns needs_attention in this fixture;
that is the demonstrated behavior, not a real onboarding failure measurement.

[Actual user setup](../SETUP_GUIDE.md) requires installed Chrome and deliberate
manual login. [First-use measurements](FIRST_USE_VALIDATION.md), live provider
compatibility, coordinated erasure and Windows privacy proof remain open. No
job-brief recording or hosted deployment is part of this release.
