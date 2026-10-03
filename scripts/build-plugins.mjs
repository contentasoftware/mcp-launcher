// Generates the four Claude plugin bundles (one per app) from apps.json into
// D:\Dropbox\Contenta\mcp-plugins\<plugin>\ — each folder is its own git repo, submitted to the
// Claude directory as a plugin bundle (plugin at the repo root). Skills are copied from the public
// docs repo (ContentaSoft/skills/<skill>/SKILL.md). Run `npm run plugins`, then
// `claude plugin validate <folder>` for each.
//
// Each repo is also its own one-plugin marketplace (.claude-plugin/marketplace.json with source "./"),
// because Claude Code can only install from a marketplace: a user types
//   /plugin marketplace add contentasoftware/<repo>   then   /plugin install <plugin>@<repo>
// The marketplace name is the repository name, so the two commands read naturally.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trial, trialTail, repoName, claudeInstall } from './texts.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { version, apps } = JSON.parse(fs.readFileSync(path.join(root, 'apps.json'), 'utf8'));
const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
const outRoot = path.resolve(root, '..', 'mcp-plugins');
const docsSkills = path.resolve(root, '..', 'ContentaSoft', 'skills');

// Plugin names must be distinctive (directory review holds generic names), so the two apps whose
// product names are generic words carry the brand.
const plugin = {
  cc: { name: 'contenta-converter', skill: 'contenta-image-processing', icon: 'docs/brand/contenta-converter/contenta-converter-logo-1024.png' },
  vr: { name: 'videorecompress-studio', skill: 'contenta-video', icon: 'docs/brand/videorecompress/videorecompress-logo-1024.png' },
  aive: { name: 'contentasoft-ai-video-enhancer', skill: 'contenta-video-enhancer', icon: 'docs/app-icons-512/aive_icon_512.png' },
  cad: { name: 'contentasoft-cad-converter', skill: 'contenta-cad', icon: 'docs/app-icons-512/cad_icon_512.png' },
};
const contenta = path.resolve(root, '..');

const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\r\n/g, '\n'));
};
// cmd.exe wants CRLF (a label after an LF-only line is skipped on some builds).
const writeCrlf = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\r?\n/g, '\r\n'));
};

/** Windows batch launcher: starts the app's own MCP server with no Node.js. See the comment inside. */
function launchCmd(app, cli) {
  const f = app.installFolder;
  return `@echo off
rem ${app.product} MCP launcher for the Claude Code plugin. Starts the app's own MCP server
rem ("${cli} serve") and passes stdin/stdout straight through; nothing else runs, nothing is downloaded.
rem Lookup order: ${app.overrideEnv} override, per-user install, PATH, Program Files.
rem If the app is not installed: node index.js (the full launcher) when Node.js exists, otherwise
rem stub.ps1 (Windows PowerShell, always present) serves one tool, get_started, with the download link.
setlocal
set "EXE="
if defined ${app.overrideEnv} if exist "%${app.overrideEnv}%" set "EXE=%${app.overrideEnv}%"
if not defined EXE if exist "%LOCALAPPDATA%\\Programs\\${f}\\${app.exe}" set "EXE=%LOCALAPPDATA%\\Programs\\${f}\\${app.exe}"
if not defined EXE for /f "delims=" %%P in ('where ${app.exe} 2^>nul') do if not defined EXE set "EXE=%%P"
if not defined EXE if exist "%ProgramFiles%\\${f}\\${app.exe}" set "EXE=%ProgramFiles%\\${f}\\${app.exe}"
if not defined EXE if exist "%ProgramFiles(x86)%\\${f}\\${app.exe}" set "EXE=%ProgramFiles(x86)%\\${f}\\${app.exe}"
if defined EXE goto run
where node >nul 2>nul
if not errorlevel 1 goto node
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0stub.ps1"
exit /b %errorlevel%
:node
node "%~dp0index.js"
exit /b %errorlevel%
:run
"%EXE%" serve
exit /b %errorlevel%
`;
}

