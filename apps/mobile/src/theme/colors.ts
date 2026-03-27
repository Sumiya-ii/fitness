/**
 * Light & dark color palettes.
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
  textInverse: string;

  // Brand / accent
  primary: string; // main CTA color
  primaryText: string; // text on primary CTA
  accent: string;

  // Macros
  protein: string;
  carbs: string;
  fat: string;
  water: string;
  waterTrack: string;

  // Status
  danger: string;
  warning: string;
  success: string;

  // Progress tracks
  trackBg: string;

  // Misc
  separator: string;
  skeleton: string;
  icon: string;
  iconMuted: string;
  shadow: string;
  tabBarBg: string;
  tabBarBorder: string;
  tabActive: string;
  tabInactive: string;
  logButton: string;
  logButtonIcon: string;
  streak: string;
  statusBarStyle: 'light' | 'dark';

  // Onboarding selection
  selectedBg: string;
  selectedText: string;
  unselectedBg: string;
  unselectedText: string;

  // Switch
  switchTrackOff: string;
  switchTrackOn: string;

  // Navigation
  navBg: string;
  navCard: string;
  navBorder: string;
  navText: string;
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
  textInverse: '#ffffff',

  primary: '#0f172a',
  primaryText: '#ffffff',
  accent: '#06b6d4',

  protein: '#f97316',
  carbs: '#f59e0b',
  fat: '#3b82f6',
  water: '#0ea5e9',
  waterTrack: '#e0f2fe',

  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',

  trackBg: '#e8eef5',

  separator: '#f0f4f9',
  skeleton: '#edf2f9',
  icon: '#0b1220',
  iconMuted: '#9aabbf',
  shadow: '#0b1220',
  tabBarBg: '#ffffff',
  tabBarBorder: 'rgba(0,0,0,0.08)',
  tabActive: '#0f172a',
  tabInactive: '#94a3b8',
  logButton: '#0f172a',
  logButtonIcon: '#ffffff',
  streak: '#f97316',
  statusBarStyle: 'dark',

  selectedBg: '#0f172a',
  selectedText: '#ffffff',
  unselectedBg: '#f5f5f7',
  unselectedText: '#0b1220',

  switchTrackOff: '#dde5f0',
  switchTrackOn: '#0f172a',

  navBg: '#f4f7fb',
  navCard: '#ffffff',
  navBorder: '#dde5f0',
  navText: '#0b1220',
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
  textInverse: '#000000',

  primary: '#ffffff',
  primaryText: '#000000',
  accent: '#38bdf8',

  protein: '#f97316',
  carbs: '#f59e0b',
  fat: '#3b82f6',
  water: '#0ea5e9',
  waterTrack: '#0c4a6e',

  danger: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',

  trackBg: '#2c2c2e',

  separator: '#2c2c2e',
  skeleton: '#2c2c2e',
  icon: '#ffffff',
  iconMuted: '#71717a',
  shadow: '#000000',
  tabBarBg: '#0a0a0a',
  tabBarBorder: 'rgba(255,255,255,0.08)',
  tabActive: '#ffffff',
  tabInactive: '#71717a',
  logButton: '#ffffff',
  logButtonIcon: '#000000',
  streak: '#f97316',
  statusBarStyle: 'light',

  selectedBg: '#ffffff',
  selectedText: '#000000',
  unselectedBg: '#1c1c1e',
  unselectedText: '#ffffff',

  switchTrackOff: '#3a3a3c',
  switchTrackOn: '#ffffff',

  navBg: '#000000',
  navCard: '#1c1c1e',
  navBorder: '#2c2c2e',
  navText: '#ffffff',
};
