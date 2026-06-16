# Launch Kit

Everything needed to ship v2 and get it in front of people. The product is the
hard part and it's done — this is distribution.

> Honest framing for every post below: lead with **what it does**, not hype.
> "Structured data, not scraped DOM" + "no tool is ban-proof" reads as credible
> and outperforms superlatives. Never claim "undetectable" or "ToS-compliant".

---

## 1. Publish to npm

```bash
npm run build
npm test                       # 166 tests must pass
npm publish --tag next         # publish 2.0.0 WITHOUT moving `latest` yet
```

`--tag next` is deliberate: v2 is a breaking change (real browser + one-time
`--login` instead of v1's cookie paste), so don't auto-upgrade existing
`npx linkedin-mcp-tools` users. Smoke-test the published tag, then promote:

```bash
npm dist-tag add linkedin-mcp-tools@2.0.0 latest   # make it the default install
```

Then tag + push the release:

```bash
git push origin main
git tag v2.0.0 && git push --tags
```

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
