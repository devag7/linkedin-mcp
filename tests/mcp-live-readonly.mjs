#!/usr/bin/env node
// READ-ONLY live harness for v1.0.2. Drives dist/index.js over JSON-RPC.
// Auth comes from env (LINKEDIN_COOKIE / LINKEDIN_CSRF_TOKEN). No write tools called.
import { spawn } from 'node:child_process';

const TARGET = process.env.TARGET_DIST ?? 'dist/index.js';
const child = spawn('node', [TARGET], { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });

let buf = '';
const pending = new Map();
child.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
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
  let parsed, topKeys = [], includedLen = null;
  try { parsed = JSON.parse(text); } catch {}
  if (parsed && typeof parsed === 'object') {
    topKeys = Array.isArray(parsed) ? ['<array>'] : Object.keys(parsed);
    if (parsed.included && Array.isArray(parsed.included)) includedLen = parsed.included.length;
  }
  console.log(`\n=== ${name}(${JSON.stringify(args ?? {})}) ===`);
  console.log(`isError=${r.result?.isError ?? false}  bytes=${text.length}  topKeys=[${topKeys.slice(0, 12).join(', ')}]` +
    (includedLen != null ? `  included[]=${includedLen}` : ''));
  console.log(text.length > 900 ? text.slice(0, 900) + `\n...[+${text.length - 900} bytes]` : text);
}

(async () => {
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'live', version: '1' } });
  notify('notifications/initialized', {});
  await sleep(100);

  await call('whoami');                       // confirms auth method=cookie, valid=true
  await call('get_my_profile');               // /me
  await call('get_profile', { username: 'williamhgates' });
  await call('search_jobs', { keywords: 'software engineer', location: 'Remote', count: 3 });
  await call('get_company', { universalName: 'anthropicresearch' });
  await call('search_people', { keywords: 'recruiter', count: 3, network: 'F' });
  await call('get_feed', { count: 3 });

  child.kill(); process.exit(0);
})();
