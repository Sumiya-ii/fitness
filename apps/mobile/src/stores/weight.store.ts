import { create } from 'zustand';
import { api } from '../api';

export interface WeightLogEntry {
  id: string;
  weightKg: number;
  loggedAt: string;
}

export interface WeightTrend {
  current: number;
  weeklyAverage: number;
  previousWeekAverage: number | null;
  weeklyDelta: number | null;
  dataPoints: number;
}

interface WeightState {
  history: WeightLogEntry[];
  trend: WeightTrend | null;
  isLoading: boolean;
  error: string | null;
  fetchHistory: (days?: number) => Promise<void>;
  fetchTrend: () => Promise<void>;
  logWeight: (weightKg: number, loggedAt?: string) => Promise<WeightLogEntry>;
}

export const useWeightStore = create<WeightState>((set, get) => ({
  history: [],
  trend: null,
  isLoading: false,
  error: null,

  fetchHistory: async (days = 90) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<{ data: WeightLogEntry[] }>(`/weight-logs?days=${days}`);
      set({ history: res.data, isLoading: false, error: null });
    } catch (e) {
      set({
        history: [],
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load weight history',
      });
    }
  },

  fetchTrend: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<{ data: WeightTrend | null }>('/weight-logs/trend');
      set({ trend: res.data, isLoading: false, error: null });
    } catch (e) {
      set({
        trend: null,
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load weight trend',
      });
    }
  },

  logWeight: async (weightKg: number, loggedAt?: string) => {
    const body = loggedAt ? { weightKg, loggedAt } : { weightKg };
    const res = await api.post<{ data: WeightLogEntry }>('/weight-logs', body);
    await Promise.all([get().fetchHistory(), get().fetchTrend()]);
    return res.data;
  },
}));
