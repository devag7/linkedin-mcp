# Private GitHub adoption traffic ledger

**Scope:** owner-run, local-only tracking for the 10,000-star and GitHub
Trending daily ambitions. This records GitHub repository traffic and public
star totals. It does not collect LinkedIn data, volunteer rows, stargazer
identities, install telemetry or analytics from users.

GitHub's [traffic API](https://docs.github.com/en/rest/metrics/traffic)
returns only the latest 14 days of views and clones. The owner must have
repository traffic access; a fine-grained token needs repository
Administration **read** permission. Capture roughly weekly so the rolling
window is not lost. No paid service or token stored by the script is required;
it uses the owner's existing authenticated GitHub CLI.

From a reviewed source checkout on macOS or Linux:

    node scripts/github-traffic-ledger.mjs capture
    node scripts/github-traffic-ledger.mjs report

The default private ledger is
`~/.codex/backups/linkedin-mcp/adoption-ledger/traffic.json`. The script
creates its directory with mode 0700 and the file with mode 0600; it refuses
broader permissions and repository-local output. To use a different private
location, pass `--file /absolute/private/traffic.json` after `capture` or
`report`. Windows access is refused until an NTFS ACL path is reviewed;
POSIX mode bits are not proof of Windows privacy.

Each capture reads the public repository star/fork totals plus the owner's
views, clones, top referrers and top paths. Referrer/path rows remain only in
the private ledger; the console report prints aggregates. All calls are
read-only. If a GitHub call fails, the ledger is not updated. Keep this
private file out of Git, cloud sharing, issue comments and volunteer reports.

The report chooses the most recent observation for an overlapping UTC day
before summing daily **counts**. It does not sum unique visitors/cloners
across days or windows: the same person can appear again. A month is marked
complete only when all its days were observed after the month ended. Missing
days remain missing rather than becoming zero. GitHub clone counts may
include automation, including CI, and cannot establish npm installs, unique
people or successful first reads. Trending inclusion must be separately
observed on the dated daily page; this ledger does not infer it.

## First baseline

At **2026-10-19 09:52:24 UTC** (15:22 IST), the first owner-side capture
recorded 10 stars. Its rolling 14-day GitHub window reported 58 views
(31 window uniques) and 3,917 clones (538 window uniques). These are
GitHub's reported window values, not a conversion funnel. October had only
14 observed days, so no complete monthly traffic total or star-growth delta
exists yet. The private referrer/path rows and daily records are not
published.

The first-use cohort remains **0/0, unmeasured**. Keep consented first-use
and repeat-use results under the separate
[4.1.0 scoring guide](FIRST_USE_RESULTS_4.1.0.md). For the next review,
compare a new weekly star/traffic snapshot with actual first-use outcomes;
fix the largest observed onboarding failure before broader promotion.
