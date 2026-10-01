# 3D CAD Converter MCP server

<!-- mcp-name: com.contenta-software/cad-converter -->

Lets an AI agent (Claude Code, Claude Desktop/Cowork, Codex, Cursor, VS Code and other MCP clients) use
**3D CAD Converter** on your Windows PC: converting STEP, IGES, STL, OBJ, FBX, glTF, 3MF and other 3D/CAD files.

3D CAD Converter is a Windows 10/11 desktop app with a free trial: https://www.contenta-software.com/3dcadconverter/download.php

## How it works

This package is a small launcher. It finds 3D CAD Converter on your PC (`cadconvert.exe`, installed per-user in
`%LOCALAPPDATA%\Programs\CadConverter` or on your `PATH`) and runs the app's own MCP server
(`cadconvert serve`) over stdio. Tools: `convert_cad`, `detect_format`, `get_file_info`, `list_formats`.

If the app is not installed yet, the launcher serves a single `get_started` tool that gives your agent the
download link and the install steps instead.

## Add it to your client

Claude Code (Windows):

```
claude mcp add cad-converter -- cmd /c npx -y @contentasoft/cad-converter-mcp@1.0.0
```

Claude Desktop, Cursor, VS Code and other clients (`mcpServers` JSON):

```json
{
  "mcpServers": {
    "cad-converter": { "command": "cmd", "args": ["/c", "npx", "-y", "@contentasoft/cad-converter-mcp@1.0.0"] }
  }
}
```

Once the app is installed you can also skip the launcher: `"command": "cadconvert", "args": ["serve"]`.

## What runs and what is sent

- The launcher itself sends nothing over the network and writes nothing to disk. It starts `cadconvert.exe`.
- The app works on local files on your PC. It sends anonymous usage telemetry (which tools ran, which MCP
  client connected, trial state) to ContentaSoft; turn it off in the app's settings. Privacy policy:
  https://www.contenta-software.com/3dcadconverter/privacy.php
- During the trial some output is watermarked or limited; after the trial, tools that write files answer
  with a link to buy a license instead of running.

## License

The launcher is MIT-licensed (see LICENSE). 3D CAD Converter itself is commercial software by ContentaSoft AB.
