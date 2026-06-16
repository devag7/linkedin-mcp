# Launch Kit

Everything needed to ship v2 and get it in front of people. The product is the
hard part and it's done — this is distribution.

> Honest framing for every post below: lead with **what it does**, not hype.
> "Structured data, not scraped DOM" + "no tool is ban-proof" reads as credible
> and outperforms superlatives. Never claim "undetectable" or "ToS-compliant".

---

## 1. Releasing (automated — GitHub Actions)

Releases are **version-driven and automatic**. CI (`.github/workflows/ci.yml`)
lint/typecheck/test/builds every push + PR. `release.yml` fires on push to `main`:
if `package.json`'s `version` has **no `v<version>` git tag yet**, it

1. creates a **GitHub Release** (`v<version>`, auto-generated notes, `dist/index.js` attached),
2. publishes to **npm** (`linkedin-mcp-tools`), and
3. publishes to **GitHub Packages** (`@devag7/linkedin-mcp-tools`) — this is what
   makes the package show up in the repo's **Packages** sidebar.

So to cut a release:

```bash
npm version patch            # or minor / major — bumps package.json + tags locally
#   ^ the version is the single source of truth; whoami / health_check /
#     --version all read it (src/version.ts). Nothing else to edit.
git push origin main         # CI runs, then release.yml publishes everywhere
```

Pushing again at the same version is a **no-op** (the tag already exists) — no
double-publish, no spam releases.

**One-time setup (required for npm publishing to work):**

1. Create an **npm automation token**: npmjs.com → Access Tokens → Generate →
   *Automation*. Copy it.
2. Add it as a repo secret: GitHub repo → Settings → Secrets and variables →
   Actions → New repository secret → name **`NPM_TOKEN`**, paste the token.
3. GitHub Packages needs no secret — it uses the built-in `GITHUB_TOKEN`.

> First publish of `2.0.0` is a breaking change vs v1 (real browser + `--login`
> instead of cookie paste). If you have existing v1 users on `latest`, consider
> publishing the first v2 under a dist-tag instead of `latest`:
> `npm publish --tag next` locally, smoke-test, then
> `npm dist-tag add linkedin-mcp-tools@2.0.0 latest`. (The workflow publishes to
> `latest` by default — fine for a fresh package.)

---

## 2. Submit to MCP directories (where buyers actually look)

Each of these is a ranked list people browse to find MCP servers — high-intent traffic:

- **modelcontextprotocol/servers** — PR to the community list (github.com/modelcontextprotocol/servers)
- **mcp.so** — submit at mcp.so/submit
- **Smithery** (smithery.ai) — add the repo; it auto-builds
- **Glama** (glama.ai/mcp/servers) — submit
- **PulseMCP** (pulsemcp.com) — submit
- **Cursor Directory** (cursor.directory/mcp) — submit
- **mcpservers.org**, **mcp-get.com** — submit
- **awesome-mcp-servers** (punkpeye/awesome-mcp-servers) — PR adding a one-liner

One-liner for directory entries:

> **LinkedIn MCP** — profiles, people/job/company search, feed, and messaging as
> structured JSON, plus **gated writes** (connect, message, post, react, comment)
> that hit LinkedIn's API directly instead of clicking buttons. Stealth-browser
> engine (passes Cloudflare), headless-capable, built-in rate-limiting + safety
> circuit-breaker. 22 tools, 166 tests.

---

## 3. Demo GIF (record this — 25 seconds)

Nothing converts like seeing Claude do it live. Record in Claude Desktop:

1. Show the `mcpServers` config (2s).
2. Ask: *"Get my LinkedIn profile and summarize my experience."* → `get_my_profile` returns, Claude summarizes.
3. Ask: *"Find 5 recruiters at Google and their profiles."* → `search_people`.
4. Ask: *"What jobs match 'backend engineer'?"* → `search_jobs`.

Tools: Kap / Gifox (macOS) → drop the GIF at the top of the README.

