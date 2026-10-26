# PR46 cleanup evidence repair — offline only

Base: `2e3c73fac2dba202cf6e3e3d87f0f3cab55eadc7`. This isolated repair
addresses the independent review's P2 evidence gap. It does not change either
draft PR head, establish browser cleanup, or clear the new dependency findings.

## Proven defect and correction

A held-session monitor failure threw before the old verifier's final process
observations. Its `finally` block attempted disposal but never recorded immediate
and bounded final observations. The Mac Node22 job in run39733072483 took this
path; its underlying monitor failure remains unknown. Mac Node20 separately
recorded two survivors. Both historical jobs and all earlier receipts remain failed.

The verifier now uses one common finalization path after success or failure.
It attempts disposal once under the existing30-second deadline, stops monitoring,
and records immediate/final cleanup under the existing5-second polling bound and
unchanged platform probe deadlines. The original safe failure stage/code and
latched monitor failure survive later clean observations. PROCESS_OBSERVATION_FAILED
is an explicit fixed public classification; raw errors, PIDs, commands and paths
are not added to output. Failed runs retain their temporary directory. No killing,
process exemption, ownership rule, identity rule or browser default changes.

## Focused evidence

- Vitest4.1.12, isolated copied dependencies matching the frozen baseline:
  **146 tests pass in5 files**, including7 new lifecycle-finalization regressions.
  These cover monitor failure followed by clean final observation, earlier
  non-monitor failure, known delayed exit, disposal exception,30-second teardown
  timeout, failed immediate inventory, and persistent survivors at the original
  5-second bound. Existing cleanup, POSIX/Windows accounting and search-only
  runner fixtures also pass. Only synthetic inventories/timers and disposable
  Node fixture processes are used; no Chrome session or account is accessed.
- Validation-script typechecking, formatting of all4 changed/new TypeScript files,
  and diff whitespace checks pass.
- First focused run:145 passed,1 failed. The new persistent-survivor test asserted
  exactly5000ms but observed5001ms because its verifier clock still read real
  monotonic time while timers were mocked. The test now drives the monotonic
  clock and timers together. Production clocks, deadlines and assertions remain
  unchanged; this failed test attempt is retained here rather than erased.

No full suite, install, production audit, actual browser run, hosted rerun, package
build, account request, publication or release verification is claimed. The root
review/integration and exact-head gates remain required. This repair improves
failure evidence; cleanup, usefulness and dependency clearance remain blocked.
