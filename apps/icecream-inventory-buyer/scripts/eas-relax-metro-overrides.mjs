/**
 * EAS monorepo install runs from the workspace root with
 * `pnpm install --frozen-lockfile` (CLI flag — ignores .npmrc).
 *
 * Root pnpm.overrides pin metro@0.80.12 for Expo 51 (mobile / Vercel).
 * Jora Trade is Expo 54 and needs metro@0.83. Rewrite those pins to 0.83,
 * regenerate the lockfile so frozen install accepts the new overrides, then
 * EAS's install can proceed.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../..');
const rootPkgPath = path.join(rootDir, 'package.json');
const npmrcPath = path.join(rootDir, '.npmrc');

const METRO_83 = '0.83.3';

const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const overrides = pkg.pnpm?.overrides;
if (overrides) {
  const metroKeys = Object.keys(overrides).filter(
    (k) => k === 'metro' || k.startsWith('metro-') || k.startsWith('@expo/metro>'),
  );
  for (const k of metroKeys) {
    // Drop nested @expo/metro> pins — global 0.83 is enough on EAS.
    if (k.startsWith('@expo/metro>')) {
      delete overrides[k];
    } else {
      overrides[k] = METRO_83;
    }
  }
  fs.writeFileSync(rootPkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(
    `[eas-relax-metro] set ${metroKeys.filter((k) => !k.startsWith('@expo/metro>')).length} metro override(s) → ${METRO_83}; removed nested @expo/metro> pins`,
  );
} else {
  console.log('[eas-relax-metro] no pnpm.overrides — nothing to rewrite');
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
  console.log('[eas-relax-metro] prefer-frozen-lockfile=false');
}

// Sync lockfile overrides with package.json so `pnpm install --frozen-lockfile` works.
console.log('[eas-relax-metro] regenerating lockfile for Expo 54 metro pins…');
execSync('pnpm install --no-frozen-lockfile --lockfile-only', {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, CI: '1' },
});
console.log('[eas-relax-metro] lockfile ready for frozen EAS install');
