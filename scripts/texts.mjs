// Texts shared by the npm README (build.mjs) and the Claude plugin bundles (build-plugins.mjs), so the
// trial and install wording is the same on every surface. Keep each sentence true for the shipped builds.

/** One honest trial sentence per app, matching the app's own status command. */
export const trial = {
  cc: 'The free trial has no end date: the first 10 outputs per PC come out clean, later ones carry a trial watermark (PDF albums, merged PDFs and slideshows are always marked on the trial). `contenta status` shows how many clean outputs are left; a batch spends one per file.',
  vr: 'The free trial has no end date: the first 10 files per PC are unrestricted, later ones are watermarked and cut at 10 minutes. `videorecompress status` shows how many free files are left; a batch spends one per file.',
  aive: 'The free trial has no end date: the first 5 full exports per PC are clean and full resolution, later ones are watermarked and capped at 1280x720; 10-second clips (`--clip`) stay free. `aivideoenhancer status` shows how many full exports are left.',
  cad: 'The free trial gives 10 conversions at full quality within 30 days of the first launch; after that STEP/IGES/BREP are meshed at draft quality and every export carries a trial note. Nothing is blocked.',
};

export const trialTail = 'Nothing stops working; a licence removes the limits.';

/** The plugin's marketplace is the plugin's own repository, so the marketplace name is the repository name. */
export const repoName = (pluginName) => `${pluginName}-plugin`;

export function claudeInstall(pluginName) {
  const repo = repoName(pluginName);
  return { marketplaceAdd: `/plugin marketplace add contentasoftware/${repo}`, install: `/plugin install ${pluginName}@${repo}`,
    cliAdd: `claude plugin marketplace add contentasoftware/${repo}`, cliInstall: `claude plugin install ${pluginName}@${repo}` };
}
