# 4.1.2 — unreleased security patch candidate

Preparation only. Based on dependency repair 9befcc393d39b610d1346fd6289247c098ea8a73
(PR #48), stacked for review; no merge or publication is implied.

- Runtime: Zod 4.6.7, body-parser 2.4.0, fast-uri 3.1.9 and ip-address 10.7.5
  address newly reported October 26 findings. Internal Zod 4 record declarations
  were migrated without intended MCP contract changes.
- Publisher: locked ip-address 10.7.5 and undici 6.29.1 replacements, with
  npm 12.2.0, cache guard, exact replacement checks and OIDC policy retained.
- 24 core tools, including local worksheet/CSV export; no research_jobs,
  application submission or new provider route. Existing safety/identity,
  writes-disabled defaults and 10,000-element SDK input guard remain.

This is a patch because the repaired validation library is internal to the
MCP server; no intentional tool/schema/workflow expansion is introduced.
Required source/package/installed-consumer/hosted/dry-run gates still apply.
Historical 4.1.1 bytes/tag/assets remain immutable; their old zero audits do not
clear current findings. A candidate archive/MCPB is not a public 4.1.2 release.

Only after separately reviewed integration and authorized automated publication
may all four destinations, provenance/integrity and exact tag/source be verified.
The default public MCPB pin remains 4.1.1 until replacement public archive bytes
are independently verified. Native/live/cohort/privacy/directory gates remain
separate and unproven. Mandatory maintainer cash stays $0.
