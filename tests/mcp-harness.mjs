#!/usr/bin/env node
// Ad-hoc MCP stdio harness: drives dist/index.js with raw JSON-RPC.
import { spawn } from 'node:child_process';

const env = { ...process.env };
// Strip any inherited LinkedIn creds unless TEST_WITH_COOKIE is set.
if (!process.env.TEST_WITH_COOKIE) {
  delete env.LINKEDIN_COOKIE;
  delete env.LINKEDIN_ACCESS_TOKEN;
  delete env.LINKEDIN_CSRF_TOKEN;
}

const child = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env,
});

let buf = '';
const pending = new Map();
child.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on('data', (d) => process.stderr.write('[server] ' + d.toString()));

let id = 0;
function rpc(method, params) {
  const myId = ++id;
  const req = { jsonrpc: '2.0', id: myId, method, params };
  return new Promise((resolve) => {
    pending.set(myId, resolve);
    child.stdin.write(JSON.stringify(req) + '\n');
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const init = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'harness', version: '0.0.1' },
  });
  console.log('=== initialize ===');
  console.log(JSON.stringify(init.result?.serverInfo ?? init, null, 2));
  notify('notifications/initialized', {});
  await sleep(100);

  const list = await rpc('tools/list', {});
  const tools = list.result?.tools ?? [];
  console.log(`\n=== tools/list: ${tools.length} tools ===`);
  for (const t of tools) {
    const props = Object.keys(t.inputSchema?.properties ?? {});
    const req = t.inputSchema?.required ?? [];
    console.log(`- ${t.name}(${props.map((p) => req.includes(p) ? p + '*' : p).join(', ')})`);
  }

  async function call(name, args) {
    const r = await rpc('tools/call', { name, arguments: args ?? {} });
    console.log(`\n=== call ${name}(${JSON.stringify(args ?? {})}) ===`);
    const c = r.result?.content?.[0]?.text ?? JSON.stringify(r.error ?? r.result);
    console.log('isError:', r.result?.isError ?? false);
    console.log(c.length > 1200 ? c.slice(0, 1200) + `\n...[truncated ${c.length} chars]` : c);
  }

  await call('whoami');
  await call('health_check');
  await call('get_profile', { username: 'satyanadella' });
  await call('search_jobs', { keywords: 'software engineer', location: 'Remote', count: 3 });

  child.kill();
  process.exit(0);
})();
