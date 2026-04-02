import { create } from 'zustand';

interface SettingsState {
  unitSystem: 'metric';
}

export const useSettingsStore = create<SettingsState>(() => ({
  unitSystem: 'metric',
}));
