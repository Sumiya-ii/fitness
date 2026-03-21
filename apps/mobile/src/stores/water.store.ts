import { create } from 'zustand';
import { waterApi } from '../api/water';

interface WaterState {
  consumed: number;
  target: number;
  isLoading: boolean;
  error: string | null;
  addWater: (amountMl: number, date?: string) => Promise<void>;
  undoLast: () => Promise<void>;
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
      const loggedAt = date ? new Date(date + 'T12:00:00.000Z').toISOString() : undefined;
      await waterApi.add(amountMl, loggedAt);
    } catch (_e) {
      // Silently ignore — optimistic state stays; server will correct on next fetch
    }
  },

  undoLast: async () => {
    try {
      const res = await waterApi.deleteLast();
      if (res.data.deleted) {
        await get().fetchDaily();
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to undo' });
    }
  },
}));