/** Windows PowerShell 5.1 MCP stub: get_started only. Same texts as the Node launcher. */
function stubPs1(app) {
  const utm = (url) => url + (url.includes('?') ? '&' : '?') + 'utm_source=mcp&utm_medium=agent&utm_campaign=launcher';
  const text = [
    `${app.product} is not installed on this computer. It is a Windows desktop app for ${app.summary}; its MCP tools (${app.tools.join(', ')}) run on this PC, on local files.`,
    '',
    'To set it up:',
    `1. Download the free trial: ${utm(app.downloadUrl)}`,
    '2. Run the installer. It installs for the current user and needs no administrator rights.',
    "3. Restart the AI client or reconnect this MCP server. This server then starts the app's own MCP server with the tools above.",
  ].join('\n');
  return `# ${app.product} MCP stub for the Claude Code plugin: runs only when the app is not installed and Node.js
# is missing. Serves one tool, get_started, which tells the agent how to install the app. Sends nothing anywhere.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$in = [Console]::In
$out = [Console]::Out
$protocols = @('2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05')
$text = ${JSON.stringify(text)} -replace '\\\\n', "\`n"
$description = ${JSON.stringify(`${app.product} (${app.summary}) is not installed on this computer (or could not be started), so its tools are not available yet. Call this tool to get the download link and the steps to show the user.`)}

function Send($obj) { $out.Write((ConvertTo-Json -InputObject $obj -Compress -Depth 12) + "\`n"); $out.Flush() }
function Reply($id, $result) { Send ([ordered]@{ jsonrpc = '2.0'; id = $id; result = $result }) }
function Fail($id, $code, $message) { Send ([ordered]@{ jsonrpc = '2.0'; id = $id; error = [ordered]@{ code = $code; message = $message } }) }

while ($null -ne ($line = $in.ReadLine())) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  try { $m = ConvertFrom-Json -InputObject $line.TrimStart([char]0xFEFF) } catch { Fail $null (-32700) 'Parse error'; continue }
  if ($m -is [array]) { Fail $null (-32600) 'Send one message per line'; continue }
  if (-not $m.PSObject.Properties['method']) { continue }
  if (-not $m.PSObject.Properties['id'] -or $null -eq $m.id) { continue }
  $id = $m.id
  switch ($m.method) {
    'initialize' {
      $requested = if ($m.params -and $m.params.PSObject.Properties['protocolVersion']) { [string]$m.params.protocolVersion } else { '' }
      $v = if ($protocols -contains $requested) { $requested } else { $protocols[0] }
      Reply $id ([ordered]@{
        protocolVersion = $v
        capabilities = [ordered]@{ tools = [ordered]@{ listChanged = $false } }
        serverInfo = [ordered]@{ name = '${app.serverName}'; version = '${version}' }
        instructions = '${app.product} is not installed on this computer. Call get_started for what to do.'
      })
    }
    'ping' { Reply $id ([ordered]@{}) }
    'tools/list' {
      Reply $id ([ordered]@{ tools = @([ordered]@{
        name = 'get_started'
        title = 'Set up ${app.product}'
        description = $description
        inputSchema = [ordered]@{ type = 'object'; properties = [ordered]@{} }
        annotations = [ordered]@{ title = 'Set up ${app.product}'; readOnlyHint = $true; destructiveHint = $false; idempotentHint = $true; openWorldHint = $false }
      }) })
    }
    'tools/call' {
      $name = if ($m.params) { [string]$m.params.name } else { '' }
      if ($name -ne 'get_started') { Fail $id (-32602) "Unknown tool: $name. ${app.product} is not available; call get_started." }
      else { Reply $id ([ordered]@{ content = @([ordered]@{ type = 'text'; text = $text }) }) }
    }
    default { Fail $id (-32601) "Method not found: $($m.method)" }
  }
}
`;
}

