// Texts shared by the npm README (build.mjs) and the Claude plugin bundles (build-plugins.mjs), so the
// trial and install wording is the same on every surface. Keep each sentence true for the shipped builds.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const contenta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** One honest trial sentence per app, matching the app's own status command. */
export const trial = {
  cc: 'The free trial has no end date: the first 10 outputs per PC come out clean, later ones carry a trial watermark (PDF albums, merged PDFs and slideshows are always marked on the trial). `contenta status` shows how many clean outputs are left; a batch spends one per file.',
  vr: 'The free trial has no end date: the first 10 files per PC are unrestricted, later ones are watermarked and cut at 10 minutes. `videorecompress status` shows how many free files are left; a batch spends one per file.',
  aive: 'The free trial has no end date: the first 5 full exports per PC are clean and full resolution, later ones are watermarked and capped at 1280x720; 10-second clips (`--clip`) stay free. `aivideoenhancer status` shows how many full exports are left.',
  cad: 'The free trial gives 10 conversions at full quality within 30 days of the first launch; after that STEP/IGES/BREP are meshed at draft quality and every export carries a trial note.',
};

export const trialTail = 'Nothing stops working; a licence removes the limits.';

/**
 * Plain-language requests that open each Claude README, for buyers who never use a command line.
 * Each one maps to a recipe or command in the app's skill; keep it that way.
 */
export const askExamples = {
  cc: [
    'Make every photo in my Products folder a 2000 x 2000 square on a white background for Amazon.',
    'Convert the HEIC photos from my iPhone to JPG so I can email them.',
    'Shrink these listing photos to under 500 KB each.',
  ],
  vr: [
    'Shrink the videos in my phone backup folder and tell me how much space I got back.',
    'Compress my drone footage, but test one clip first and show me the quality score.',
    'Make this video small enough to send on WhatsApp.',
  ],
  aive: [
    'Clean up and upscale the old family videos I copied from VHS tapes.',
    'Steady this shaky GoPro clip.',
    'Make a before-and-after video so I can see the difference.',
  ],
  cad: [
    'Convert this STEP file to 3MF for my slicer.',
    'How big is this STEP part, and what unit was it drawn in?',
    'Turn this assembly into a GLB file I can show a customer in a web browser.',
  ],
};

export const desktopWindow = (product) =>
  `${product} also works without an agent: open it from the Start menu and work in its own window.`;

/** Buy page per app. Claude README only: the OpenAI directory forbids pricing, trial and promotion text. */
const buyPage = {
  cc: 'web/contenta-converter.com/buy.php',
  vr: 'web/contenta-software.com/videorecompress/buy.php',
  aive: 'web/contenta-software.com/aivideoenhancer/buy.php',
  cad: 'web/contenta-software.com/3dcadconverter/buy.php',
};
const buyUrl = {
  cc: 'https://www.contenta-converter.com/buy.php',
  vr: 'https://www.contenta-software.com/videorecompress/buy.php',
  aive: 'https://www.contenta-software.com/aivideoenhancer/buy.php',
  cad: 'https://www.contenta-software.com/3dcadconverter/buy.php',
};

/**
 * "$129, a one-time purchase..." The price is read from the buy page's getPrice() table (its first
 * 'lifetime' entry is the USD default), so the README never carries a second copy of the number.
 */
export function priceLine(key) {
  const php = fs.readFileSync(path.join(contenta, buyPage[key]), 'utf8');
  const m = php.match(/'lifetime'\s*=>\s*'(\$\d+)'/);
  if (!m) throw new Error(`${key}: no 'lifetime' price in ${buyPage[key]}`);
  return `${m[1]}, a one-time purchase. No subscription needed. Prices: ${buyUrl[key]}`;
}

