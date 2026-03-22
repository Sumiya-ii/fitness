import { api } from './client';

export interface StreakCalendarDay {
  date: string;
  logged: boolean;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  weekConsistency: number;
  monthConsistency: number;
  todayLogged: boolean;
  calendar: StreakCalendarDay[];
}

export const streaksApi = {
  get: () => api.get<{ data: StreakData }>('/streaks'),
};
