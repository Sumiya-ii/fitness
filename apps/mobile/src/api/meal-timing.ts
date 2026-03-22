import { api } from './client';

export interface MealTimingStat {
  mealType: string;
  avgHour: number;
  count: number;
}

export interface MealTimingInsights {
  weekStart: string;
  weekEnd: string;
  mealStats: MealTimingStat[];
  breakfastWeekdayRate: number;
  breakfastWeekendRate: number;
  lateNightEatingDays: number;
  avgEatingWindowMinutes: number | null;
  highlights: string[];
}

export const mealTimingApi = {
  getInsights: (week?: string) =>
    api.get<{ data: MealTimingInsights }>(`/insights/meal-timing${week ? `?week=${week}` : ''}`),
};
