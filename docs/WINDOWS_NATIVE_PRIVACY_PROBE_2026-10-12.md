# Native Windows second-user privacy probe

This draft probe uses only disposable synthetic state on a public GitHub-hosted
Windows runner. It tests whether a separate unprivileged account can read or
modify the profile directory, a nested profile file, circuit and budget files,
and actual profile-owner and budget-transaction locks. Targets are created
through the production Windows ACL guard, real `StateLock`,
`CircuitFileStorage` and `BudgetTracker` paths. The expanded matrix also tests
creation by an ordinary unprivileged user against a second ordinary user.
No Chrome, login, LinkedIn request, real profile or real journal is involved.

The probe runs in the runner account's user profile, a nested home-contained
custom location and an ordinary creator's user profile. A deliberately public
custom parent must be refused before any state is created. Any successful
second-user read/write,
missing privilege to create the probe account, process failure or uncertain
result fails the job. It prints only fixed status codes and counts, with no
synthetic password or target path. The local account and both disposable roots
are removed in `finally`.

This is a **measurement** of PR #24's proposed guard, not proof for every
Windows setup. Released 3.1.0's `0700`/`0600` requests do not configure an NTFS
DACL. The draft guard uses a protected DACL at directory creation, checks
existing state and refuses paths outside the native user profile. Existing
exposed data are not repaired by this change. Do not weaken or skip the
public-parent refusal to make the probe green.

The same test must ultimately run at a reviewed implementation head and report
denied read **and** modification of all exact targets. It still will not prove
that existing user profiles have safe ACLs, that a privileged administrator is
blocked, or that all filesystem aliases and races are excluded. Keep the setup
guide's Windows privacy warning until those limits are addressed explicitly.

## First native result (2026-10-12)

At draft head `7fed8bf`, the [native probe](https://github.com/devag7/linkedin-mcp/actions/runs/38213175092)
failed with `SECOND_USER_ACCESS_NOT_REFUSED:public_custom:100`. The
`user_profile` location completed all five targets first, with read and write
refused. Code `100` means the second user could list the profile directory in
the public custom location; later targets were not attempted. This proves the
current mode requests do not protect that public custom path on the runner. It
does not prove other machines' default paths safe. No production state was used.

Two earlier probe runs are retained as harness evidence only: the initial run
lost the child exit classification; the next could not obtain a child receipt.
The third classified exposure under `RUNNER_TEMP`, which is not an account-home
parent on this runner. The corrected fourth run above uses `USERPROFILE` for the
default-style case and a public custom parent separately. Do not cite the
earlier harness failures as ACL proof.

## PR #24 repair attempts (2026-10-13 to 2026-10-14)

The revised guard creates new state directories with a protected current-user,
SYSTEM and Administrators DACL and verifies existing components before use.
It treats the user home as an ancestor whose replacement authority must be
safe; the private state directory itself still rejects untrusted allow ACEs.
The exact TrustedInstaller service SID is accepted only as an above-home
ancestor owner. No service-owner wildcard or updater exemption is used.

The [Node 22 native probe at `a5a7b32`](https://github.com/devag7/linkedin-mcp/actions/runs/38547391920)
passed denial of both read and write across 12 home-contained targets and
refused the public parent before creation. Its fixture creator was the elevated
runner, so this did not establish ordinary-user creation. The earlier failed
runs remain failed. The Windows source/package matrix at that head exceeded
the package verifier's old 30-second offline setup deadline and had not
completed its full source suite when superseded; it is not a passing CI gate.

Microsoft [documents a PowerShell module-path issue](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_psmodulepath?view=powershell-7.6#starting-windows-powershell-from-powershell-7)
when PowerShell 7 starts Windows PowerShell through an intermediate process.
The draft now removes `PSModulePath` only from the verifier child environment;
Windows CI then passed private fixture-directory preparation. The original
exception class was not retained, so the precise earlier failure mechanism
remains an inference until a native regression confirms it.

At head `53974ba`, the first ordinary-user creator/attacker matrix failed at
fixture creation on both Node 20 and 22, before access checks. A subsequent
draft adds fixed failure-stage reporting. Neither run can be used as privacy
proof. Keep PR #24 draft until exact-head ordinary-user probes, source/package
CI, negative ACL fixtures and independent review pass. Host-specific ACLs,
privileged administrators and hostile same-account races remain explicit
limits. An after-the-fact ACL change would leave a creation-time exposure
window, which is why new directory creation uses the native DACL overload.

At [`42f64c7`](https://github.com/devag7/linkedin-mcp/commit/42f64c7), the
[ordinary creator/attacker matrix](https://github.com/devag7/linkedin-mcp/actions/runs/38550152060)
passed on Node 20 and 22: all 18 private targets denied read and write, and
the public custom parent was refused before creation. Windows returned no
process exit code for the alternate-credential creator after it exited; the
test accepted only its fixed success receipt, exact registry-backed profile
root and subsequent actual target probes. The [package matrix](https://github.com/devag7/linkedin-mcp/actions/runs/38550152012)
still failed at installed stdio startup with `CIRCUIT_STATE_UNREADABLE`. The
source matrix was still running when this was recorded. Both remain release
blockers. The next draft retains only a fixed underlying Windows refusal code
through that generic circuit error and adds four disposable negative fixtures:
untrusted existing child ACL, junction escape, spoofed home and helper failure.
These new checks are pending native evidence.

References: [Microsoft file security and default descriptor inheritance](https://learn.microsoft.com/en-us/windows/win32/fileio/file-security-and-access-rights),
[PowerShell alternate-credential process execution](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process?view=powershell-5.1).

## Final draft-head evidence (2026-10-15)

At `fff0622`, the [native Windows probe](https://github.com/devag7/linkedin-mcp/actions/runs/38631379199)
passed on Node 20 and 22: all 18 synthetic targets across three private roots
denied second-user reading and modification. Six targets were created by an
ordinary unprivileged user. Public custom creation was refused, and
nine negative cases passed. These include a deep unsafe file, a nested junction,
an inherit-only untrusted grant and failed verifier startup. The
[packed artifact matrix](https://github.com/devag7/linkedin-mcp/actions/runs/38631379412)
passed on both Windows Node versions. Installed offline Claude Desktop, Cursor
and VS Code SDK connections took about 1.2–1.7 seconds each; real temporary
Chrome cleanup observed ten processes and ended at zero on each runner.

That CI run still failed its two Windows source jobs: three high-volume budget
tests each exceeded Vitest's 60-second limit. The tests' Windows counter
fixture had mocked file verification but not the directory guard used by each
state lock. The follow-up mocks that guard only inside the counter unit suite;
native probe and packed-package flows still invoke the production guard.
At `bbbe88e`, local 742 tests, metadata, lint, types and installed-package
checks pass. The [exact-head CI run](https://github.com/devag7/linkedin-mcp/actions/runs/38683704773)
passed all 12 jobs, including the restored 180-second package deadline and
both Windows source suites (738 passed, four skipped per Node version). The
[exact-head native run](https://github.com/devag7/linkedin-mcp/actions/runs/38683704776)
passed both Windows Node jobs with the same 18-target and nine-negative-case
counts. The earlier failed CI remains failed and is not counted as proof.
Independent read-only review found no code blocker. It identified the earlier
18-target wording error, corrected here; the review did not test new Windows
machines or prove preservation of content behind a nonempty junction target.

These results demonstrate behavior on the hosted runner's tested ACLs. They
do not establish privacy for previously exposed state, every Windows policy,
privileged administrators or hostile same-account races. Live LinkedIn and
native client application compatibility were not tested.
