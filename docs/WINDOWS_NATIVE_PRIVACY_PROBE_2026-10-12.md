# Native Windows second-user privacy probe

This draft probe uses only disposable synthetic state on a public GitHub-hosted
Windows runner. It creates one separate, unprivileged local account and tests
whether that account can read or modify a profile directory, a nested profile
file, the shared budget/journal file and both owner/transaction lock files.
Targets are created through the project's Node filesystem modes, real
`StateLock` and real `BudgetTracker` persistence code. No Chrome, login,
LinkedIn request, real profile or real journal is involved.

The probe runs in two locations: the runner account's user-profile parent and a
deliberately public custom parent. Any successful second-user read/write,
missing privilege to create the probe account, process failure or uncertain
result fails the job. It prints only fixed status codes and counts, with no
synthetic password or target path. The local account and both disposable roots
are removed in `finally`.

This is a **measurement**, not an ACL repair or proof for every Windows setup.
The release's current `0700`/`0600` requests do not configure an NTFS DACL.
Windows gives newly created files and directories a default security descriptor
inherited from their parent. A result in the account-local parent cannot be
generalized to an arbitrary custom parent. If the public-parent probe exposes
state, keep this PR blocked until a separate reviewed native DACL design either
creates a private root before any sensitive write or refuses unsafe locations.
Do not weaken the probe or skip the public-parent case to make it green.

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

Keep this PR draft/blocked. A remediation must create a private native DACL
before any sensitive write or refuse unsafe custom locations before writing,
then pass the same second-user probe and independent review. An after-the-fact
ACL change would leave a creation-time exposure window.

References: [Microsoft file security and default descriptor inheritance](https://learn.microsoft.com/en-us/windows/win32/fileio/file-security-and-access-rights),
[PowerShell alternate-credential process execution](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process?view=powershell-5.1).
