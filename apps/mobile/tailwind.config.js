/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1E3A5F', 50: '#f0f4f8', 100: '#dce5ef', 600: '#18304d', 700: '#122740' },
        accent: { DEFAULT: '#F59E0B', light: '#fbbf24', dark: '#d97706' },
        success: '#10B981',
        warning: '#F97316',
        danger: '#EF4444',
        surface: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E2E8F0',
        text: { DEFAULT: '#0F172A', muted: '#64748B' },
      },
      fontFamily: {
        sans: ['Inter', 'System'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { sm: 4, md: 8, lg: 12, xl: 16 },
    },
  },
  plugins: [],
};
