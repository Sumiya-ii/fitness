/**
 * Light & dark color palettes.
 * Every screen/component should use `useColors()` for inline styles
 * instead of hardcoding hex values.
 *
 * ~20 semantic tokens — kept intentionally small.
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
  bg: '#f4f7fb',
  card: '#ffffff',
  cardAlt: '#f0f4f9',
  border: '#dde5f0',
  muted: '#c3cedf',

  text: '#0b1220',
  textSecondary: '#51617a',
  textTertiary: '#7687a2',

  primary: '#0f172a',
  primaryMuted: '#475569',
  onPrimary: '#ffffff',

  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',

  trackBg: '#e8eef5',

  shadow: '#0b1220',
  tabBarBg: '#ffffff',
  tabBarBorder: 'rgba(0,0,0,0.08)',
  tabInactive: '#94a3b8',
};

export const darkPalette: ColorPalette = {
  bg: '#000000',
  card: '#1c1c1e',
  cardAlt: '#2c2c2e',
  border: '#2c2c2e',
  muted: '#48484a',

  text: '#ffffff',
  textSecondary: '#a1a1aa',
  textTertiary: '#71717a',

  primary: '#ffffff',
  primaryMuted: '#94a3b8',
  onPrimary: '#000000',

  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',

  trackBg: '#2c2c2e',

  shadow: '#000000',
  tabBarBg: '#0a0a0a',
  tabBarBorder: 'rgba(255,255,255,0.08)',
  tabInactive: '#71717a',
};
