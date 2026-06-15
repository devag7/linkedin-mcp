#!/usr/bin/env node
// v2 MCP server smoke: boot dist over stdio, list tools, run whoami + health_check.
import { spawn } from 'node:child_process';
const child = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
let buf = ''; const pending = new Map();
child.stdout.on('data', (d) => {
  buf += d.toString(); let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue; let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  }
});
child.stderr.on('data', () => {});
let id = 0;
const rpc = (method, params) => new Promise((res) => { const myId = ++id; pending.set(myId, res); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: myId, method, params }) + '\n'); });
const notify = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
(async () => {
  await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
  notify('notifications/initialized', {});
  const list = await rpc('tools/list', {});
  const names = (list.result?.tools ?? []).map((t) => t.name);
  console.log(`TOOLS (${names.length}): ${names.join(', ')}`);
  for (const name of ['whoami', 'health_check']) {
    const r = await rpc('tools/call', { name, arguments: {} });
    const text = r.result?.content?.[0]?.text ?? JSON.stringify(r.error ?? {});
    console.log(`\n=== ${name} ===\n${text.length > 700 ? text.slice(0, 700) + '…' : text}`);
  }
  child.kill(); process.exit(0);
})();
