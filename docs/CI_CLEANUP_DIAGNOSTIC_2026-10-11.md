# Offline Chrome cleanup gate — October 11, 2026

The 3.1.0 candidate at `2eda5893e1f6307ad3046592829f5c7f91550e80`
passed 11 of 12 hosted CI jobs on the first attempt. Its Windows/Node 20
packed-artifact job installed Chrome, launched the temporary offline profile,
then failed `CHROME_CLEANUP_NOT_VERIFIED` in
[run 38149848797, attempt 1](https://github.com/devag7/linkedin-mcp/actions/runs/38149848797/attempts/1).
The verifier collapsed context close, engine state, ownership lock and process
selection into that single code. The original receipt cannot identify which
predicate failed or whether a real profile process survived. Preserve it as a
failed gate.

One failed-job-only retry at the same source SHA passed. It observed ten Chrome
processes and zero at cleanup, with context closed and ownership released.
Intermittency is established; the first failure is not retroactively cleared
or explained. The 3.1.0 dry run passed 10/10, publication skipped, and its
hosted 15-file archive matched the local archive exactly. These separate gates
do not override the cleanup failure.

The follow-up changes only offline validation scripts and disposable tests. It
uses native process birth identity in addition to PID, validates each inventory,
tracks observed descendants across reparenting and treats uncertain or failed
probes as failures. Cleanup emits fixed counts and booleans for immediate and
bounded final observations, never PIDs, commands, paths, birth stamps or raw
native errors. There is no process kill, updater exclusion, browser fallback,
LinkedIn request or production runtime change. The process-accounting modules
and their fixtures were taken from the independently reviewed offline work in
blocked PR #5; the experimental job brief is excluded.

Disposable process tests cover PID reuse, stale ancestry, malformed inventories,
probe errors, redaction and delayed exits. The Mac temporary Chrome check passed
locally. A fresh exact-head Windows lifecycle run is required to determine whether
this verifier can establish clean teardown on hosted Windows. The historical
failure's actual cause may remain unknown even if subsequent runs pass; do not
claim it was fixed by a particular process identity case without evidence.
