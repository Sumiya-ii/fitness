import { create } from 'zustand';
import { waterApi } from '../api/water';

interface WaterState {
  consumed: number;
  target: number;
  isLoading: boolean;
  error: string | null;
  addWater: (amountMl: number, date?: string) => Promise<void>;
  removeCup: (cupMl: number) => Promise<void>;
  fetchDaily: (date?: string) => Promise<void>;
}

export const useWaterStore = create<WaterState>((set, get) => ({
  consumed: 0,
  target: 2000,
  isLoading: false,
  error: null,

  fetchDaily: async (date?: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await waterApi.getDaily(date);
      set({ consumed: res.data.consumed, target: res.data.target, isLoading: false, error: null });
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load water data',
      });
    }
  },

  addWater: async (amountMl: number, date?: string) => {
    // Optimistic update — do NOT revert on failure; pull-to-refresh corrects state
    set((s) => ({ consumed: s.consumed + amountMl }));
    try {
      // Build loggedAt anchored to local noon for the given date so it lands on
      // the correct calendar day regardless of the device's UTC offset.
      // e.g. for "2026-06-25" in UTC+8: local noon = 2026-06-25T04:00:00.000Z ✓
      // (the previous 'T12:00:00.000Z' was UTC noon, wrong for large offsets).
      let loggedAt: string | undefined;
      if (date) {
        const [year, month, day] = date.split('-').map(Number);
        const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0);
        loggedAt = localNoon.toISOString();
      }
      await waterApi.add(amountMl, loggedAt);
    } catch (_e) {
      // Silently ignore — optimistic state stays; server will correct on next fetch
    }
  },

  removeCup: async (cupMl: number) => {
    // Optimistically decrement, but always attempt the server call — local state
    // may be stale (e.g. after an offline sync replay), so the server is authoritative.
    set((s) => ({ consumed: Math.max(0, s.consumed - cupMl) }));
    try {
      const res = await waterApi.deleteLast();
      if (res.data.deleted) {
        await get().fetchDaily();
      }
    } catch (_e) {
      // Silently keep optimistic state
    }
  },
}));
