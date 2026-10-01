// Generates packages/<name>/ (one npm package per app) and registry/<key>.server.json from
// apps.json + src/launcher.js. Run `npm run build` after editing either; commit the output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { version, apps } = JSON.parse(fs.readFileSync(path.join(root, 'apps.json'), 'utf8'));
const launcher = fs.readFileSync(path.join(root, 'src', 'launcher.js'), 'utf8');
const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
const repoUrl = 'https://github.com/ContentaSoft/mcp-launcher';

const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\r\n/g, '\n'));
};

for (const app of apps) {
  const dir = path.join(root, 'packages', app.package.split('/')[1]);
  const { tools, ...appRest } = app;

  write(path.join(dir, 'index.js'), launcher);
  write(path.join(dir, 'app.json'), JSON.stringify({ ...appRest, tools }, null, 2) + '\n');
  write(path.join(dir, 'LICENSE'), license);
  write(path.join(dir, 'package.json'), JSON.stringify({
    name: app.package,
    version,
    description: `MCP server for ${app.product} — ${app.registryDescription}`,
    mcpName: app.registryName,
    bin: { [app.bin]: 'index.js' },
    files: ['index.js', 'app.json', 'README.md', 'LICENSE'],
    engines: { node: '>=18' },
    license: 'MIT',
    author: 'ContentaSoft AB',
    homepage: app.websiteUrl,
    repository: { type: 'git', url: `git+${repoUrl}.git` },
    keywords: ['mcp', 'model-context-protocol', 'windows', ...app.summary.split(/[ ,/]+/).filter((w) => w.length > 3).slice(0, 6)],
  }, null, 2) + '\n');

  const npx = `npx -y ${app.package}@${version}`;
  write(path.join(dir, 'README.md'), `# ${app.product} MCP server

<!-- mcp-name: ${app.registryName} -->

Lets an AI agent (Claude Code, Claude Desktop/Cowork, Codex, Cursor, VS Code and other MCP clients) use
**${app.product}** on your Windows PC: ${app.summary}.

${app.product} is a Windows 10/11 desktop app with a free trial: ${app.downloadUrl}

## How it works

This package is a small launcher. It finds ${app.product} on your PC (\`${app.exe}\`, installed per-user in
\`%LOCALAPPDATA%\\Programs\\${app.installFolder}\` or on your \`PATH\`) and runs the app's own MCP server
(\`${app.exe.replace('.exe', '')} serve\`) over stdio. Tools: ${tools.map((t) => `\`${t}\``).join(', ')}.

If the app is not installed yet, the launcher serves a single \`get_started\` tool that gives your agent the
download link and the install steps instead.

## Add it to your client

Claude Code (Windows):

\`\`\`
claude mcp add ${app.serverName} -- cmd /c ${npx}
\`\`\`

Claude Desktop, Cursor, VS Code and other clients (\`mcpServers\` JSON):

\`\`\`json
{
  "mcpServers": {
    "${app.serverName}": { "command": "cmd", "args": ["/c", "npx", "-y", "${app.package}@${version}"] }
  }
}
\`\`\`

Once the app is installed you can also skip the launcher: \`"command": "${app.exe.replace('.exe', '')}", "args": ["serve"]\`.

## What runs and what is sent

- The launcher itself sends nothing over the network and writes nothing to disk. It starts \`${app.exe}\`.
- The app works on local files on your PC. It sends anonymous usage telemetry (which tools ran, which MCP
  client connected, trial state) to ContentaSoft; turn it off in the app's settings. Privacy policy:
  ${app.privacyUrl}${app.networkNote ? `\n- ${app.networkNote}` : ''}
- During the trial some output is watermarked or limited; after the trial, tools that write files answer
  with a link to buy a license instead of running.

## License

The launcher is MIT-licensed (see LICENSE). ${app.product} itself is commercial software by ContentaSoft AB.
`);

  write(path.join(root, 'registry', `${app.key}.server.json`), JSON.stringify({
    $schema: 'https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json',
    name: app.registryName,
    title: app.product,
    description: app.registryDescription,
    version,
    websiteUrl: app.websiteUrl,
    repository: { url: repoUrl, source: 'github' },
    packages: [{
      registryType: 'npm',
      identifier: app.package,
      version,
      transport: { type: 'stdio' },
    }],
  }, null, 2) + '\n');

  console.log(`built ${app.package}@${version}`);
}
