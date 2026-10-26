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
import { writeCrlf, launchCmd, stubPs1 } from './launchers.mjs';
import { trial, trialTail, repoName, claudeInstall, askExamples, audience, desktopWindow, priceLine, developer, telemetrySwitch, localWork, cadFormats, reference } from './texts.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { version, apps } = JSON.parse(fs.readFileSync(path.join(root, 'apps.json'), 'utf8'));
const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
const outRoot = path.resolve(root, '..', 'mcp-plugins');
const docsSkills = path.resolve(root, '..', 'ContentaSoft', 'skills');

// Plugin names must be distinctive (directory review holds generic names), so the two apps whose
// product names are generic words carry the brand.
const plugin = {
  cc: { name: 'contenta-photo-converter', skill: 'contenta-image-processing', icon: 'docs/brand/contenta-converter/contenta-converter-logo-1024.png' },
  vr: { name: 'videorecompress-studio', skill: 'contenta-video', icon: 'docs/brand/videorecompress/videorecompress-logo-1024.png' },
  aive: { name: 'contentasoft-ai-video-enhancer', skill: 'contenta-video-enhancer', icon: 'docs/app-icons-512/aive_icon_512.png' },
  cad: { name: 'contentasoft-cad-converter', skill: 'contenta-cad', icon: 'docs/app-icons-512/cad_icon_512.png' },
};
const contenta = path.resolve(root, '..');

const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\r\n/g, '\n'));
};
for (const app of apps) {
  const p = plugin[app.key];
  const dir = path.join(outRoot, p.name);
  const cli = app.exe.replace('.exe', '');
  const appName = app.appName || app.product; // the installed app's name where the listing name differs
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
  write(path.join(dir, 'server', 'stub.ps1'), stubPs1(app, version));
  write(path.join(dir, '.mcp.json'), JSON.stringify({
    mcpServers: {
      [app.serverName]: { command: 'cmd', args: ['/c', '${CLAUDE_PLUGIN_ROOT}/server/launch.cmd'] },
    },
  }, null, 2) + '\n');

  // Listing icon (square PNG, 512-2048 px). The directory keeps the first icon it sees, forever.
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.copyFileSync(path.join(contenta, p.icon), path.join(dir, '.claude-plugin', 'icon.png'));

  // The skill pre-approves only the app's own CLI (the directory holds a bare `allowed-tools: Bash`), in both
  // shells: Claude Code on Windows often uses its PowerShell tool. Space form, as the permission docs write it;
  // `<cli>.exe` is a different first word, so it gets its own rule. The grant lasts for the turn that invokes the skill.
  const skillSrc = fs.readFileSync(path.join(docsSkills, p.skill, 'SKILL.md'), 'utf8');
  // Plus the plugin's own MCP server: Claude Code names its tools mcp__plugin_<plugin>_<server>__<tool>, and the
  // server-level rule covers them all, so "MCP first" costs no prompt in the skill's turn either.
  const allowed = [...[cli, `${cli}.exe`].flatMap((c) => [`Bash(${c} *)`, `PowerShell(${c} *)`]),
    `mcp__plugin_${p.name}_${app.serverName}`].join(' ');
  const narrowed = skillSrc.replace(/^allowed-tools:\s*Bash\s*$/m, `allowed-tools: ${allowed}`);
  if (narrowed === skillSrc) throw new Error(`${p.skill}: no 'allowed-tools: Bash' line to narrow`);
  write(path.join(dir, 'skills', p.skill, 'SKILL.md'), narrowed);
  write(path.join(dir, 'LICENSE'), license);
  // The Claude directory's scanner refuses any line-ending rule other than eol=lf ("*.cmd text
  // eol=crlf" kept every version since 1.0.3 from being fetched). launch.cmd is written CRLF by
  // writeCrlf and stored as-is: -text, no eol setting, as the scanner asks for .cmd files.
  write(path.join(dir, '.gitattributes'), '* text=auto eol=lf\n*.cmd -text\n');

  const dev = developer[app.key];
  const sw = telemetrySwitch[app.key];
  const formats = app.key === 'cad' ? `
## Formats

- Reads ${cadFormats.read}.
- Writes ${cadFormats.write}.
- ${cadFormats.native}
` : '';
  write(path.join(dir, 'README.md'), `# ${app.product} plugin

**Windows 10/11 only.** There is no Mac or Linux version: on a Mac or Linux machine the plugin installs, but its
server cannot start.

Use **${app.product}**${app.appName ? ` (the ${appName} app)` : ''} from your AI agent on your Windows PC: ${app.summary}. You ask in plain words and the
agent does the work on files on your computer. It works with any agent that runs local MCP servers: Cursor,
Claude Code, Codex, VS Code, Windsurf and others.
${audience[app.key] ? `\n${audience[app.key]}\n` : ''}
## Ask your agent

${askExamples[app.key].map((e) => `- "${e}"`).join('\n')}

${desktopWindow(appName)}

## Price and trial

- ${priceLine(app.key)}
- ${trial[app.key]} ${trialTail}
- After buying, the licence key arrives by email. Enter it in ${appName}'s Register page, or run
  \`${cli} register <email> <key>\` in a terminal. The key does not need to go through the chat.
${formats}
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

- Windows 10 or 11 with **${appName}** installed. It has a free trial: ${app.downloadUrl}
  (if it is not installed yet, the \`get_started\` tool gives the agent the download link and the steps).
- Nothing else for the Claude Code plugin: its launcher is a Windows batch file (\`server/launch.cmd\`) that starts the
  app's own MCP server. Node.js is not required; only the \`npx\` route for other clients needs it.
- An agent that runs on that computer. Browser chat apps cannot start local programs, so they cannot use these
  tools.

## What is included

- **MCP server** \`${app.serverName}\` with the tools ${app.tools.map((t) => `\`${t}\``).join(', ')}. Each tool
  says whether it only reads files, writes new files, may overwrite files, or uses the internet.
