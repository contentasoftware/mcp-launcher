// Generates the four OpenAI skills-only plugin packages (ChatGPT + Codex plugin directory) from apps.json
// into dist/openai/<name>/ and dist/openai/<name>.zip (package contents at the ZIP root). Portable Agent
// Plugins format: root plugin.json + extensions.com.openai.interface for the listing, skills/<skill>/SKILL.md,
// assets/. Skills-only because the directory's MCP path needs a public HTTPS server and ours are local apps.
// Run `npm run openai`, then upload each ZIP at https://platform.openai.com/plugins.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contenta = path.resolve(root, '..');
const { version, apps } = JSON.parse(fs.readFileSync(path.join(root, 'apps.json'), 'utf8'));
const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
const out = path.join(root, 'dist', 'openai');

// Listing copy: displayName <= 30, shortDescription <= 30, prompts <= 128 characters (OpenAI limits).
const listing = {
  cc: {
    name: 'contenta-converter', skill: 'contenta-image-processing', icon: 'docs/brand/contenta-converter/contenta-converter-logo-1024.png',
    short: 'Batch convert images locally',
    category: 'Creativity',
    supportUrl: 'https://www.contenta-converter.com/support.php',
    purpose: 'Convert, resize, watermark and tag whole folders of images (camera RAW, HEIC, AVIF, PSD, PDF and 100+ formats) on your Windows PC.',
    prompts: [
      'Convert every HEIC photo in this folder to JPG at 2000 px wide.',
      'Split this 20-page scanned PDF into one PNG per page.',
      'Resize these product photos to 1000x1000 for my shop and add a watermark.',
    ],
  },
  vr: {
    name: 'videorecompress-studio', skill: 'contenta-video', icon: 'docs/brand/videorecompress/videorecompress-logo-1024.png',
    short: 'Shrink video files locally',
    category: 'Productivity',
    supportUrl: 'https://www.contenta-software.com/videorecompress/support.php',
    purpose: 'Shrink video files and free up disk space by recompressing them to H.265 or AV1 on your Windows PC, one file or a whole folder.',
    prompts: [
      'Compress all videos in this folder to H.265 and tell me how much space I saved.',
      'Make this video small enough to send on WhatsApp.',
      'Estimate how much smaller my phone videos get with AV1.',
    ],
  },
  aive: {
    name: 'contentasoft-ai-video-enhancer', skill: 'contenta-video-enhancer', icon: 'docs/app-icons-512/aive_icon_512.png',
    short: 'Upscale and fix videos locally',
    category: 'Creativity',
    supportUrl: 'https://www.contenta-software.com/aivideoenhancer/support.php',
    purpose: 'Upscale, stabilize, denoise and smooth videos on your Windows PC with your NVIDIA RTX GPU.',
    prompts: [
      'Upscale this old 480p family video to 1080p and reduce the noise.',
      'Stabilize this shaky drone clip and raise it to 60 fps.',
      'Pull 12 still frames from this video as thumbnails.',
    ],
  },
  cad: {
    name: 'contentasoft-cad-converter', skill: 'contenta-cad', icon: 'docs/app-icons-512/cad_icon_512.png',
    // The directory holds generic dictionary names; the product name alone is three common words.
    displayName: 'ContentaSoft 3D CAD Converter',
    short: 'Convert CAD and 3D files',
    category: 'Creativity',
    supportUrl: 'https://www.contenta-software.com/3dcadconverter/support.php',
    purpose: 'Convert CAD and 3D model files (STEP, IGES, STL, OBJ, FBX, glTF, 3MF) on your Windows PC, for 3D printing, the web or another CAD tool.',
    prompts: [
      'Convert every STEP file in this folder to STL for 3D printing.',
      'Turn this IGES assembly into a GLB I can view on the web.',
      'What units and how many triangles does this OBJ have?',
    ],
  },
};

