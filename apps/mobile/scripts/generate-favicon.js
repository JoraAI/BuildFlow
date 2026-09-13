/**
 * Generates apps/mobile/assets/favicon.png from the BuildFlow app icon
 * (same BF mark used for Construction ERP / app icon).
 *
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
console.log(`Wrote favicon from icon.png -> ${outPath}`);
