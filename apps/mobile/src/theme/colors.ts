/**
 * Light & dark color palettes — Cal AI–inspired minimal aesthetic.
 *
 * Light theme: pure white surfaces, near-black text, near-black primary CTA.
 * Dark theme:  near-black surfaces, off-white text, off-white primary CTA.
 *
 * The accent slot is reserved for the brand green (#16A34A) used sparingly
 * for streaks, success states, and progress highlights. Status colors
 * (success/warning/danger) follow iOS Human Interface Guidelines.
 *
 * Every screen/component should use `useColors()` for inline styles
 * instead of hardcoding hex values.
 */

export interface ColorPalette {
  // Backgrounds
  bg: string;
  card: string;
  cardAlt: string; // secondary card / input bg
  border: string;
  muted: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;

  // Brand / accent
  primary: string; // main CTA color
  primaryMuted: string; // primary-400 equivalent (subdued)
  onPrimary: string; // text/icons on primary bg
  accent: string; // green accent (success / highlight)
  onAccent: string; // text/icons on accent bg

  // Status
  danger: string;
  warning: string;
  success: string;

  // Progress tracks
  trackBg: string;

  // Misc
  shadow: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabInactive: string;
}

export const lightPalette: ColorPalette = {
  bg: '#FFFFFF',
  card: '#F5F5F7',
  cardAlt: '#EBEBF0',
  border: '#E5E5EA',
  muted: '#C7C7CC',

  text: '#0A0A0A',
  textSecondary: '#3C3C43',
  textTertiary: '#8E8E93',

  primary: '#0A0A0A',
  primaryMuted: '#3C3C43',
  onPrimary: '#FFFFFF',
  accent: '#16A34A',
  onAccent: '#FFFFFF',

  danger: '#FF3B30',
  warning: '#FF9500',
  success: '#34C759',

  trackBg: '#EBEBF0',

  shadow: '#0A0A0A',
  tabBarBg: '#FFFFFF',
  tabBarBorder: 'rgba(10, 10, 10, 0.06)',
  tabInactive: '#8E8E93',
};

export const darkPalette: ColorPalette = {
  bg: '#000000',
  card: '#1C1C1E',
  cardAlt: '#2C2C2E',
  border: '#2C2C2E',
  muted: '#48484A',

  text: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textTertiary: '#8E8E93',

  primary: '#FFFFFF',
  primaryMuted: '#EBEBF5',
  onPrimary: '#0A0A0A',
  accent: '#22C55E',
  onAccent: '#0A0A0A',

  danger: '#FF453A',
  warning: '#FF9F0A',
  success: '#30D158',

  trackBg: '#2C2C2E',

  shadow: '#000000',
  tabBarBg: '#0A0A0A',
  tabBarBorder: 'rgba(255, 255, 255, 0.06)',
  tabInactive: '#8E8E93',
};