/** Developer facts per app: what --json prints and what the exit codes mean. Match the skills. */
export const developer = {
  cc: {
    scheduleNote: 'To convert each new photo saved to a folder while you are signed in, start `watch` at logon; it runs until you sign out or close its window:',
    schedule: 'schtasks /create /tn "Contenta Converter watch" /sc onlogon /tr "contenta watch D:\\Inbox --output D:\\Ready --format webp"',
    json: 'Every command takes `--json` and prints JSON on stdout. An error is one `{"success":false,"error":"...","exitCode":N}` object. `batch --json` prints progress objects while it runs; the last object is the summary, with `outputs` and `errors`.',
    exit: '0 done · 1 general error · 2 invalid arguments · 4 a conversion failed (in a batch the other files are still written) · 5 file or folder not found · 6 bundled tools missing · 130 cancelled.',
  },
  vr: {
    scheduleNote: 'To compress each new video saved to a folder while you are signed in, start `watch` at logon; it runs until you sign out or close its window:',
    schedule: 'schtasks /create /tn "VideoRecompress Studio watch" /sc onlogon /tr "videorecompress watch --folder D:\\Camera --preset phone_archive --output D:\\Compressed"',
    json: 'Every command takes `--json`: JSON on stdout, logs on stderr. `batch --json` prints one object per line, progress first; the last line is the summary, with `success`, `processed`, `failed` and `errors`.',
    exit: '0 done · 1 general error · 2 invalid arguments · 4 recompression failed (in a batch the other files are still written) · 5 file or folder not found · 6 ffmpeg missing.',
  },
  aive: {
    scheduleNote: 'A nightly run with `--skip-existing` enhances only the videos that have no output yet:',
    schedule: 'schtasks /create /tn "AI Video Enhancer Studio nightly" /sc daily /st 02:00 /tr "aivideoenhancer enhance D:\\Tapes -o D:\\Restored --preset old_video_restoration --skip-existing"',
    json: 'Results are plain text on stdout and log lines go to stderr; a failure prints one `Error: ...` line on stderr. Only `remix suggest` has `--json`, so check the exit code.',
    exit: '0 done · 1 general error · 2 invalid arguments · 3 daily clip limit reached · 4 enhancement failed or timed out · 5 file not found · 6 tools missing.',
  },
  cad: {
    scheduleNote: 'To convert each new file saved to a folder while you are signed in, start `watch` at logon; it runs until you sign out or close its window:',
    schedule: 'schtasks /create /tn "3D CAD Converter watch" /sc onlogon /tr "cadconvert watch D:\\Parts D:\\Meshes -f 3mf --quality fine"',
    json: '`info`, `formats`, `convert` and `batch` take `--json` and print exactly one object, with `success` and, when there is something to report, `warning` and `notes`. An error is `{"success":false,"error":"...","exitCode":N}`. Piped text output is plain ASCII.',
    exit: '0 done · 1 error or cancelled · 2 invalid arguments or not a 3D file · 3 file not found · 4 conversion failed (in a batch the other files are still written).',
  },
};

/** Where each app keeps the usage-statistics switch, for machines where nobody opens the app. */
export const telemetrySwitch = {
  cc: { file: '%APPDATA%\\ContentaConverter\\settings.json', key: 'allowUsageMetrics' },
  vr: { file: '%APPDATA%\\VideoRecompressStudio\\settings.json', key: 'allowUsageMetrics' },
  aive: { file: '%APPDATA%\\AIVideoEnhancerStudio\\settings.json', key: 'AllowTelemetry' },
  cad: { file: '%APPDATA%\\CadConverter\\settings.json', key: 'AllowUsageMetrics' },
};

/**
 * Where the files are processed, one bullet each. No offline or no-upload claim next to an AI feature (copy
 * standard, section 4): AIVE says only where the work runs, and CC names its one Gemini tool separately.
 */
export const localWork = {
  cc: [
    'Converting, resizing, effects, metadata, PDF albums and slideshows run on this PC and need no internet connection.',
    'One tool uses the internet: `ai_transform` sends the image to Google Gemini on your own Gemini API key. The skill tells the agent to ask you first.',
  ],
  vr: ['Videos are compressed on this PC. They are not uploaded, and compressing needs no internet connection.'],
  aive: ['Videos are enhanced on this PC, on its own GPU.'],
  cad: ['Files are converted on this PC. They are not uploaded, and converting needs no internet connection.'],
};

/** CAD only: the format list buyers asked for, and what to do with native CAD files. Matches `cadconvert formats`. */
export const cadFormats = {
  read: 'STEP (.step, .stp), IGES (.iges, .igs), BREP, STL, OBJ, PLY, 3MF, glTF and GLB, FBX, Collada (.dae), VRML (.wrl, .vrml, .wrz), X3D, OFF, AMF, DXF, DWG, USD and USDZ',
  write: 'STEP, IGES, BREP, STL, OBJ, PLY, 3MF, glTF, GLB, FBX, Collada, VRML, X3D and OFF',
  native: 'SolidWorks (.sldprt, .sldasm), Fusion (.f3d), Inventor (.ipt, .iam), Creo (.prt), CATIA (.CATPart), Parasolid (.x_t) and ACIS (.sat) files do not open directly. Export the part or assembly as STEP from your CAD program, then convert the STEP file.',
};

/** The plugin's marketplace is the plugin's own repository, so the marketplace name is the repository name. */
export const repoName = (pluginName) => `${pluginName}-plugin`;

export function claudeInstall(pluginName) {
  const repo = repoName(pluginName);
  return { marketplaceAdd: `/plugin marketplace add contentasoftware/${repo}`, install: `/plugin install ${pluginName}@${repo}`,
    cliAdd: `claude plugin marketplace add contentasoftware/${repo}`, cliInstall: `claude plugin install ${pluginName}@${repo}` };
}
