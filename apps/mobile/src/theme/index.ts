import type { Theme } from '@react-navigation/native';
import tokens from './tokens.json';
import { lightPalette, darkPalette, type ColorPalette } from './colors';
import { useThemeStore } from '../stores/theme.store';

const { colors } = tokens;

export type { ColorPalette };
export { lightPalette, darkPalette };

export const themeColors = {
  primary: colors.brand.primary,
  accent: colors.accent,
  surface: colors.surface,
  text: colors.text,
  status: colors.status,
} as const;

/** Returns the active color palette based on theme mode. */
export function useColors(): ColorPalette {
  const scheme = useThemeStore((s) => s.scheme);
  return scheme === 'dark' ? darkPalette : lightPalette;
}

const navigationFonts: Theme['fonts'] = {
  regular: {
    fontFamily: 'Inter',
    fontWeight: '400',
  },
  medium: {
    fontFamily: 'Inter-Medium',
    fontWeight: '500',
  },
  bold: {
    fontFamily: 'Inter-SemiBold',
    fontWeight: '700',
  },
  heavy: {
    fontFamily: 'Inter-Bold',
    fontWeight: '800',
  },
};

export function buildNavigationTheme(palette: ColorPalette): Theme {
  return {
    dark: palette === darkPalette,
    fonts: navigationFonts,
    colors: {
      primary: palette.primary,
      background: palette.navBg,
      card: palette.navCard,
      border: palette.navBorder,
      text: palette.navText,
      notification: palette.streak,
    },
  };
}

// Keep a static export for backward compat (defaults to dark)
export const appNavigationTheme = buildNavigationTheme(darkPalette);
