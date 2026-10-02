// Generates the four Claude plugin bundles (one per app) from apps.json into
// D:\Dropbox\Contenta\mcp-plugins\<plugin>\ — each folder is its own git repo, submitted to the
// Claude directory as a plugin bundle (plugin at the repo root). Skills are copied from the public
// docs repo (ContentaSoft/skills/<skill>/SKILL.md). Run `npm run plugins`, then
// `claude plugin validate <folder>` for each.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

for (const app of apps) {
  const p = plugin[app.key];
  const dir = path.join(outRoot, p.name);
  const cli = app.exe.replace('.exe', '');

  write(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({
    name: p.name,
    displayName: app.product,
    version,
    description: `${app.product} on your Windows PC from Claude: ${app.summary}. Runs locally on your files.`,
    author: { name: 'ContentaSoft AB', url: 'https://www.contenta-software.com/' },
    homepage: app.websiteUrl,
    repository: `https://github.com/contentasoftware/${p.name}-plugin`,
    license: 'MIT',
    keywords: ['windows', 'batch', 'mcp', ...app.summary.split(/[ ,/]+/).filter((w) => w.length > 3).slice(0, 5)],
  }, null, 2) + '\n');

  // The launcher's readable source is vendored into the plugin and run from CLAUDE_PLUGIN_ROOT, so
  // nothing is fetched at install time (the directory holds `npx <package>` for review). Zero deps,
  // one file; the same bytes as the published npm package.
  const pkgDir = path.join(root, 'packages', app.package.split('/')[1]);
  for (const f of ['index.js', 'app.json', 'package.json']) {
    write(path.join(dir, 'server', f), fs.readFileSync(path.join(pkgDir, f), 'utf8'));
  }
  write(path.join(dir, '.mcp.json'), JSON.stringify({
    mcpServers: {
      [app.serverName]: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server/index.js'] },
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
  write(path.join(dir, '.gitattributes'), '* text=auto eol=lf\n');

  write(path.join(dir, 'README.md'), `# ${app.product} for Claude

Use **${app.product}** from Claude on your Windows PC: ${app.summary}. Claude calls the app's tools on files on
your computer; nothing is uploaded to Anthropic or to ContentaSoft to do the work.

## What you need

- Windows 10 or 11 with **${app.product}** installed. It has a free trial: ${app.downloadUrl}
  (if it is not installed yet, the plugin's \`get_started\` tool gives Claude the download link and the steps).
- Node.js 18 or later, which runs the small launcher in \`server/index.js\` (MIT, no dependencies, the same code
  as the npm package \`${app.package}\`; source: https://github.com/contentasoftware/mcp-launcher). The launcher
  starts the app's own MCP server (\`${cli} serve\`) and passes its messages through; it sends nothing over the
  network itself.
- Claude Code or Cowork on that computer. Chat on claude.ai cannot start local programs, so it does not load
  this plugin's tools.

## What is included

- **MCP server** \`${app.serverName}\` with the tools ${app.tools.map((t) => `\`${t}\``).join(', ')}. Each tool
  says whether it only reads files, writes new files, may overwrite files, or uses the internet.
- **Skill** \`${p.skill}\`: how and when Claude should use those tools.

## What runs and what is sent

- The plugin runs \`node server/index.js\` from the plugin folder; nothing is downloaded. The launcher looks for
  \`${app.exe}\` in the app's install folder (\`%LOCALAPPDATA%\\Programs\\${app.installFolder}\`), on your \`PATH\`
  or in \`Program Files\`, and runs \`${cli} serve\`. If the app is missing it serves one tool, \`get_started\`.
- The skill may only run the app's own command-line tool (\`allowed-tools: Bash(${cli}:*)\`).
- The app processes local files only. It sends anonymous usage telemetry (which tools ran, which MCP client
  connected, trial state) to ContentaSoft; turn it off in the app's settings. Privacy policy: ${app.privacyUrl}${app.networkNote ? `\n- ${app.networkNote}` : ''}
- During the trial some outputs carry a watermark or other limits; the tool results say so and link to the
  license.

## License

This plugin and the launcher are MIT-licensed (see LICENSE). ${app.product} itself is commercial software by
ContentaSoft AB.
`);

  console.log(`plugin ${p.name} -> ${dir}`);
}
