import { create } from 'zustand';
import { toLocalDateKey } from '@coach/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { getDeviceTimezone } from '../utils/timezone';

const DASHBOARD_CACHE_KEY = 'dashboard_last';

async function cacheDashboard(data: DashboardData): Promise<void> {
  await AsyncStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data));
}

export interface DashboardMealItem {
  id: string;
  snapshotFoodName: string;
  snapshotCalories: number;
  snapshotProtein: number;
  snapshotCarbs: number;
  snapshotFat: number;
  snapshotFiber: number | null;
  snapshotSugar: number | null;
  snapshotSodium: number | null;
  snapshotSaturatedFat: number | null;
}

export interface DashboardMeal {
  id: string;
  mealType: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number | null;
  totalSugar: number | null;
  totalSodium: number | null;
  totalSaturatedFat: number | null;
  loggedAt: string;
  items: DashboardMealItem[];
}

export interface DashboardData {
  date: string;
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number | null;
    sugar: number | null;
    sodium: number | null;
    saturatedFat: number | null;
  };
  targets: { calories: number; protein: number; carbs: number; fat: number } | null;
  remaining: { calories: number; protein: number; carbs: number; fat: number } | null;
  proteinProgress: { current: number; target: number; percentage: number } | null;
  mealCount: number;
  meals: DashboardMeal[];
  waterConsumed: number;
  waterTarget: number;
}

interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  fetchDashboard: (date?: string) => Promise<void>;
  loadCachedDashboard: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchDashboard: async (date?: string) => {
    const dateStr = date ?? toLocalDateKey(new Date());
    const tz = getDeviceTimezone();
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<{ data: DashboardData }>(
        `/dashboard?date=${dateStr}&tz=${encodeURIComponent(tz)}`,
      );
      set({ data: res.data, isLoading: false, error: null });
      // Cache successful response for resilience across restarts
      cacheDashboard(res.data).catch(() => undefined);
    } catch (e) {
      // Keep previous data on error (stale-while-revalidate)
      const prev = get().data;
      set({
        data: prev,
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load dashboard',
      });
    }
  },

  loadCachedDashboard: async () => {
    try {
      const cached = await AsyncStorage.getItem(DASHBOARD_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as DashboardData;
        const current = get().data;
        if (!current) {
          set({ data: parsed });
        }
      }
    } catch {
      // Cache miss is fine
    }
  },
}));
