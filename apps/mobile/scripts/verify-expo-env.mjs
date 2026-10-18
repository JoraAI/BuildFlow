/**
 * Fail Vercel builds early when EXPO_PUBLIC_API_URL is missing.
 * Expo inlines this at bundle time - without it the app calls localhost.
 *
 * Also guard against metro@0.83 (Expo 54 / @expo/metro) being hoisted — Expo 51
 * web export requires metro/src/lib/TerminalReporter which 0.83 does not export.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

if (process.env.VERCEL && !apiUrl) {
  console.error(
    '\n❌ EXPO_PUBLIC_API_URL is not set.\n' +
      '   Vercel → Settings → Environment Variables → add:\n' +
      '   EXPO_PUBLIC_API_URL=https://your-api.onrender.com/api\n',
  );
  process.exit(1);
}

if (apiUrl) {
  console.log(`✓ EXPO_PUBLIC_API_URL=${apiUrl}`);
} else {
  console.warn('⚠ EXPO_PUBLIC_API_URL not set - dev build will use http://localhost:4000/api');
}

try {
  const metroPkg = require('metro/package.json');
  const ver = String(metroPkg.version || '');
  if (metroPkg.exports || ver.startsWith('0.83') || ver.startsWith('0.82')) {
    console.error(
      `\n❌ metro@${ver} is incompatible with Expo 51 web export (TerminalReporter exports).\n` +
        '   Root pnpm.overrides must keep metro@0.80.12 for @buildflow/mobile / Vercel.\n',
    );
    process.exit(1);
  }
  console.log(`✓ metro@${ver} (Expo 51 web-compatible)`);
} catch (err) {
  console.warn(`⚠ could not resolve metro: ${err?.message || err}`);
}
