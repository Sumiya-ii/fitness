import { create } from 'zustand';
import { api } from '../api';

export interface BodyMeasurementEntry {
  id: string;
  waistCm: number;
  neckCm: number;
  hipCm: number | null;
  weightKg: number;
  bodyFatPercent: number;
  fatMassKg: number;
  leanMassKg: number;
  bmi: number;
  bmiCategory: string;
  bodyFatCategory: string;
  loggedAt: string;
}

export interface WeeklyBudget {
  weekStart: string;
  weekEnd: string;
  dailyTarget: number;
  weeklyBudget: number;
  totalConsumed: number;
  remaining: number;
  days: {
    date: string;
    target: number;
    consumed: number;
    delta: number;
  }[];
  adjustedDailyTarget: number | null;
}

interface BodyCompositionState {
  latest: BodyMeasurementEntry | null;
  history: BodyMeasurementEntry[];
  weeklyBudget: WeeklyBudget | null;
  isLoading: boolean;
  error: string | null;
  fetchLatest: () => Promise<void>;
  fetchHistory: (days?: number) => Promise<void>;
  fetchWeeklyBudget: () => Promise<void>;
  logMeasurement: (data: {
    waistCm: number;
    neckCm: number;
    hipCm?: number;
    loggedAt?: string;
  }) => Promise<BodyMeasurementEntry>;
}

export const useBodyCompositionStore = create<BodyCompositionState>((set, get) => ({
  latest: null,
  history: [],
  weeklyBudget: null,
  isLoading: false,
  error: null,

  fetchLatest: async () => {
    try {
      const res = await api.get<{ data: BodyMeasurementEntry | null }>('/body-composition');
      set({ latest: res.data });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load body composition' });
    }
  },

  fetchHistory: async (days = 90) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<{ data: BodyMeasurementEntry[] }>(
        `/body-composition/history?days=${days}`,
      );
      set({ history: res.data, isLoading: false });
    } catch (e) {
      set({
        history: [],
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load history',
      });
    }
  },

  fetchWeeklyBudget: async () => {
    try {
      const res = await api.get<{ data: WeeklyBudget | null }>('/body-composition/weekly-budget');
      set({ weeklyBudget: res.data });
    } catch {
      // Non-critical — silently fail
    }
  },

  logMeasurement: async (data) => {
    const res = await api.post<{ data: BodyMeasurementEntry }>(
      '/body-composition/measurements',
      data,
    );
    set({ latest: res.data });
    get().fetchHistory();
    return res.data;
  },
}));
