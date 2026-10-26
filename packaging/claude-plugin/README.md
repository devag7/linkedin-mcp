# LinkedIn MCP local plugin — 4.1.2

This unofficial plugin packages the verified public `linkedin-mcp-tools@4.1.2`
runtime and a guided job-preparation skill. It exposes 24 tools, including local
application worksheets and CSV export. It does not fill or submit applications,
upload resumes, or maintain a persistent application tracker. Writes are disabled
by the supplied server configuration.

## Build and inspect

From a clean repository checkout, use Node 20+ and Python 3 on PATH:

```sh
npm ci
npm run build:claude-plugin
```

The builder prints the ZIP path and SHA-256, verifies the exact public npm
archive, audits installed production dependencies, and checks both the staged
and unpacked runtime through MCP without starting Chrome or accessing LinkedIn.
Python's standard ZIP library is a build dependency only. No paid build service
or hosting is required. Dependency resolutions are recorded in the private/local
receipt; rebuilding later can produce different bytes if compatible dependencies
change. Review the receipt and audit instead of assuming an identical ZIP.

## Local installation and limitations

This source folder is a packaging template, not an installed plugin: its server
entry exists only after building and unpacking the resulting ZIP. Inspect the
archive and its checksum before allowing local code to run. Node 20+ must be on
the client's PATH; Google Chrome and a separately authorized manual LinkedIn
login are needed only for account reads. Local code runs with the user's account
permissions. Do not share an authenticated Chrome profile.

With Claude Code installed, static-check the unpacked folder using
`claude plugin validate /absolute/path/to/unpacked-plugin --strict`.
An intentional local trial can use
`claude --plugin-dir /absolute/path/to/unpacked-plugin`, then inspect `/mcp`.
That command starts the local server; the build does not run it for you in Claude.
Cowork local sessions are another documented plugin surface, but this candidate
has no native Cowork startup or browser/login compatibility proof. Ordinary
Claude chat ignores a plugin's local command server. Use the separately released
MCPB for manual Claude Desktop extension installation.

No native plugin installation, live account read or directory submission is part
of the build. Native discovery, useful live reads and directory acceptance remain
separate acceptance gates. There is no cloud HTTPS/OAuth connector here.

## Privacy policy and support

The runtime uses a local Chrome profile for authenticated reads only after the
user separately logs in and authorizes access. Application preparation/export
uses supplied facts and does not persist a tracker. Client conversations and
user-saved exports have their own retention. Selected-profile retirement is
scoped; it does not erase shared safety state, client conversations or backups.
See the [privacy policy](https://github.com/devag7/linkedin-mcp/blob/main/docs/PRIVACY.md)
and [support](https://github.com/devag7/linkedin-mcp/issues). Do not post account
data, logs, credentials or application records publicly.

## Directory eligibility

Anthropic now directs local-server directory submissions to plugins and no longer
accepts standalone MCPB listings. Packaging does not confer eligibility. This
project does not own LinkedIn's interfaces; the directory policy's approved
Connector exception is not blanket permission to automate third-party sites.
Obtain written eligibility/provider clarification before submission. Portal
access may require an existing paid Claude plan, separate from free local
distribution. This plugin has not been submitted or accepted.

References: [plugin structure](https://claude.com/docs/plugins/build),
[submission route](https://claude.com/docs/connectors/building/submission),
[directory policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy).
