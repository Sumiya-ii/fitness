module.exports = {
  content: ['./src/**/*.{ts,tsx}', './App.tsx'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' },
        accent: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce' },
        surface: { DEFAULT: '#ffffff', secondary: '#f8fafc', tertiary: '#f1f5f9' },
        text: { DEFAULT: '#0f172a', secondary: '#475569', tertiary: '#94a3b8', inverse: '#ffffff' },
        danger: '#ef4444',
        warning: '#f59e0b',
        success: '#22c55e',
      },
      fontFamily: {
        sans: ['Inter'],
        'sans-medium': ['Inter-Medium'],
        'sans-semibold': ['Inter-SemiBold'],
        'sans-bold': ['Inter-Bold'],
      },
    },
  },
  plugins: [],
};
