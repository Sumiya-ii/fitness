const tokens = require('./src/theme/tokens.json');

const { colors } = tokens;

module.exports = {
  content: ['./src/**/*.{ts,tsx}', './App.tsx'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: colors.brand.primary,
        accent: colors.accent,
        surface: {
          DEFAULT: colors.surface.default,
          secondary: colors.surface.secondary,
          tertiary: colors.surface.tertiary,
          app: colors.surface.app,
          card: colors.surface.card,
          border: colors.surface.border,
          muted: colors.surface.muted,
        },
        text: {
          DEFAULT: colors.text.primary,
          secondary: colors.text.secondary,
          tertiary: colors.text.tertiary,
          inverse: colors.text.inverse,
          app: colors.text.appPrimary,
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
