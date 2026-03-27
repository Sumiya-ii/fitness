const tokens = require('./src/theme/tokens.json');

const { colors } = tokens;

module.exports = {
  content: ['./src/**/*.{ts,tsx}', './App.tsx'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: colors.brand.primary['100'],
          200: colors.brand.primary['200'],
          300: colors.brand.primary['300'],
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: colors.brand.primary['700'],
          800: colors.brand.primary['800'],
          900: colors.brand.primary['900'],
        },
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',
        accent: colors.accent,
        surface: {
          DEFAULT: 'rgb(var(--color-surface-default) / <alpha-value>)',
          secondary: 'rgb(var(--color-surface-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-surface-tertiary) / <alpha-value>)',
          app: 'rgb(var(--color-surface-app) / <alpha-value>)',
          card: 'rgb(var(--color-surface-card) / <alpha-value>)',
          border: 'rgb(var(--color-surface-border) / <alpha-value>)',
          muted: 'rgb(var(--color-surface-muted) / <alpha-value>)',
        },
        text: {
          DEFAULT: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-text-tertiary) / <alpha-value>)',
          inverse: 'rgb(var(--color-text-inverse) / <alpha-value>)',
          app: 'rgb(var(--color-text-app) / <alpha-value>)',
        },
        danger: colors.status.danger,
        warning: colors.status.warning,
        success: colors.status.success,
        orange: colors.brand.orange,
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
