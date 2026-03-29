import { create } from 'zustand';

interface SettingsState {
  unitSystem: 'metric';
  loadUnitSystem: () => Promise<void>;
  setUnitSystem: (unit: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>(() => ({
  unitSystem: 'metric',
  loadUnitSystem: async () => {},
  setUnitSystem: async () => {},
}));
