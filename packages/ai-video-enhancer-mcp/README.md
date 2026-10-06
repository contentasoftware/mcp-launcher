# AI Video Enhancer Studio MCP server

<!-- mcp-name: com.contenta-software/ai-video-enhancer -->

Lets an AI agent (Claude Code, Claude Desktop/Cowork, Codex, Cursor, VS Code and other MCP clients) use
**AI Video Enhancer Studio** on your Windows PC: upscaling, stabilizing, denoising and frame-rate conversion of videos on an NVIDIA RTX GPU.

AI Video Enhancer Studio is a Windows 10/11 desktop app with a free trial: https://www.contenta-software.com/aivideoenhancer/download.php

## How it works

This package is a small launcher. It finds AI Video Enhancer Studio on your PC (`aivideoenhancer.exe`, installed per-user in
`%LOCALAPPDATA%\Programs\AIVideoEnhancerStudio` or on your `PATH`) and runs the app's own MCP server
(`aivideoenhancer serve`) over stdio. Tools: `enhance_video`, `analyze_video`, `get_status`, `list_presets`.

If the app is not installed yet, the launcher serves a single `get_started` tool that gives your agent the
download link and the install steps instead.

## Add it to your client

Claude Code (Windows):

```
claude mcp add ai-video-enhancer -- cmd /c npx -y @contentasoft/ai-video-enhancer-mcp@1.0.3
```

Claude Desktop, Cursor and other clients that use `mcpServers` (JSON):

```json
{
  "mcpServers": {
    "ai-video-enhancer": { "command": "cmd", "args": ["/c", "npx", "-y", "@contentasoft/ai-video-enhancer-mcp@1.0.3"] }
  }
}
```

VS Code (`.vscode/mcp.json`, note the `servers` key):

```json
{
  "servers": {
    "ai-video-enhancer": { "type": "stdio", "command": "cmd", "args": ["/c", "npx", "-y", "@contentasoft/ai-video-enhancer-mcp@1.0.3"] }
  }
}
```

Codex (`codex mcp add ai-video-enhancer -- cmd /c npx -y @contentasoft/ai-video-enhancer-mcp@1.0.3`, or `~/.codex/config.toml`):

```toml
[mcp_servers.ai-video-enhancer]
command = "cmd"
args = ["/c", "npx", "-y", "@contentasoft/ai-video-enhancer-mcp@1.0.3"]
startup_timeout_sec = 60
tool_timeout_sec = 3600
```

The first start downloads this small package, which can take longer than a client's default startup timeout
(Codex: 10 s; Claude Code: set `MCP_TIMEOUT`); after that it starts at once. Long jobs such as video encodes can
exceed a client's default tool timeout too (Codex: 60 s; Claude Code: `MCP_TOOL_TIMEOUT`). The app is told to stop a
job when the client cancels it.

Once the app is installed you can also skip the launcher: `"command": "aivideoenhancer", "args": ["serve"]`.

## What runs and what is sent

- The launcher itself sends nothing over the network and writes nothing to disk. It starts `aivideoenhancer.exe`.
- The app works on local files on your PC. It sends anonymous usage telemetry (which tools ran, which MCP
  client connected, trial state) to ContentaSoft; turn it off in the app's settings. Privacy policy:
  https://www.contenta-software.com/aivideoenhancer/privacy.php
- The free trial has no end date: the first 5 full exports per PC are clean and full resolution, later ones are watermarked and capped at 1280x720; 10-second clips (`--clip`) stay free. `aivideoenhancer status` shows how many full exports are left. Nothing stops working; a licence removes the limits.

## License

The launcher is MIT-licensed (see LICENSE). AI Video Enhancer Studio itself is commercial software by ContentaSoft AB.
