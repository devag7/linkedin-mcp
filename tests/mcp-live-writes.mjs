#!/usr/bin/env node
/**
 * LIVE WRITE verification harness for v2 — drives dist/index.js over JSON-RPC and
 * fires the 5 write tools against a BURNER account, printing the structured
 * status each returns. This is how "fix the writes on the burner" gets verified:
 * confirm a real `ok` (or an expected `restricted`/`duplicate`), not a guess.
 *
 * SAFETY:
 *  - Requires LINKEDIN_PROFILE_DIR to point at a BURNER profile. Never your main.
 *  - Aborts immediately if health_check is not `healthy` (re-login first).
 *  - connect / message are SKIPPED unless you pass a target, because they hit a
 *    real third party:
 *        TARGET_CONNECT_ID=<fsd_profile id>   enables connect_with_person
 *        TARGET_MSG_URN=<urn:li:fsd_profile:…> enables a new-thread send_message
 *        TARGET_MSG_THREAD=<thread id>         enables a reply send_message
 *  - create_post / react / comment are reversible on a burner (delete manually).
 *
 * Usage:
 *   LINKEDIN_PROFILE_DIR="$HOME/.linkedin-mcp/profile-burner" \
 *   node tests/mcp-live-writes.mjs
 */
import { spawn } from 'node:child_process';

const TARGET = process.env.TARGET_DIST ?? 'dist/index.js';
const child = spawn('node', [TARGET], { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });

let buf = '';
const pending = new Map();
child.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let m;
    try { m = JSON.parse(line); } catch { continue; }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  }
});
child.stderr.on('data', (d) => process.stderr.write('[server] ' + d.toString()));

let id = 0;
const rpc = (method, params) => new Promise((res) => {
  const myId = ++id; pending.set(myId, res);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: myId, method, params }) + '\n');
});
const notify = (method, params) =>
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(name, args) {
  const r = await rpc('tools/call', { name, arguments: args ?? {} });
  const text = r.result?.content?.[0]?.text ?? JSON.stringify(r.error ?? r.result ?? {});
  let parsed;
  try { parsed = JSON.parse(text); } catch {}
  console.log(`\n=== ${name}(${JSON.stringify(args ?? {})}) ===`);
  console.log(text.length > 1200 ? text.slice(0, 1200) + `\n…[+${text.length - 1200}b]` : text);
  return parsed;
}

/** Deep-find the first activity/share urn in a shaped result (react/comment target). */
function findActivityUrn(node) {
  let found;
  const visit = (n) => {
    if (found || !n) return;
    if (typeof n === 'string') {
      const m = n.match(/urn:li:(?:activity|share|ugcPost):[0-9]+/);
      if (m) found = m[0];
      return;
    }
    if (typeof n === 'object') for (const v of Object.values(n)) visit(v);
  };
  visit(node);
  return found;
}

(async () => {
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'live-writes', version: '1' } });
  notify('notifications/initialized', {});
  await sleep(100);

  // 1) Gate on a healthy live session.
  const health = await call('health_check');
  const status = health?.data?.status;
  if (status !== 'healthy') {
    console.log(`\n❌ Session not healthy (status=${status}). Re-login the burner first:`);
    console.log(`   LINKEDIN_PROFILE_DIR="${process.env.LINKEDIN_PROFILE_DIR ?? ''}" LINKEDIN_HEADLESS=false npm run login`);
    child.kill(); process.exit(1);
  }
  console.log('\n✅ Session healthy — proceeding with write verification.');

  // 2) create_post (reversible on a burner).
  await call('create_post', { text: `v2 write-verify ${new Date().toISOString()} — test post, safe to delete`, confirm: true });
  await sleep(2000);

  // 3) react + comment on a real feed post.
  const feed = await call('get_feed', { count: 5 });
  const target = findActivityUrn(feed);
  if (target) {
    console.log(`\n→ react/comment target: ${target}`);
    await call('react_to_post', { post_urn: target, reaction: 'LIKE', confirm: true });
    await sleep(2000);
    await call('comment_on_post', { post_urn: target, text: 'v2 write-verify — test comment', confirm: true });
    await sleep(2000);
  } else {
    console.log('\n⚠️  No activity urn found in feed — skipping react/comment (empty feed?).');
  }

  // 4) connect — only with an explicit target (hits a real third party).
  if (process.env.TARGET_CONNECT_ID) {
    await call('connect_with_person', { profile_id: process.env.TARGET_CONNECT_ID, confirm: true });
    await sleep(2000);
  } else {
    console.log('\n⏭  connect_with_person skipped (set TARGET_CONNECT_ID to enable).');
  }

  // 5) send_message — only with an explicit target.
  if (process.env.TARGET_MSG_THREAD) {
    await call('send_message', { thread_id: process.env.TARGET_MSG_THREAD, message: 'v2 write-verify (reply)', confirm: true });
  } else if (process.env.TARGET_MSG_URN) {
    await call('send_message', { recipient_urn: process.env.TARGET_MSG_URN, message: 'v2 write-verify (new thread)', confirm: true });
  } else {
    console.log('\n⏭  send_message skipped (set TARGET_MSG_URN or TARGET_MSG_THREAD to enable).');
  }

  console.log('\n🎯 Write verification run complete. Inspect each status above (ok / duplicate / restricted / …).');
  child.kill(); process.exit(0);
})();
