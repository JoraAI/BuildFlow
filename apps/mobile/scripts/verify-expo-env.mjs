/**
 * Fail Vercel builds early when EXPO_PUBLIC_API_URL is missing.
 * Expo inlines this at bundle time - without it the app calls localhost.
 */
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
