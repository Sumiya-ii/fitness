import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UnitSystem } from '@coach/shared';
import { DEFAULT_UNIT_SYSTEM } from '@coach/shared';
import { api } from '../api';

const UNIT_SYSTEM_KEY = 'unit_system';

interface SettingsState {
  unitSystem: UnitSystem;
  loadUnitSystem: () => Promise<void>;
  setUnitSystem: (unit: UnitSystem) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  unitSystem: DEFAULT_UNIT_SYSTEM,

  loadUnitSystem: async () => {
    try {
      const stored = await AsyncStorage.getItem(UNIT_SYSTEM_KEY);
      if (stored === 'metric' || stored === 'imperial') {
        set({ unitSystem: stored });
        return;
      }
      // Fall back to profile from API
      const res = await api.get<{ data: { unitSystem?: string } }>('/profile');
      const unit = res.data?.unitSystem === 'imperial' ? 'imperial' : 'metric';
      await AsyncStorage.setItem(UNIT_SYSTEM_KEY, unit);
      set({ unitSystem: unit });
    } catch {
      set({ unitSystem: DEFAULT_UNIT_SYSTEM });
    }
  },

  setUnitSystem: async (unit: UnitSystem) => {
    set({ unitSystem: unit });
    await AsyncStorage.setItem(UNIT_SYSTEM_KEY, unit);
    try {
      await api.put('/profile', { unitSystem: unit });
    } catch {
      /* keep local — API sync is best-effort */
    }
  },
}));
