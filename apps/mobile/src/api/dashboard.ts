import { api } from './client';
import { getDeviceTimezone } from '../utils/timezone';

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
  waterTarget: number;
}

export const dashboardApi = {
  getHistory: (days: number) => {
    const tz = encodeURIComponent(getDeviceTimezone());
    return api.get<{ data: NutritionHistoryData }>(`/dashboard/history?days=${days}&tz=${tz}`);
  },
};
