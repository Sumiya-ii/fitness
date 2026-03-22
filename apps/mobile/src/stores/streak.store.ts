import { create } from 'zustand';
import { streaksApi, type StreakData } from '../api/streaks';

interface StreakState {
  data: StreakData | null;
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
}

export const useStreakStore = create<StreakState>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await streaksApi.get();
      set({ data: res.data, isLoading: false });
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load streak data',
      });
    }
  },
}));