for (const app of apps) {
  const p = plugin[app.key];
  const dir = path.join(outRoot, p.name);
  const cli = app.exe.replace('.exe', '');
  const repo = repoName(p.name);
  const cmds = claudeInstall(p.name);
  const description = `${app.product} on your Windows PC from your AI agent: ${app.summary}. Runs locally on your files.`;
  const keywords = [...new Set(['windows', 'batch', 'mcp', ...app.summary.split(/[ ,/]+/).filter((w) => w.length > 3).slice(0, 5)])];

  write(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({
    name: p.name,
    displayName: app.product,
    version,
    description,
    author: { name: 'ContentaSoft AB', url: 'https://www.contenta-software.com/' },
    homepage: app.websiteUrl,
    repository: `https://github.com/contentasoftware/${repo}`,
    license: 'MIT',
    keywords,
  }, null, 2) + '\n');

  // The repo is its own one-plugin marketplace: that is the only way Claude Code installs from GitHub.
  write(path.join(dir, '.claude-plugin', 'marketplace.json'), JSON.stringify({
    name: repo,
    owner: { name: 'ContentaSoft AB', url: 'https://www.contenta-software.com/' },
    description: `${app.product} for AI agents on Windows: ${app.summary}.`,
    plugins: [{
      name: p.name,
      source: './',
      description,
      version,
      tags: keywords,
    }],
  }, null, 2) + '\n');

  // The Node launcher's readable source is vendored into the plugin (the same bytes as the npm package)
  // and used when Node.js exists and the app does not. The batch launcher is what the plugin runs: with the
  // app installed it needs nothing but cmd.exe; without the app and without Node it runs the PowerShell stub.
  const pkgDir = path.join(root, 'packages', app.package.split('/')[1]);
  for (const f of ['index.js', 'app.json', 'package.json']) {
    write(path.join(dir, 'server', f), fs.readFileSync(path.join(pkgDir, f), 'utf8'));
  }
  writeCrlf(path.join(dir, 'server', 'launch.cmd'), launchCmd(app, cli));
  write(path.join(dir, 'server', 'stub.ps1'), stubPs1(app));
  write(path.join(dir, '.mcp.json'), JSON.stringify({
    mcpServers: {
      [app.serverName]: { command: 'cmd', args: ['/c', '${CLAUDE_PLUGIN_ROOT}/server/launch.cmd'] },
    },
  }, null, 2) + '\n');

  // Listing icon (square PNG, 512-2048 px). The directory keeps the first icon it sees, forever.
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.copyFileSync(path.join(contenta, p.icon), path.join(dir, '.claude-plugin', 'icon.png'));

  // The skill may only run the app's own CLI (the directory holds a bare `allowed-tools: Bash`).
  const skillSrc = fs.readFileSync(path.join(docsSkills, p.skill, 'SKILL.md'), 'utf8');
  const narrowed = skillSrc.replace(/^allowed-tools:\s*Bash\s*$/m, `allowed-tools: Bash(${cli}:*)`);
  if (narrowed === skillSrc) throw new Error(`${p.skill}: no 'allowed-tools: Bash' line to narrow`);
  write(path.join(dir, 'skills', p.skill, 'SKILL.md'), narrowed);
  write(path.join(dir, 'LICENSE'), license);
  write(path.join(dir, '.gitattributes'), '* text=auto eol=lf\n*.cmd text eol=crlf\n');

  write(path.join(dir, 'README.md'), `# ${app.product} plugin

Use **${app.product}** from your AI agent on your Windows PC: ${app.summary}. The agent calls the app's tools
on files on your computer; nothing is uploaded to the model provider or to ContentaSoft to do the work. It works
with any agent that runs local MCP servers: Cursor, Claude Code, Codex, VS Code, Windsurf and others.

## Install

**Claude Code** (Windows): two commands, typed inside Claude Code. This repository is its own one-plugin
marketplace, named after the repository:

\`\`\`
${cmds.marketplaceAdd}
${cmds.install}
\`\`\`

From a terminal the same is \`${cmds.cliAdd}\` and \`${cmds.cliInstall}\`.
Cowork and the Claude.ai directory: install **${app.product}** from the directory once it is listed.

**Cursor, Claude Desktop, VS Code, Codex and other MCP clients** (\`mcpServers\` JSON):
\`"${app.serverName}": { "command": "cmd", "args": ["/c", "npx", "-y", "${app.package}"] }\` (needs Node.js 18+), or,
once the app is installed, \`"${app.serverName}": { "command": "${cli}", "args": ["serve"] }\` with no Node.js at all.
Client-by-client instructions: https://www.npmjs.com/package/${app.package}

## What you need

- Windows 10 or 11 with **${app.product}** installed. It has a free trial: ${app.downloadUrl}
  (if it is not installed yet, the \`get_started\` tool gives the agent the download link and the steps).
- Nothing else for the Claude Code plugin: its launcher is a Windows batch file (\`server/launch.cmd\`) that starts the
  app's own MCP server. Node.js is not required; only the \`npx\` route for other clients needs it.
- An agent that runs on that computer. Browser chat apps cannot start local programs, so they cannot use these
  tools.

## What is included

- **MCP server** \`${app.serverName}\` with the tools ${app.tools.map((t) => `\`${t}\``).join(', ')}. Each tool
  says whether it only reads files, writes new files, may overwrite files, or uses the internet.
- **Skill** \`${p.skill}\`: how and when the agent should use those tools and the \`${cli}\` command line.

## What runs and what is sent

- As a Claude plugin it runs \`server/launch.cmd\` from the plugin folder, which looks for \`${app.exe}\` in the app's
  install folder (\`%LOCALAPPDATA%\\Programs\\${app.installFolder}\`), on your \`PATH\` or in \`Program Files\`, and runs
  \`${cli} serve\`. Nothing is downloaded. If the app is missing, the bundled Node launcher (\`server/index.js\`, the same
  bytes as the npm package \`${app.package}\`, MIT, no dependencies; source: https://github.com/contentasoftware/mcp-launcher)
  or, without Node.js, the Windows PowerShell stub \`server/stub.ps1\` serves one tool, \`get_started\`. Neither sends
  anything over the network.
- The skill may only run the app's own command-line tool (\`allowed-tools: Bash(${cli}:*)\`).
- The app processes local files only. It sends anonymous usage telemetry (which tools ran, which MCP client
  connected, trial state) to ContentaSoft; turn it off in the app's settings. Privacy policy: ${app.privacyUrl}${app.networkNote ? `\n- ${app.networkNote}` : ''}
- ${trial[app.key]} ${trialTail}

## License

This plugin and the launcher are MIT-licensed (see LICENSE). ${app.product} itself is commercial software by
ContentaSoft AB.
`);

  console.log(`plugin ${p.name} -> ${dir}`);
}
