#!/usr/bin/env node
// ContentaSoft MCP launcher — generated into each package by scripts/build.mjs; edit src/launcher.js.
//
// The MCP server lives inside the Windows desktop app (`<cli> serve`). This launcher:
//   - finds the installed app and runs its MCP server, passing stdin/stdout straight through;
//   - when the app is not installed (or this is not Windows), runs a one-tool MCP server whose
//     `get_started` tool tells the agent where to download it.
// It sends nothing over the network and writes nothing to disk. Zero dependencies.
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const app = require('./app.json');

const LATEST_PROTOCOL = '2025-06-18';
const PROTOCOLS = [LATEST_PROTOCOL, '2025-03-26', '2024-11-05'];

/** Where the installer puts the CLI, in the order we look. Returns absolute paths. */
function candidatePaths(env, platform) {
  const out = [];
  if (env[app.overrideEnv]) out.push(env[app.overrideEnv]);
  if (platform !== 'win32') return out;
  // Per-user install (the default: PrivilegesRequired=lowest, {autopf} = %LOCALAPPDATA%\Programs).
  if (env.LOCALAPPDATA) out.push(path.win32.join(env.LOCALAPPDATA, 'Programs', app.installFolder, app.exe));
  // The installer adds the install folder to the user PATH.
  for (const dir of (env.PATH || env.Path || '').split(';')) {
    if (dir.trim()) out.push(path.win32.join(dir.trim().replace(/^"|"$/g, ''), app.exe));
  }
  // All-users install (chosen in the installer's privilege dialog).
  for (const pf of [env.ProgramFiles, env['ProgramFiles(x86)']]) {
    if (pf) out.push(path.win32.join(pf, app.installFolder, app.exe));
  }
  return out;
}

function findCli(env = process.env, platform = process.platform, exists = fs.existsSync) {
  for (const p of candidatePaths(env, platform)) {
    try { if (exists(p)) return p; } catch { /* unreadable PATH entry */ }
  }
  return null;
}

function withAttribution(url) {
  return url + (url.includes('?') ? '&' : '?') + 'utm_source=mcp&utm_medium=agent&utm_campaign=launcher';
}

function getStartedText(platform) {
  if (platform !== 'win32') {
    return `${app.product} is a Windows desktop app (${app.summary}). It runs on Windows 10 and 11 only, ` +
      `so its tools can't be used on this computer. More: ${withAttribution(app.websiteUrl)}`;
  }
  return [
    `${app.product} is not installed on this computer. It is a Windows desktop app for ${app.summary}; ` +
      `its MCP tools (${app.tools.join(', ')}) run on this PC, on local files.`,
    '',
    'To set it up:',
    `1. Download the free trial: ${withAttribution(app.downloadUrl)}`,
    '2. Run the installer. It installs for the current user and needs no administrator rights.',
    '3. Restart the AI client or reconnect this MCP server. This server then starts the app\'s own MCP server with the tools above.',
  ].join('\n');
}

// ── Stub MCP server (app not installed) ────────────────────────────────────────

function handleMessage(msg, platform) {
  if (!msg || typeof msg !== 'object' || typeof msg.method !== 'string') return null;
  const isNotification = msg.id === undefined || msg.id === null;
  const reply = (body) => (isNotification ? null : { jsonrpc: '2.0', id: msg.id, ...body });

  switch (msg.method) {
    case 'initialize': {
      const requested = msg.params && typeof msg.params.protocolVersion === 'string' ? msg.params.protocolVersion : '';
      return reply({
        result: {
          protocolVersion: PROTOCOLS.includes(requested) ? requested : LATEST_PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: app.serverName, version: require('./package.json').version },
          instructions: `${app.product} is not installed on this computer. Call get_started for the download link.`,
        },
      });
    }
    case 'ping':
      return reply({ result: {} });
    case 'tools/list':
      return reply({
        result: {
          tools: [{
            name: 'get_started',
            title: `Install ${app.product}`,
            description: `${app.product} (${app.summary}) is not installed on this computer, so its tools are not available yet. ` +
              'Call this tool to get the download link and the install steps to show the user.',
            inputSchema: { type: 'object', properties: {} },
            annotations: { title: `Install ${app.product}`, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          }],
        },
      });
    case 'tools/call': {
      const name = msg.params && msg.params.name;
      if (name !== 'get_started') {
        return reply({ error: { code: -32602, message: `Unknown tool: ${name}. ${app.product} is not installed; call get_started.` } });
      }
      return reply({ result: { content: [{ type: 'text', text: getStartedText(platform) }] } });
    }
    default:
      if (msg.method.startsWith('notifications/')) return null;
      return reply({ error: { code: -32601, message: `Method not found: ${msg.method}` } });
  }
}

/** One input line → the line to write, or null. Exported for tests. */
function handleLine(line, platform = process.platform) {
  let parsed;
  try { parsed = JSON.parse(line); } catch (e) {
    return JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  if (Array.isArray(parsed)) {
    const replies = parsed.map((m) => handleMessage(m, platform)).filter(Boolean);
    return replies.length ? JSON.stringify(replies) : null;
  }
  const r = handleMessage(parsed, platform);
  return r ? JSON.stringify(r) : null;
}

function runStub(reason) {
  process.stderr.write(`[${app.serverName} launcher] ${reason}; serving get_started only\n`);
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    const out = handleLine(line);
    if (out) process.stdout.write(out + '\n');
  });
  rl.on('close', () => process.exit(0));
}

// ── Pass-through to the installed app ──────────────────────────────────────────

function runCli(exe) {
  process.stderr.write(`[${app.serverName} launcher] starting ${exe} serve\n`);
  const child = spawn(exe, ['serve'], { stdio: 'inherit', windowsHide: true });
  let started = false;
  child.on('spawn', () => { started = true; });
  child.on('error', (err) => {
    if (!started) runStub(`could not start ${exe}: ${err.message}`);
    else process.exit(1);
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
}

function main() {
  const exe = findCli();
  if (exe) runCli(exe);
  else runStub(process.platform === 'win32' ? `${app.exe} not found` : `not Windows (${process.platform})`);
}

if (require.main === module) main();

module.exports = { candidatePaths, findCli, handleLine, getStartedText, withAttribution };
