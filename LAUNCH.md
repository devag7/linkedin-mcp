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
npm test                       # 135 tests must pass
npm publish --tag alpha        # ships 2.0.0-alpha.1 WITHOUT moving `latest`
```

`--tag alpha` is important: it keeps v1 as `latest` so existing `npx linkedin-mcp-tools`
users aren't broken by the headful/login requirement. Promote when stable:

```bash
npm dist-tag add linkedin-mcp-tools@2.0.0 latest   # later, once out of alpha
```

Then tag + push the release:

```bash
git push -u origin v2-stealth-engine
git tag v2.0.0-alpha.1 && git push --tags
# open a PR v2-stealth-engine -> main, or merge if you're confident
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

> **LinkedIn MCP** — profiles, search, jobs, companies, feed, and messaging as
> structured JSON. Stealth-browser engine (passes Cloudflare), headless-capable,
> with built-in rate-limiting and a safety circuit-breaker.

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
> It logs in headful once, then runs headless on a server. There's a built-in
> safety layer (per-action daily caps, human-paced delays, and a circuit breaker
> that hard-stops on any checkpoint) — risk reduction, not a guarantee. I'm
> upfront in the README: no LinkedIn automation is ban-proof.
>
> TypeScript, 12 tools, 135 tests. Feedback welcome, especially on the
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

3/ Logs in once with a window, then runs headless on a server. Built-in daily
caps + human pacing + a kill-switch on any checkpoint. No tool is ban-proof and
I say so in the README. TS, 12 tools, 135 tests. ⭐ + feedback welcome: [repo]

---

## 7. The honest comparison (README hook + every post)

| | DOM-scraping LinkedIn MCPs | This |
|---|---|---|
| Data | scraped page text (brittle, locale-bound) | **structured API JSON** |
| Headless | flaky | **verified** |
| Safety (caps/pacing/breaker) | none | **built-in** |
| Zombie browser processes | common | **reaped on close** |

Lead with this. It's true, specific, and credible — which is what earns the star.
