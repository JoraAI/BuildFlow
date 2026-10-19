/**
 * Generates apps/mobile/assets/favicon.png from the BuildFlow brand mark.
 *
 * Source of truth: assets/buildflow-mark.png
 * Run: node apps/mobile/scripts/generate-favicon.js
 * Requires ImageMagick `convert` on PATH.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
const markPath = path.join(assetsDir, 'buildflow-mark.png');
const legacyIconPath = path.join(assetsDir, 'icon.png');
const outPath = path.join(assetsDir, 'favicon.png');

const source = fs.existsSync(markPath) ? markPath : legacyIconPath;
if (!fs.existsSync(source)) {
  console.error(`Missing brand mark: ${markPath}`);
  process.exit(1);
}

execFileSync('convert', [source, '-resize', '48x48', outPath], { stdio: 'inherit' });
console.log(`Wrote favicon from ${path.basename(source)} -> ${outPath}`);
