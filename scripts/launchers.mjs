// Launchers vendored into the agent plugin bundles (Claude plugins and OpenAI desktop-only plugins) under
// server/: launch.cmd starts the app's own MCP server with nothing but cmd.exe; when the app is missing it
// runs the Node launcher (index.js) or, without Node.js, stub.ps1, which serves get_started only.
import fs from 'node:fs';
import path from 'node:path';

// cmd.exe wants CRLF (a label after an LF-only line is skipped on some builds).
export const writeCrlf = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\r?\n/g, '\r\n'));
};

/** Windows batch launcher: starts the app's own MCP server with no Node.js. See the comment inside. */
export function launchCmd(app, cli, host = 'Claude Code plugin') {
  const f = app.installFolder;
  return `@echo off
rem ${app.product} MCP launcher for the ${host}. Starts the app's own MCP server
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
export function stubPs1(app, version, host = 'Claude Code plugin') {
  const utm = (url) => url + (url.includes('?') ? '&' : '?') + 'utm_source=mcp&utm_medium=agent&utm_campaign=launcher';
  const text = [
    `${app.product} is not installed on this computer. It is a Windows desktop app for ${app.summary}; its MCP tools (${app.tools.join(', ')}) run on this PC, on local files.`,
    '',
    'To set it up:',
    `1. Download the free trial: ${utm(app.downloadUrl)}`,
    '2. Run the installer. It installs for the current user and needs no administrator rights.',
    "3. Restart the AI client or reconnect this MCP server. This server then starts the app's own MCP server with the tools above.",
  ].join('\n');
  return `# ${app.product} MCP stub for the ${host}: runs only when the app is not installed and Node.js
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
