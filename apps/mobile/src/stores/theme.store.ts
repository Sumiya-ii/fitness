import { create } from 'zustand';
import { Appearance } from 'react-native';
import { MMKV } from 'react-native-mmkv';

export type ThemeMode = 'system' | 'light' | 'dark';

const storage = new MMKV({ id: 'coach-theme' });
const THEME_KEY = 'theme_mode';

function getStoredMode(): ThemeMode {
  const stored = storage.getString(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'dark';
}

export function resolveScheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  }
  return mode;
}

interface ThemeState {
  mode: ThemeMode;
  scheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const initial = getStoredMode();

  // Sync React Native appearance so NativeWind CSS variables resolve correctly
  Appearance.setColorScheme(initial === 'system' ? 'unspecified' : initial);

  return {
    mode: initial,
    scheme: resolveScheme(initial),

    setMode: (mode: ThemeMode) => {
      storage.set(THEME_KEY, mode);
      Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
      set({ mode, scheme: resolveScheme(mode) });
    },
  };
});

// Listen for system appearance changes
Appearance.addChangeListener(() => {
  const { mode } = useThemeStore.getState();
  if (mode === 'system') {
    useThemeStore.setState({ scheme: resolveScheme('system') });
  }
});
