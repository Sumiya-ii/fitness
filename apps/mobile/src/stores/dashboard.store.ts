import { create } from 'zustand';
import { api } from '../api';

export interface DashboardMealItem {
  id: string;
  snapshotFoodName: string;
  snapshotCalories: number;
}

export interface DashboardMeal {
  id: string;
  mealType: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  loggedAt: string;
  items: DashboardMealItem[];
}

export interface DashboardData {
  date: string;
  consumed: { calories: number; protein: number; carbs: number; fat: number };
  targets: { calories: number; protein: number; carbs: number; fat: number } | null;
  remaining: { calories: number; protein: number; carbs: number; fat: number } | null;
  proteinProgress: { current: number; target: number; percentage: number } | null;
  mealCount: number;
  meals: DashboardMeal[];
}

interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  fetchDashboard: (date?: string) => Promise<void>;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchDashboard: async (date?: string) => {
    const dateStr = date ?? formatDate(new Date());
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<{ data: DashboardData }>(`/dashboard?date=${dateStr}`);
      set({ data: res.data, isLoading: false, error: null });
    } catch (e) {
      set({
        data: null,
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load dashboard',
      });
    }
  },
}));
