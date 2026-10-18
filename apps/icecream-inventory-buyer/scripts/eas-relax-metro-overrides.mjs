/**
 * EAS monorepo install runs from the workspace root. Root pnpm.overrides pin
 * metro@0.80.12 for Expo 51 (mobile / Vercel). Jora Trade is Expo 54 and needs
 * metro@0.83 via @expo/metro — strip those pins before EAS pnpm install.
 *
 * Also disable prefer-frozen-lockfile so the lockfile can resolve without the
 * removed overrides (root .npmrc sets prefer-frozen-lockfile=true for CI).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
const rootPkgPath = path.join(rootDir, 'package.json');
const npmrcPath = path.join(rootDir, '.npmrc');

const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const overrides = pkg.pnpm?.overrides;
if (overrides) {
  const metroKeys = Object.keys(overrides).filter(
    (k) => k === 'metro' || k.startsWith('metro-') || k.startsWith('@expo/metro>'),
  );
  for (const k of metroKeys) delete overrides[k];
  fs.writeFileSync(rootPkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`[eas-relax-metro] removed ${metroKeys.length} metro override(s) for Expo 54 EAS install`);
} else {
  console.log('[eas-relax-metro] no pnpm.overrides — nothing to strip');
}

if (fs.existsSync(npmrcPath)) {
  const npmrc = fs.readFileSync(npmrcPath, 'utf8');
  const next = npmrc
    .split('\n')
    .map((line) =>
      line.trim().startsWith('prefer-frozen-lockfile')
        ? 'prefer-frozen-lockfile=false'
        : line,
    )
    .join('\n');
  if (!next.includes('prefer-frozen-lockfile=false')) {
    fs.writeFileSync(npmrcPath, `${npmrc.trimEnd()}\nprefer-frozen-lockfile=false\n`);
  } else if (next !== npmrc) {
    fs.writeFileSync(npmrcPath, next.endsWith('\n') ? next : `${next}\n`);
  }
  console.log('[eas-relax-metro] prefer-frozen-lockfile=false for EAS install');
}