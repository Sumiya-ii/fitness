import type { Theme } from '@react-navigation/native';
import tokens from './tokens.json';

const { colors } = tokens;

export const themeColors = {
  primary: colors.brand.primary,
  accent: colors.accent,
  surface: colors.surface,
  text: colors.text,
  status: colors.status,
} as const;

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

export const appNavigationTheme: Theme = {
  dark: false,
  fonts: navigationFonts,
  colors: {
    primary: themeColors.primary['500'],
    background: themeColors.surface.app,
    card: themeColors.surface.card,
    border: themeColors.surface.border,
    text: themeColors.text.appPrimary,
    notification: themeColors.primary['500'],
  },
};
