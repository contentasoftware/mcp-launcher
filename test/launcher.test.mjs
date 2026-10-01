import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const pkgDir = path.join(root, 'packages', 'contenta-converter-mcp');
const L = require(path.join(pkgDir, 'index.js'));

const winEnv = (extra = {}) => ({ LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local', PATH: '', ProgramFiles: 'C:\\Program Files', ...extra });

test('finds the per-user install first', () => {
  const want = 'C:\\Users\\u\\AppData\\Local\\Programs\\ContentaConverter\\contenta.exe';
  assert.equal(L.findCli(winEnv(), 'win32', (p) => p === want), want);
});

test('falls back to PATH, then Program Files', () => {
  const onPath = 'D:\\tools\\contenta.exe';
  assert.equal(L.findCli(winEnv({ PATH: 'C:\\x;"D:\\tools"' }), 'win32', (p) => p === onPath), onPath);
  const allUsers = 'C:\\Program Files\\ContentaConverter\\contenta.exe';
  assert.equal(L.findCli(winEnv(), 'win32', (p) => p === allUsers), allUsers);
});

test('override env wins; nothing found = null; non-Windows looks only at the override', () => {
  assert.equal(L.findCli(winEnv({ CONTENTASOFT_CC_EXE: 'E:\\c.exe' }), 'win32', (p) => p === 'E:\\c.exe'), 'E:\\c.exe');
  assert.equal(L.findCli(winEnv(), 'win32', () => false), null);
  assert.deepEqual(L.candidatePaths({ LOCALAPPDATA: 'x', PATH: 'y' }, 'darwin'), []);
});

const call = (obj, platform = 'win32') => JSON.parse(L.handleLine(JSON.stringify(obj), platform));

test('stub: initialize negotiates and says the app is missing', () => {
  const r = call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } });
  assert.equal(r.result.protocolVersion, '2024-11-05');
  assert.equal(r.result.serverInfo.name, 'contenta-converter');
  assert.match(r.result.instructions, /not installed/);
  assert.equal(call({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2099-01-01' } }).result.protocolVersion, '2025-06-18');
});

test('stub: lists only get_started, read-only', () => {
  const tools = call({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result.tools;
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, 'get_started');
  assert.equal(tools[0].annotations.readOnlyHint, true);
});

test('stub: get_started gives the attributed download link and the steps', () => {
  const text = call({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_started', arguments: {} } }).result.content[0].text;
  assert.match(text, /https:\/\/www\.contenta-converter\.com\/download\.php\?utm_source=mcp&utm_medium=agent&utm_campaign=launcher/);
  assert.match(text, /no administrator rights/);
  assert.match(text, /convert_image/);
});

test('stub: on macOS/Linux get_started says Windows only', () => {
  const text = call({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_started' } }, 'darwin').result.content[0].text;
  assert.match(text, /Windows 10 and 11 only/);
});

test('stub: a real tool name is refused with a pointer to get_started', () => {
  const r = call({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'convert_image' } });
  assert.equal(r.error.code, -32602);
  assert.match(r.error.message, /get_started/);
});

test('stub: notifications get nothing, ping gets {}, batches get arrays, garbage gets -32700', () => {
  assert.equal(L.handleLine('{"jsonrpc":"2.0","method":"notifications/initialized"}'), null);
  assert.deepEqual(call({ jsonrpc: '2.0', id: 9, method: 'ping' }).result, {});
  const batch = JSON.parse(L.handleLine('[{"jsonrpc":"2.0","id":1,"method":"ping"},{"jsonrpc":"2.0","method":"notifications/x"}]'));
  assert.equal(batch.length, 1);
  assert.equal(JSON.parse(L.handleLine('{nope')).error.code, -32700);
});

test('end to end: with no app installed the process serves the stub over stdio', async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpl-'));
  const child = spawn(process.execPath, [path.join(pkgDir, 'index.js')], {
    env: { SystemRoot: process.env.SystemRoot, LOCALAPPDATA: empty, PATH: empty, ProgramFiles: empty },
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stdin.end([
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","clientInfo":{"name":"t","version":"1"}}}',
    '{"jsonrpc":"2.0","method":"notifications/initialized"}',
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_started"}}',
  ].join('\n') + '\n');
  const code = await new Promise((r) => child.on('exit', r));
  assert.equal(code, 0);
  const lines = out.trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.id), [1, 2]);
  assert.match(lines[1].result.content[0].text, /download\.php/);
});
