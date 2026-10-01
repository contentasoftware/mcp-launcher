// Regression tests for the 2026-10-01 adversarial review of the launcher (PATH parsing, stub protocol
// conformance, spawn failure, exit codes, output flushing).
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
const cands = (env) => L.candidatePaths(winEnv(env), 'win32');

test('PATH: quoted entries may contain ";", trailing backslashes and %VAR% are handled', () => {
  assert.deepEqual(L.splitWindowsPath('C:\\a;"D:\\x;y\\";;  E:\\z  '), ['C:\\a', 'D:\\x;y\\', 'E:\\z']);
  const c = cands({ PATH: '"D:\\x;y\\";%TOOLS%\\bin\\;%UNSET%\\q', TOOLS: 'F:\\t' });
  assert.ok(c.includes('D:\\x;y\\contenta.exe'));
  assert.ok(c.includes('F:\\t\\bin\\contenta.exe'));
  assert.ok(!c.some((p) => p.includes('%')), 'an unexpandable %VAR% entry is not a candidate');
});

test('PATH: relative entries (".") and UNC shares are never searched; duplicates collapse; key case is ignored', () => {
  const c = cands({ PATH: '.;..\\bin;bin;\\\\server\\share;C:\\ok;C:\\ok\\' });
  assert.deepEqual(c.filter((p) => !p.includes('Program') && !p.includes('Users')), ['C:\\ok\\contenta.exe']);
  const lower = L.candidatePaths({ localappdata: 'C:\\u', Path: 'D:\\p', PROGRAMFILES: 'C:\\PF' }, 'win32');
  assert.deepEqual(lower, ['C:\\u\\Programs\\ContentaConverter\\contenta.exe', 'D:\\p\\contenta.exe', 'C:\\PF\\ContentaConverter\\contenta.exe']);
});

test('PATH: 32-bit Node still finds an all-users install under both Program Files folders', () => {
  const c = L.candidatePaths({
    ProgramFiles: 'C:\\Program Files (x86)', ProgramW6432: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)',
  }, 'win32');
  assert.deepEqual(c, ['C:\\Program Files (x86)\\ContentaConverter\\contenta.exe', 'C:\\Program Files\\ContentaConverter\\contenta.exe']);
});

test('findAll keeps the order and skips candidates that do not exist or throw', () => {
  const want = ['C:\\Users\\u\\AppData\\Local\\Programs\\ContentaConverter\\contenta.exe', 'C:\\Program Files\\ContentaConverter\\contenta.exe'];
  const exists = (p) => { if (p.startsWith('Z:')) throw new Error('EACCES'); return want.includes(p); };
  assert.deepEqual(L.findAll(winEnv({ PATH: 'Z:\\dead' }), 'win32', exists), want);
});

const callIn = (session, obj) => {
  const r = L.handleLine(JSON.stringify(obj), 'win32', session);
  return r === null ? null : JSON.parse(r);
};

test('stub: 2025-11-25 is negotiated; batches are refused from 2025-06-18 on and allowed before', () => {
  const batch = [{ jsonrpc: '2.0', id: 1, method: 'ping' }];
  for (const [v, refused] of [['2025-11-25', true], ['2025-06-18', true], ['2025-03-26', false], ['2024-11-05', false]]) {
    const s = L.newSession('win32');
    assert.equal(callIn(s, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: v } }).result.protocolVersion, v);
    const r = callIn(s, batch);
    if (refused) assert.equal(r.error.code, -32600); else assert.ok(Array.isArray(r));
  }
});

test('stub: initialize may not be in a batch; empty batch and non-object items are Invalid Request', () => {
  const r = callIn(L.newSession('win32'), [{ jsonrpc: '2.0', id: 1, method: 'initialize' }, { jsonrpc: '2.0', id: 2, method: 'ping' }, 42]);
  assert.equal(r.find((x) => x.id === 1).error.code, -32600);
  assert.deepEqual(r.find((x) => x.id === 2).result, {});
  assert.equal(r.filter((x) => x.id === null)[0].error.code, -32600);
  assert.equal(callIn(L.newSession('win32'), []).error.code, -32600);
});

test('stub: ids must be string or number, null on a request is invalid, a missing method is invalid, client responses are ignored', () => {
  const s = L.newSession('win32');
  assert.equal(callIn(s, { jsonrpc: '2.0', id: 'abc', method: 'ping' }).id, 'abc');
  assert.equal(callIn(s, { jsonrpc: '2.0', id: { a: 1 }, method: 'ping' }).error.code, -32600);
  assert.equal(callIn(s, { jsonrpc: '2.0', id: null, method: 'ping' }).error.code, -32600);
  assert.equal(callIn(s, { jsonrpc: '2.0', id: null, method: 'notifications/initialized' }), null);
  const noMethod = callIn(s, { jsonrpc: '2.0', id: 5 });
  assert.deepEqual([noMethod.id, noMethod.error.code], [5, -32600]);
  assert.equal(callIn(s, { jsonrpc: '2.0', id: 9, result: {} }), null);
  assert.equal(callIn(s, 42).error.code, -32600);
});

