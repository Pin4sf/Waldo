/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Waldo brand palette
        background: '#FAFAF8',
        accent: '#F97316',       // orange
        positive: '#D1FAE5',     // soft green
        'positive-text': '#065F46',
        warning: '#FEF3C7',
        'warning-text': '#92400E',
        critical: '#FEE2E2',
        'critical-text': '#991B1B',
        surface: '#FFFFFF',
        border: '#E5E5E3',
        muted: '#737373',
        // CRS zone colours (matches WALDO_MASTER_REFERENCE zones)
        'zone-optimal': '#22C55E',   // CRS 80+
        'zone-good': '#84CC16',      // CRS 65-79
        'zone-moderate': '#F97316',  // CRS 50-64
        'zone-low': '#EF4444',       // CRS < 50
      },
      fontFamily: {
        sans: ['DMSans', 'system-ui'],
        display: ['VCorben', 'serif'],
      },
    },
  },
  plugins: [],
};
