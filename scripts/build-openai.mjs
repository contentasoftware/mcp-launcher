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

const termsUrl = (app) => app.privacyUrl.replace('privacy.php', 'terms.php');
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };

fs.rmSync(out, { recursive: true, force: true });
for (const app of apps) {
  const l = listing[app.key];
  for (const [k, v] of [['short', l.short], ['displayName', app.product]]) if (v.length > 30) throw new Error(`${app.key} ${k} > 30: ${v}`);
  for (const p of l.prompts) if (p.length > 128) throw new Error(`${app.key} prompt > 128: ${p}`);
  const dir = path.join(out, l.name);

  const icon = fs.readFileSync(path.join(contenta, l.icon));
  write(path.join(dir, 'assets', 'icon.png'), icon);
  write(path.join(dir, 'assets', 'logo.png'), icon);

  // The skill drives the app's CLI. Codex runs it on the user's PC; ChatGPT cannot run local programs,
  // so the skill says so up front instead of failing.
  const skill = fs.readFileSync(path.join(contenta, 'ContentaSoft', 'skills', l.skill, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
  const end = skill.indexOf('\n---', 4) + 4;
  const note = `\n\n> **Requires ${app.product} installed on this Windows PC** (download: ${app.downloadUrl}).` +
    ` The commands below run the app's command-line tool on the user's own computer, so they work in Codex and other` +
    ` local agents. In ChatGPT, which cannot run programs on the user's computer, use this skill to choose the right` +
    ` command and give it to the user to run.\n`;
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
          displayName: app.product,
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