// The directory's rules (developers.openai.com/plugins/plugin-guidelines) allow saying that a feature is
// not in the user's plan, but not freemium upsells, upgrade promotion or collecting credentials. The public
// skills say more than that (newsletter bonus, the register command, "prints Buy:"), so each OpenAI copy
// gets a neutral limit sentence instead of the Trial paragraph and loses the licence-key commands.
// Every edit must match exactly once: a skill that changes upstream fails the build instead of shipping
// the old wording.
const NO_KEYS = ' Licence keys are entered in the app, never through the agent.';
const openaiEdits = {
  cc: [
    [/^contenta ai-transform (.*?)# needs GEMINI_API_KEY$/m, 'contenta ai-transform $1# needs GEMINI_API_KEY set on this PC by the user; never ask for the key'],
    [/^contenta register <email> <key>\n/m, ''],
    [/^- Trial: .*$/m, '- Without a licence nothing is limited in time: the first 10 outputs on this computer are clean, later ones carry a watermark, and PDF albums, merged PDFs and slideshows always do. `contenta status` shows how many clean outputs are left.' + NO_KEYS],
  ],
  vr: [
    [/^videorecompress register <email> <key>\n/m, ''],
    [/^- Trial: .*$/m, '- Without a licence nothing is limited in time: the first 10 files on this computer are unrestricted, later files are watermarked and cut at 10 minutes.' + NO_KEYS],
  ],
  aive: [
    [/ `aivideoenhancer register <email> <key>` registers a license key\./, ''],
    [/^- Trial: .*$/m, '- Without a licence nothing is limited in time: the first 5 full exports on this computer are full resolution without a watermark, later output is watermarked and capped at 1280x720. A remix render and an upscaled frame extraction each count as one export; `--clip` makes clean 10-second clips.' + NO_KEYS],
  ],
  cad: [
    [/^cadconvert register -k <key> -e <email> .*\n/m, ''],
    [/1 error \(also a rejected license key\)/, '1 error'],
    [/^- Trial: .*$/m, '- Without a licence: 10 conversions at full quality within 30 days of the first launch. After that nothing is blocked: STEP/IGES/BREP to a mesh format is meshed at `draft` whatever `--quality` says, and every export carries a trial note (FBX gets draft only).' + NO_KEYS],
  ],
};
const forOpenAI = (skill, key) => {
  for (const [re, to] of openaiEdits[key]) {
    if ((skill.match(new RegExp(re.source, re.flags.replace('g', '') + 'g')) || []).length !== 1) throw new Error(`${key}: expected exactly one match for ${re}`);
    skill = skill.replace(re, to);
  }
  const left = skill.match(/register <|register -k|newsletter|Buy:|^- Trial:/m);
  if (left) throw new Error(`${key}: OpenAI skill still contains "${left[0]}"`);
  // Codex on Windows runs PowerShell (learn.chatgpt.com/docs/windows/windows-app), so the examples are
  // PowerShell here: forward-slash paths work there too, but PowerShell expands no globs and has no /dev/null.
  skill = skill.replace(/```bash/g, '```powershell')
    .replace(/ \.\/photos\/\*\.jpg /g, ' (Get-ChildItem ./photos/*.jpg).FullName ')
    .replace(/2>\/dev\/null/g, '2>$null')
    .replace(/^- The examples are for Git Bash.*$/m, '- The examples are PowerShell, which Codex uses on Windows; forward-slash paths work there. In bash (WSL, Git Bash) write `./photos/*.jpg` instead of the `Get-ChildItem` form, since bash expands the glob itself.');
  // Codex reads only name and description from the frontmatter; allowed-tools is a Claude Code field.
  skill = skill.replace(/^allowed-tools:.*\n/m, '');
  return skill;
};

const termsUrl = (app) => app.privacyUrl.replace('privacy.php', 'terms.php');
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };

fs.rmSync(out, { recursive: true, force: true });
for (const app of apps) {
  const l = listing[app.key];
  const displayName = l.displayName || app.product;
  for (const [k, v] of [['short', l.short], ['displayName', displayName]]) if (v.length > 30) throw new Error(`${app.key} ${k} > 30: ${v}`);
  for (const p of l.prompts) if (p.length > 128) throw new Error(`${app.key} prompt > 128: ${p}`);
  const dir = path.join(out, l.name);

  const icon = fs.readFileSync(path.join(contenta, l.icon));
  write(path.join(dir, 'assets', 'icon.png'), icon);
  write(path.join(dir, 'assets', 'logo.png'), icon);

  // The skill drives the app's CLI. Codex runs it on the user's PC; ChatGPT cannot run local programs,
  // so the skill says so up front instead of failing.
  const skill = forOpenAI(fs.readFileSync(path.join(contenta, 'ContentaSoft', 'skills', l.skill, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n'), app.key);
  const end = skill.indexOf('\n---', 4) + 4;
  const note = `\n\n> **Requires ${app.product} installed on this Windows PC** (download: ${app.downloadUrl}).` +
    ` The commands below run the app's command-line tool on the user's own computer, so they work in Codex and other` +
    ` local agents (Codex on Windows runs them in PowerShell; the examples are written for it). In ChatGPT, which` +
    ` cannot run programs on the user's computer, use this skill to choose the right command and give it to the user` +
    ` to run. Codex can also use the app's MCP tools: \`codex mcp add ${app.serverName} -- ${app.exe.replace('.exe', '')} serve\`.\n`;
  write(path.join(dir, 'skills', l.skill, 'SKILL.md'), skill.slice(0, end) + note + skill.slice(end));
  write(path.join(dir, 'LICENSE'), license);

  write(path.join(dir, 'plugin.json'), JSON.stringify({
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name: l.name,
    version,
    description: `${app.product} for Windows: ${app.summary}, on local files.`,
    author: { name: 'ContentaSoft AB', url: 'https://www.contenta-software.com/' },
    homepage: app.websiteUrl,
    repository: 'https://github.com/contentasoftware/mcp-launcher',
    license: 'MIT',
    keywords: ['windows', 'batch', 'local', ...app.summary.split(/[ ,/]+/).filter((w) => w.length > 3).slice(0, 4)],
    extensions: {
      'com.openai': {
        interface: {
          displayName,
          shortDescription: l.short,
          longDescription:
            `${l.purpose} ${app.product} is a Windows desktop app for ${app.summary}; this skill teaches the agent its ` +
            `command-line tool (${app.exe.replace('.exe', '')}), so you ask in plain words and the work runs on your own PC, ` +
            `on your own files, with nothing uploaded. It needs ${app.product} installed (${app.downloadUrl}). In Codex the ` +
            `agent runs the commands for you; in ChatGPT it tells you which command to run. Support: bruno@contenta-software.com`,
          developerName: 'ContentaSoft AB',
          category: l.category,
          websiteURL: app.websiteUrl,
          // https only (the dashboard rejects mailto:); AIVE and CAD have no support page, so their contact is in the text.
          ...(l.supportUrl ? { supportURL: l.supportUrl } : {}),
          privacyPolicyURL: app.privacyUrl,
          termsOfServiceURL: termsUrl(app),
          defaultPrompt: l.prompts,
          composerIcon: './assets/icon.png',
          logo: './assets/logo.png',
        },
      },
    },
  }, null, 2) + '\n');

  const zip = path.join(out, `${l.name}.zip`);
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${dir}\\*' -DestinationPath '${zip}' -Force`]);
  console.log(`openai package ${l.name} -> ${zip} (${fs.statSync(zip).size} bytes)`);
}