test('stub: a notifications/* method sent as a request gets -32601, tools/call as a notification is ignored', () => {
  const s = L.newSession('win32');
  assert.equal(callIn(s, { jsonrpc: '2.0', id: 3, method: 'notifications/initialized' }).error.code, -32601);
  assert.equal(callIn(s, { jsonrpc: '2.0', method: 'tools/call', params: { name: 'get_started' } }), null);
});

test('stub: a UTF-8 BOM before the first message is ignored, not a parse error', () => {
  assert.ok(JSON.parse(L.handleLine('\uFEFF{"jsonrpc":"2.0","id":1,"method":"ping"}')).result !== undefined);
});

test('stub: when the app is installed but could not be started, get_started says so and shows the error', () => {
  const s = L.newSession('win32', { exe: 'C:\\x\\contenta.exe', error: 'spawn UNKNOWN' });
  const text = callIn(s, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_started' } }).result.content[0].text;
  assert.match(text, /installed \(C:\\x\\contenta\.exe\) but its MCP server could not be started: spawn UNKNOWN/);
  assert.doesNotMatch(text, /is not installed/);
});

test('exit code: the app code is forwarded, a signal becomes 128+n', () => {
  assert.equal(L.exitCodeFor(7, null), 7);
  assert.equal(L.exitCodeFor(0, null), 0);
  assert.equal(L.exitCodeFor(null, 'SIGTERM'), 128 + 15);
  assert.equal(L.exitCodeFor(null, null), 1);
});

// ── processes ───────────────────────────────────────────────────────────────────

const runLauncher = (env, input, cwd) => new Promise((resolve) => {
  const child = spawn(process.execPath, [path.join(pkgDir, 'index.js')], { env: { SystemRoot: process.env.SystemRoot, ...env }, cwd });
  let out = '';
  let errOut = '';
  child.stdout.setEncoding('utf8').on('data', (d) => { out += d; });
  child.stderr.setEncoding('utf8').on('data', (d) => { errOut += d; });
  child.on('exit', (code) => resolve({ code, out, err: errOut }));
  child.stdin.end(input);
});

const emptyEnv = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpl-'));
  return { LOCALAPPDATA: d, PATH: d, ProgramFiles: d };
};

test('end to end: every reply is flushed before the stub exits at end of input', async () => {
  const n = 300;
  const input = Array.from({ length: n }, (_, i) => JSON.stringify({ jsonrpc: '2.0', id: i, method: 'tools/call', params: { name: 'get_started' } })).join('\n') + '\n';
  const r = await runLauncher(emptyEnv(), input);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim().split('\n').length, n);
});

test('end to end: an app that is found but cannot be started (not an executable) leaves the stub, which says so', { skip: process.platform !== 'win32' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpl-'));
  const bogus = path.join(dir, 'contenta.exe');
  fs.writeFileSync(bogus, 'this is not a program');
  const r = await runLauncher({ ...emptyEnv(), CONTENTASOFT_CC_EXE: bogus }, '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_started"}}\n');
  assert.equal(r.code, 0);
  assert.match(JSON.parse(r.out).result.content[0].text, /could not be started/);
  assert.match(r.err, /could not start/);
});

// node.exe stands in for the app: the launcher runs `<exe> serve`, and node runs the file called "serve" in the cwd.
const fakeApp = (script) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpl-'));
  fs.writeFileSync(path.join(dir, 'serve'), script);
  return { dir, env: { ...emptyEnv(), CONTENTASOFT_CC_EXE: process.execPath } };
};

test('end to end: stdin/stdout pass straight through to the app, UTF-8 intact, and its exit code is forwarded', async () => {
  const { dir, env } = fakeApp([
    "require('readline').createInterface({ input: process.stdin }).on('line', (l) => {",
    "  if (l === 'quit') process.exit(7);",
    "  process.stdout.write(l.toUpperCase() + '\\n');",
    '});',
  ].join('\n'));
  const r = await runLauncher(env, 'hello g\u00f6teborg \u65e5\u672c\nquit\n', dir);
  assert.equal(r.out, 'HELLO G\u00d6TEBORG \u65e5\u672c\n');
  assert.equal(r.code, 7);
});

test('end to end: an app that dies mid-session ends the launcher with the app exit code', async () => {
  const { dir, env } = fakeApp("process.stdout.write('{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}\\n'); process.exit(3);");
  const r = await runLauncher(env, '', dir);
  assert.equal(r.code, 3);
  assert.equal(r.out, '{"jsonrpc":"2.0","id":1,"result":{}}\n');
});
