import type { Theme } from '@react-navigation/native';
import { lightPalette, darkPalette, type ColorPalette } from './colors';
import { useThemeStore } from '../stores/theme.store';

export type { ColorPalette };
export { lightPalette, darkPalette };

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
      background: palette.bg,
      card: palette.card,
      border: palette.border,
      text: palette.text,
      notification: palette.accent,
    },
  };
}
