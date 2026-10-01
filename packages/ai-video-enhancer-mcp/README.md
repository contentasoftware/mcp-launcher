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
claude mcp add ai-video-enhancer -- cmd /c npx -y @contentasoft/ai-video-enhancer-mcp@1.0.0
```

Claude Desktop, Cursor, VS Code and other clients (`mcpServers` JSON):

```json
{
  "mcpServers": {
    "ai-video-enhancer": { "command": "cmd", "args": ["/c", "npx", "-y", "@contentasoft/ai-video-enhancer-mcp@1.0.0"] }
  }
}
```

Once the app is installed you can also skip the launcher: `"command": "aivideoenhancer", "args": ["serve"]`.

## What runs and what is sent

- The launcher itself sends nothing over the network and writes nothing to disk. It starts `aivideoenhancer.exe`.
- The app works on local files on your PC. It sends anonymous usage telemetry (which tools ran, which MCP
  client connected, trial state) to ContentaSoft; turn it off in the app's settings. Privacy policy:
  https://www.contenta-software.com/aivideoenhancer/privacy.php
- During the trial some output is watermarked or limited; after the trial, tools that write files answer
  with a link to buy a license instead of running.

## License

The launcher is MIT-licensed (see LICENSE). AI Video Enhancer Studio itself is commercial software by ContentaSoft AB.
