/**
 * Light & dark color palettes.
 * Every screen/component should use `useColors()` for inline styles
 * instead of hardcoding hex values.
 *
 * ~20 semantic tokens — kept intentionally small.
 *
 * Brand palette:
 *   Burgundy  #8B2E2E  — primary CTA (light) / accent (dark)
 *   Gold      #C8A45B  — accent (light) / primary CTA (dark)
 *   Cream     #F4E9D8  — light app background / dark text
 *   Dark      #1A0F0A  — dark app background / light text
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
  accent: string; // teal accent
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
  bg: '#F4E9D8',
  card: '#FEFAF5',
  cardAlt: '#F0E4CC',
  border: '#CDB99E',
  muted: '#B8A896',

  text: '#2D1A10',
  textSecondary: '#6B5544',
  textTertiary: '#8A7A68',

  primary: '#8B2E2E',
  primaryMuted: '#A53535',
  onPrimary: '#F4E9D8',
  accent: '#C8A45B',
  onAccent: '#1A0F0A',

  danger: '#C0392B',
  warning: '#D4A017',
  success: '#2D7A3A',

  trackBg: '#E8D5BB',

  shadow: '#2D1A10',
  tabBarBg: '#FEFAF5',
  tabBarBorder: 'rgba(45, 26, 16, 0.08)',
  tabInactive: '#B8A896',
};

export const darkPalette: ColorPalette = {
  bg: '#1A0F0A',
  card: '#2A1C15',
  cardAlt: '#2F2018',
  border: '#3D2E23',
  muted: '#5A4A3C',

  text: '#F4E9D8',
  textSecondary: '#B8A896',
  textTertiary: '#8A7A68',

  primary: '#C8A45B',
  primaryMuted: '#A8843B',
  onPrimary: '#1A0F0A',
  accent: '#8B2E2E',
  onAccent: '#F4E9D8',

  danger: '#F87171',
  warning: '#FBBF24',
  success: '#4ADE80',

  trackBg: '#2A1C15',

  shadow: '#000000',
  tabBarBg: '#130A06',
  tabBarBorder: 'rgba(244, 233, 216, 0.08)',
  tabInactive: '#5A4A3C',
};
