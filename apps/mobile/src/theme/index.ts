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
  dark: true,
  fonts: navigationFonts,
  colors: {
    primary: '#ffffff',
    background: '#000000',
    card: '#1c1c1e',
    border: '#2c2c2e',
    text: '#ffffff',
    notification: '#f97316',
  },
};