- **Skill** \`${p.skill}\`: how and when the agent should use those tools and the \`${cli}\` command line.

## For developers

- Windows 10 and 11, 64-bit only. There is no macOS or Linux version.
- \`${cli}\` never waits for input or shows a dialog, so it runs unattended from Task Scheduler or a script.
  ${dev.scheduleNote}

  \`\`\`
  ${dev.schedule}
  \`\`\`
- ${dev.json}
- Exit codes: ${dev.exit}
- The skill (\`skills/${p.skill}/SKILL.md\`) tells the agent which commands to use.

## Full CLI and MCP reference

Every \`${cli}\` command, option and exit code, the JSON output and every MCP tool with its parameters:

- Command line: ${reference[app.key].cli}
- MCP server: ${reference[app.key].mcp}

## Privacy

${localWork[app.key].map((b) => `- ${b}`).join('\n')}
- The app sends usage statistics (which tools ran, which MCP client connected, trial state) and crash reports to
  ContentaSoft, tagged with a hashed machine ID. They never contain your files; a crash report can contain a file
  name, but folder paths are removed. To turn them off, open the app and
  go to Settings, Privacy: Send usage statistics and crash reports. The same switch covers the command line and the
  MCP server. On a PC where nobody opens the app, set \`"${sw.key}": false\` in \`${sw.file}\`.
- Privacy policy, with the full list of what is sent: ${app.privacyUrl}

## What runs

- As a Claude plugin it runs \`server/launch.cmd\` from the plugin folder, which looks for \`${app.exe}\` in the app's
  install folder (\`%LOCALAPPDATA%\\Programs\\${app.installFolder}\`), on your \`PATH\` or in \`Program Files\`, and runs
  \`${cli} serve\`. Nothing is downloaded. If the app is missing, the bundled Node launcher (\`server/index.js\`, the same
  bytes as the npm package \`${app.package}\`, MIT, no dependencies; source: https://github.com/contentasoftware/mcp-launcher)
  or, without Node.js, the Windows PowerShell stub \`server/stub.ps1\` serves one tool, \`get_started\`. Neither sends
  anything over the network.
- While Claude Code uses the skill, it can use the plugin's MCP tools and run the app's own command-line tool in Bash or
  PowerShell without asking (\`allowed-tools: ${allowed}\`). That permission ends when you send your next message.
  Other commands follow your own Claude Code permission settings.

## License

This plugin and the launcher are MIT-licensed (see LICENSE). ${appName} itself is commercial software by
ContentaSoft AB.
`);

  console.log(`plugin ${p.name} -> ${dir}`);
}
