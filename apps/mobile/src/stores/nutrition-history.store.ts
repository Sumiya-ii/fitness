import { create } from 'zustand';
import { dashboardApi, type NutritionHistoryData } from '../api/dashboard';

export type HistoryPeriod = 7 | 30 | 90;

interface NutritionHistoryState {
  data: Partial<Record<HistoryPeriod, NutritionHistoryData>>;
  isLoading: boolean;
  error: string | null;
  fetchHistory: (days: HistoryPeriod) => Promise<void>;
}

export const useNutritionHistoryStore = create<NutritionHistoryState>((set) => ({
  data: {},
  isLoading: false,
  error: null,

  fetchHistory: async (days: HistoryPeriod) => {
    set({ isLoading: true, error: null });
    try {
      const res = await dashboardApi.getHistory(days);
      set((s) => ({
        data: { ...s.data, [days]: res.data },
        isLoading: false,
      }));
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load nutrition history',
      });
    }
  },
}));
