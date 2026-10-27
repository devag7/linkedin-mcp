# Claude installation and directory readiness — October 27, 2026

This research refresh uses current official documentation. Core 4.2.0 is publicly
verified; the matching manual packages have separate build/distribution evidence.
No directory submission, account connection, purchase or native installation was
performed in this work. Manual package availability does not mean directory acceptance.

## Choose the correct route

| Goal | Route | This project's state |
| --- | --- | --- |
| Local Claude Desktop use | Manually install a reviewed unsigned MCPB, or configure a local stdio server | 4.2.0 public-runtime bundle builds/checks separately recorded; native 4.2.0 installation remains untested |
| Local Code/Cowork plugin use | Unpack the plugin ZIP; validate its manifest and deliberately load it in a supported client | Static Claude Code 2.1.285 validation and offline SDK checks pass; native loading/use remain untested |
| Official directory listing for a local server | Submit a GitHub-hosted plugin bundle through the directory portal | Eligibility, complete installable GitHub source and real-client acceptance remain open |
| Remote connector listing | An internet-reachable HTTPS MCP server with appropriate authentication | No remote multi-user service/OAuth connector is implemented here |

Anthropic's current [connector submission guide](https://claude.com/docs/connectors/building/submission)
requires remote connectors to use HTTPS and directs local servers into plugin
submissions. Standalone MCPB directory listings are deprecated; this does not
remove manual Desktop installation. Account-connected remote services need OAuth,
not this project's Chrome cookies or its loopback token. A local-only URL must not
be presented as a public remote connector.

[Desktop installation guidance](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop)
still documents custom MCPB installation through Extensions advanced settings.
Review the unsigned-code warning: local Node code runs with the computer user's
permissions. The public package's offline helpers do not require LinkedIn login;
account reads require separate deliberate access.

Official [surface guidance](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors)
distinguishes local plugin MCP servers in Code/local Cowork from chat; a
remote Connector is a separate cross-surface route. The current manual Desktop
MCPB is a different installation format. No native surface is certified here.

## Policy gate before submission

The [Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)
requires privacy minimization, accurate tool descriptions, support/documentation,
reviewer test access and three working examples. Section 3F requires control of
connected interfaces/resources; its plugin exception concerns approved directory
Connectors. This project does not own LinkedIn's browser/API interfaces.

**Project inference, not an Anthropic decision:** the current unofficial browser
path has an apparent eligibility barrier. User login, an npm publication, a local
ZIP or a successful static validator does not establish permission or acceptance.
Obtain written route/provider clarification before claiming eligibility or
submitting the full 24-tool browser integration. No such clarification is recorded.
Do not provide personal LinkedIn credentials in GitHub issues or use an unapproved
account as a reviewer sandbox.

## Technical gap: the repository folder is a template

`packaging/claude-plugin` contains source templates. Its `.mcp.json` refers to a
runtime under `node_modules` supplied by the builder; those installed dependencies
are in the generated ZIP, not the source folder. The manually built/unpacked ZIP
is not interchangeable with an installable GitHub plugin folder. The current
[folder/run rules](https://claude.com/docs/plugins/pre-submission-checklist)
require complete executable entries and treat some large/binary/dependency-heavy
payloads as review holds. A source-distribution variant needs its own validation.

The [plugin submission guide](https://claude.com/docs/plugins/submit) accepts a
repository plus a plugin folder and tracked branch/tag; the directory reads that
folder. Before submission, select and test a complete source/distribution strategy
with a real executable entry and an explicit dependency/bootstrap policy. Do not
submit the current template path as if it already contained its bundled runtime.
The CLI's static pass is narrower than the portal's validation/security scan.

## Owner submission sequence, once the gates clear

1. Use an existing eligible Claude organization/account and connect the GitHub
   account that can push to the repository. The current
   [submission access rules](https://claude.com/docs/directory/publish) require a
   paid Claude plan; no plan is purchased here. Free GitHub/npm/local distribution
   does not depend on paying for a directory listing route.
2. Prepare complete installable plugin source at a reviewed branch/tag, listing
   metadata, license, privacy/support links and required listing assets. Use the
   [official pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist)
   for folder completeness, exact-version launchers, size/file limits and secret
   handling; a bundled dependency tree may require additional reviewer inspection. Validate
   that exact folder and commit. Record real client startup and the advertised
   workflows; do not substitute cold SDK discovery for native proof.
3. Prepare permitted reviewer access and three genuinely working examples. The
   local worksheet, evidence/draft flow and tracker export can supply synthetic
   examples, but they do not certify the browser tools or authorize account reads.
4. Open [the developer portal](https://claude.ai/directory/manage), choose Plugin
   bundle, select repository/folder/tracked reference, then Validate. Complete
   listing, data-handling and compliance fields truthfully. A fresh commit needs
   fresh validation; portal checks exceed the local manifest validator.
5. Submit only with owner authorization and eligibility evidence. Track findings,
   fix/revalidate the selected source, and publish only after the required review.
   A passing scan is not automatically a live listing. Do not create duplicate
   submissions or enable unattended publication without the owner's decision.

This is a preparation sequence, not permission to connect accounts, accept terms,
share credentials, contact Anthropic, submit or pay for access. No action above
was carried out through the portal in this milestone.

## Low-cost future options — hypotheses to validate

- A separately isolated offline-only plugin exposing just user-supplied evidence
  preparation/export could avoid the third-party browser interface. It would need
  a separate narrow server entry, no browser tools/dependencies, truthful branding
  and its own review. It is not built or pre-approved, and must not be marketed as
  the full LinkedIn connector.
- A permitted provider or approved Connector integration could provide a different
  route if grants, scope and policy actually allow it. Do not assume such a
  LinkedIn integration exists or that personal login grants directory eligibility.
- Remote HTTPS/OAuth is a distinct per-user security, privacy, support and cost
  design. Do not promise unlimited free hosting or build it merely to bypass
  review. No remote hosted service is required for the current local release.

These are project planning options, not announced Anthropic features or forecasts
of approval, stars or Trending. Required new maintainer service spend in the
completed local/source work remains $0; future portal/hosting choices are separate.
