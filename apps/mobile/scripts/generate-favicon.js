/**
 * Generates apps/mobile/assets/favicon.png from the Construction ERP brand mark
 * (amber tile + construct tools — same mark shown in sidebar / login / top bar).
 *
 * Source of truth: assets/icon.png
 * Run: node apps/mobile/scripts/generate-favicon.js
 * Requires ImageMagick `convert` on PATH.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
const iconPath = path.join(assetsDir, 'icon.png');
const outPath = path.join(assetsDir, 'favicon.png');

if (!fs.existsSync(iconPath)) {
  console.error(`Missing source icon: ${iconPath}`);
  process.exit(1);
}

execFileSync('convert', [iconPath, '-resize', '48x48', outPath], { stdio: 'inherit' });
console.log(`Wrote favicon from Construction ERP brand mark (icon.png) -> ${outPath}`);
