# Disclaimer & Account-Safety Notice

**Read before use.**

This project automates access to LinkedIn using a real browser session. It is
**not affiliated with, endorsed by, or sponsored by LinkedIn.**

## This is unofficial automation

LinkedIn's User Agreement prohibits automated access and scraping. Using this
tool may result in your account being **warned, rate-limited, restricted, or
permanently banned**, regardless of how carefully it is configured. There is
**no such thing as an undetectable or ban-proof** LinkedIn automation tool —
anyone claiming otherwise is wrong.

## What the safety features do and do not do

The built-in rate limits, human-paced delays, daily action budgets, warmup
ramp, and challenge kill-switch are **risk-reduction measures only**. They
lower — but do **not** eliminate — the chance of detection or a ban. They are
not a guarantee of safety or compliance.

## Cloudflare / detection

Data tools work by driving a stealth browser (patchright) that passes
Cloudflare bot-management. This is an ongoing cat-and-mouse game: Cloudflare and
LinkedIn update their detection regularly, and access **can break at any time**.
Datacenter, VPN, and CI IP addresses are frequently pre-flagged and may be
blocked outright.

## Recommendations

- Use a **dedicated / secondary account**, never your primary professional one.
- Run from a **stable residential IP**, not a datacenter or VPN.
- **Warm up** new accounts slowly; respect the default budgets.
- Treat any **checkpoint, captcha, or "unusual activity" prompt** as a stop
  signal — the tool will halt automatically; do not bypass it.

## Data & privacy

You are responsible for complying with **GDPR, CCPA**, and all applicable laws
regarding any personal data you access or store. Cookies and session data are
stored locally with restricted permissions and are never logged.

## No warranty

This software is provided **"AS IS", without warranty of any kind**. The authors
are not liable for any account restrictions, data loss, legal consequences, or
other damages arising from its use. **Use at your own risk.**