---

## 4. Show HN

**Title:**
> Show HN: A LinkedIn MCP that returns structured data instead of scraping the DOM

**Body:**
> I built an MCP server that gives Claude/Cursor access to LinkedIn — profiles,
> people/job/company search, feed, and messaging — as clean structured JSON.
>
> The interesting part is *how*. LinkedIn's internal Voyager API is behind
> Cloudflare bot-management, so a plain `fetch` gets stuck in a redirect loop
> even with a valid cookie. Instead of scraping the rendered DOM (brittle, breaks
> on every UI tweak), it drives a real stealth Chrome to clear the Cloudflare
> challenge, then queries Voyager *from inside the authenticated page* —
> same-origin, the exact path the web app uses — so you get the structured API
> response, not parsed page text. It's locale-independent and survives redesigns.
>
> The writes (connect / message / post / react / comment) work the same way:
> instead of clicking rendered buttons — which is where most LinkedIn automation
> breaks (the Connect button hides under a "More" menu, the message composer is a
> race) — it POSTs the exact requests the web app sends. I captured each one off
> the live SPA and verified them on a burner, and every write returns a structured
> status (ok / duplicate / already_connected / restricted / quota_exhausted)
> instead of a hopeful "I clicked it."
>
> It logs in headful once, then runs headless on a server. Built-in safety layer
> (per-action daily caps, human-paced delays, circuit breaker that hard-stops on
> any checkpoint) — risk reduction, not a guarantee. I'm upfront in the README:
> no LinkedIn automation is ban-proof (I burned through a few test accounts
> proving it).
>
> TypeScript, 22 tools, 166 tests. Feedback welcome, especially on the
> Cloudflare/stealth approach.
>
> Repo: https://github.com/devag7/linkedin-mcp

Post Tue–Thu, ~9am ET. Reply to every comment in the first 2 hours.

---

## 5. Reddit

**r/LocalLLaMA / r/ClaudeAI / r/mcp** title:
> Made a LinkedIn MCP for Claude — structured JSON (not DOM scraping), runs headless

Body: the same hook, 3 bullets (what it does / how it beats DOM scraping / honest
ban caveat), the demo GIF, repo link. Engage in comments.

---

## 6. X / LinkedIn thread

1/ Gave Claude access to LinkedIn as an MCP server — profiles, search, jobs,
companies, messaging — all as structured JSON. Demo 👇 [GIF]

2/ The trick: LinkedIn's Voyager API sits behind Cloudflare. A plain fetch loops
forever. So it runs a real stealth browser to pass the challenge, then calls the
API *from inside the page*. Structured data, not scraped DOM — survives UI
changes + works in any locale.

3/ Writes too — connect, message, post, react, comment — but as direct API
POSTs, not button-clicking (where LinkedIn bots usually break). Each one captured
off the live app + verified, returning a real status, not "I clicked it."

4/ Logs in once with a window, then runs headless on a server. Built-in daily
caps + human pacing + a kill-switch on any checkpoint. No tool is ban-proof and
I say so in the README. TS, 22 tools, 166 tests. ⭐ + feedback welcome: [repo]

---

## 7. The honest comparison (README hook + every post)

| | DOM-scraping LinkedIn MCPs | This |
|---|---|---|
| Reads | scraped page text (brittle, locale-bound) | **structured API JSON** |
| Writes | click rendered buttons (break on UI changes) | **direct Voyager `POST`, captured + verified** |
| Write feedback | "clicked it" → hope | **structured status** (ok/duplicate/restricted/…) |
| Headless | flaky | **verified** |
| Safety (caps/pacing/breaker) | none | **built-in, 166 tests** |
| Zombie browser processes | common | **reaped on close** |

Lead with this. It's true, specific, and credible — which is what earns the star.
The writes row is the freshest, hardest-to-copy edge: most LinkedIn MCPs only
read, or write by clicking; verified API writes with real status codes are rare.
