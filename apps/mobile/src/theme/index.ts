import { DarkTheme, type Theme } from '@react-navigation/native';
import tokens from './tokens.json';

const { colors } = tokens;

export const themeColors = {
  primary: colors.brand.primary,
  accent: colors.accent,
  surface: colors.surface,
  text: colors.text,
  status: colors.status,
} as const;

export const appNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: themeColors.primary['500'],
    background: themeColors.surface.app,
    card: themeColors.surface.card,
    border: themeColors.surface.border,
    text: themeColors.text.appPrimary,
    notification: themeColors.primary['500'],
  },
};
