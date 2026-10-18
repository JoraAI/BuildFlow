/**
 * EAS monorepo install runs from the workspace root. Root pnpm.overrides pin
 * metro@0.80.12 for Expo 51 (mobile / Vercel). Jora Trade is Expo 54 and needs
 * metro@0.83 via @expo/metro — strip those pins before EAS pnpm install.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootPkgPath = path.resolve(__dirname, '../../../package.json');
const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const overrides = pkg.pnpm?.overrides;
if (!overrides) {
  console.log('[eas-relax-metro] no pnpm.overrides — nothing to do');
  process.exit(0);
}

const metroKeys = Object.keys(overrides).filter(
  (k) => k === 'metro' || k.startsWith('metro-') || k.startsWith('@expo/metro>'),
);
if (metroKeys.length === 0) {
  console.log('[eas-relax-metro] no metro overrides — nothing to do');
  process.exit(0);
}

for (const k of metroKeys) delete overrides[k];
fs.writeFileSync(rootPkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`[eas-relax-metro] removed ${metroKeys.length} metro override(s) for Expo 54 EAS install`);
