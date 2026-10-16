# Selected-profile retirement (unreleased source)

## Purpose and scope

`--retirement-preview` is read-only. The separate `--retire-profile
--confirm-retirement` command removes the selected browser profile and its
sibling circuit file after a fresh bounded scan. A configured custom profile
also requires `--confirm-profile-deletion`. This is a local privacy operation;
it does not contact LinkedIn or launch Chrome.

The circuit contains checkpoint safety state, so this command intentionally
resets that state for the selected profile. It **does not** delete shared
budgets, the write journal, legacy credentials, other profiles, client-held
data, backups or evidence. It is not complete data erasure and must not be used
to recover from a LinkedIn checkpoint or to reset write limits.

## Procedure

1. Stop this profile's MCP runtimes and Chrome. Run the preview and inspect
   its path-free counts and fixed refusal reason. Review the configured
   `LINKEDIN_PROFILE_DIR` separately before confirming a custom path.
2. The apply command repeats inventory and a bounded profile scan. It refuses
   aliases, hard links, unexpected types, overlap with home or cwd, active
   owner/transaction locks, changed metadata, and tree limits.
3. It acquires the same profile owner lock as Chrome, verifies it owns the lock,
   rescans the profile and circuit, and writes a private fsynced interruption
   marker. It renames the profile to a random sibling quarantine, verifies the
   moved manifest, and removes only individually checked members. A new child
   makes directory removal fail while leaving that child untouched. It then
   rechecks, quarantines and removes the circuit. On success it releases the
   owner lock before removing the marker.
4. Success returns only fixed scope, boolean removal results and preserved
   categories. Failure returns a fixed reason and exit 1; no path, filename,
   identifier, content or raw exception is printed.

## Interruption and limits

The marker blocks another preview, apply, normal browser startup or logout
after a partial failure. The owner lock is also retained. The
quarantine may still contain credentials. Stop all processes before local
inspection. Do not delete the marker or quarantine just to make the command
pass; determine which objects remain and retain a private recovery record.
There is no automatic rollback or retry of a failed retirement.

An fsynced file without a proven parent-directory sync is not a power-loss
recovery guarantee. The lock coordinates this project's compliant runtimes. It does not prove
that an unrelated process has closed handles or that a hostile same-account
process cannot race the filesystem. Directory and file observations are
rechecked, but Node's path-based unlink and rmdir calls are not transactional
filesystem primitives against hostile same-account races. Complete shared-state erasure requires a separate all-profile
protocol and explicit acknowledgement of replay-protection loss.

## Verification gate

Disposable fixtures must demonstrate confirmation refusal, active-lock and
alias refusal, exact selected-state removal, byte-identical shared journal and
legacy credentials, and a retained marker on interrupted removal. The built
installed CLI must pass the same offline scope without browser or account
access. Source tests, lint, types, metadata, build, exact package checks and
hosted platform checks are required before merge. This document alone does
not authorize running the command against a user's real profile.
