import { api } from './client';

export interface DayHistory {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  waterMl: number;
}

export interface NutritionTarget {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionHistoryData {
  history: DayHistory[];
  target: NutritionTarget | null;
}

export const dashboardApi = {
  getHistory: (days: number) =>
    api.get<{ data: NutritionHistoryData }>(`/dashboard/history?days=${days}`),
};
