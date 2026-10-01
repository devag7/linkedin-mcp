# Review boundaries for cumulative local work

The original roadmap requires a separate reviewable PR per item. This cumulative
draft PR is an integration checkpoint and does not mark that requirement or human
review complete. The cumulative
implementation is now assembled on `codex/roadmap-zero-cost-integration`, based on
upstream `e368b61`, with four ordered commits: runtime safety/contracts and their
regressions; package/metadata/dependencies; CI/release/browser proof; and roadmap
documentation. The six boundaries below are reviewer lenses within this branch.
Safety and protocol files depend on each other, so splitting their shared runtime
mechanically would produce incomplete intermediate changes. Review the cumulative
PR with these boundaries and the attached evidence, then keep it unmerged until
its hosted checks and human review pass. No version bump or release is included.

Never push this work directly to main, where release automation is version-driven.
The original roadmap and pr_diff.txt retain their checksum-verified bytes; the
latter remains an unrelated untracked file and is excluded from the PR. Backups
remain outside iCloud. Retain tests/docs with the implementation they prove.

| Review | Problem/result | Primary boundary | Required validation / rollback |
| --- | --- | --- | --- |
| 1 HTTP containment | Explicit authenticated loopback, resource bounds and shared process runtime | HTTP transport, server runtime, HTTP/protocol tests, security docs | Unauthorized request matrix; rollback by disabling HTTP, not reopening unauthenticated access |
| 2 checkpoint stop | Hard signals persist and stop future calls; manual verified recovery | Browser safety/circuit storage, engine/Voyager/DOM/guard/login; checkpoint suite | Raw/MCP/restart/recovery proof; preserve circuit state on rollback |
| 3 write transaction | Reserve before dispatch, classify in guard, preserve unknown/replays and cooldowns | Guard, write/status/journal/budgets and write suite | Five-tool MCP and interrupted-operation proof; disable writes instead of discarding journals |
| 4 identity/ownership | One runtime owns profile; verified member keys and atomic shared budgets | State locks/account binding/budget/engine lifecycle | Independent-process contention, corrupt state and cleanup; old versions must not overwrite new fields |
| 5 truth/install | Recover cloud-sync loss; doctor/cold sessions, metadata/config/docs and packaged license | Restored docs/metadata, env isolation, doctor/index, package and CI | Clean source/packed gates, registry schema/drift; publishing/hosted/live first-use remain separate |
| 6 contracts/workflows | Native/text/schema/error parity, bounded pages, previews/alpha flags and cancellation | Tool registration/contracts/catalog/pagination, cancellation/pacing, normalized source URLs; fixtures and guides | All-tool MCP/client validation, queue cancellation, paging boundaries and no-provider previews; retain compatible text and state |

Some files necessarily cross review boundaries. Use the dated evidence documents
and current coverage table to preserve dependency order rather than cutting a
file mechanically. Rollback must keep safety reservations/hard stops; never downgrade
shared state to code that strips added fields. Hosted/live approvals are exit gates,
not assumptions a reviewer can infer from synthetic tests.
