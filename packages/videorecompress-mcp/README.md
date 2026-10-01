# VideoRecompress Studio MCP server

<!-- mcp-name: com.contenta-software/videorecompress -->

Lets an AI agent (Claude Code, Claude Desktop/Cowork, Codex, Cursor, VS Code and other MCP clients) use
**VideoRecompress Studio** on your Windows PC: shrinking video files with H.265/AV1 and GPU encoding, one file or a whole folder.

VideoRecompress Studio is a Windows 10/11 desktop app with a free trial: https://www.contenta-software.com/videorecompress/download.php

## How it works

This package is a small launcher. It finds VideoRecompress Studio on your PC (`videorecompress.exe`, installed per-user in
`%LOCALAPPDATA%\Programs\VideoRecompressStudio` or on your `PATH`) and runs the app's own MCP server
(`videorecompress serve`) over stdio. Tools: `recompress_video`, `batch_recompress`, `analyze_video`, `estimate_savings`, `list_presets`.

If the app is not installed yet, the launcher serves a single `get_started` tool that gives your agent the
download link and the install steps instead.

## Add it to your client

Claude Code (Windows):

```
claude mcp add videorecompress-studio -- cmd /c npx -y @contentasoft/videorecompress-mcp@1.0.0
```

Claude Desktop, Cursor and other clients that use `mcpServers` (JSON):

```json
{
  "mcpServers": {
    "videorecompress-studio": { "command": "cmd", "args": ["/c", "npx", "-y", "@contentasoft/videorecompress-mcp@1.0.0"] }
  }
}
```

VS Code (`.vscode/mcp.json`, note the `servers` key):

```json
{
  "servers": {
    "videorecompress-studio": { "type": "stdio", "command": "cmd", "args": ["/c", "npx", "-y", "@contentasoft/videorecompress-mcp@1.0.0"] }
  }
}
```

Codex (`codex mcp add videorecompress-studio -- cmd /c npx -y @contentasoft/videorecompress-mcp@1.0.0`, or `~/.codex/config.toml`):

```toml
[mcp_servers.videorecompress-studio]
command = "cmd"
args = ["/c", "npx", "-y", "@contentasoft/videorecompress-mcp@1.0.0"]
startup_timeout_sec = 60
tool_timeout_sec = 3600
```

The first start downloads this small package, which can take longer than a client's default startup timeout
(Codex: 10 s; Claude Code: set `MCP_TIMEOUT`); after that it starts at once. Long jobs such as video encodes can
exceed a client's default tool timeout too (Codex: 60 s; Claude Code: `MCP_TOOL_TIMEOUT`). The app is told to stop a
job when the client cancels it.

Once the app is installed you can also skip the launcher: `"command": "videorecompress", "args": ["serve"]`.

## What runs and what is sent

- The launcher itself sends nothing over the network and writes nothing to disk. It starts `videorecompress.exe`.
- The app works on local files on your PC. It sends anonymous usage telemetry (which tools ran, which MCP
  client connected, trial state) to ContentaSoft; turn it off in the app's settings. Privacy policy:
  https://www.contenta-software.com/videorecompress/privacy.php
- During the trial some output is watermarked or limited; after the trial, tools that write files answer
  with a link to buy a license instead of running.

## License

The launcher is MIT-licensed (see LICENSE). VideoRecompress Studio itself is commercial software by ContentaSoft AB.
