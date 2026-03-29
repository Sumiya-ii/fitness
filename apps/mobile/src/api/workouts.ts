import { api } from './client';
import { isNetworkError, offlineQueue } from '../services/offlineQueue';
import { useSyncStore } from '../stores/sync.store';
import { getDeviceTimezone } from '../utils/timezone';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkoutTypeInfo {
  key: string;
  met: number;
  category: string;
  label: { en: string; mn: string };
  icon: string;
}

export interface WorkoutLog {
  id: string;
  workoutType: string;
  durationMin: number | null;
  calorieBurned: number | null;
  note: string | null;
  label: { en: string; mn: string } | null;
  icon: string | null;
  loggedAt: string;
  createdAt: string;
}

export interface WorkoutEstimate {
  workoutType: string;
  durationMin: number;
  weightKg: number;
  calorieBurned: number;
  label: { en: string; mn: string } | null;
  icon: string | null;
}

export interface WorkoutSummary {
  weekStart: string;
  weekEnd: string;
  workoutCount: number;
  totalDurationMin: number;
  totalCaloriesBurned: number;
  activeDays: number;
  byType: Record<string, number>;
}

export interface CreateWorkoutPayload {
  workoutType: string;
  durationMin?: number;
  note?: string;
  loggedAt?: string;
}

export interface UpdateWorkoutPayload {
  workoutType?: string;
  durationMin?: number | null;
  note?: string | null;
  loggedAt?: string;
}

interface ListMeta {
  total: number;
  page: number;
  limit: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const workoutsApi = {
  /** Workout types grouped by category */
  getTypes: () => api.get<{ data: Record<string, WorkoutTypeInfo[]> }>('/workout-logs/types'),

  /** Flat list of all workout types (for search) */
  getTypesList: () => api.get<{ data: WorkoutTypeInfo[] }>('/workout-logs/types/list'),

  /** Calorie burn estimate preview */
  getEstimate: (workoutType: string, durationMin: number) =>
    api.get<{ data: WorkoutEstimate }>(
      `/workout-logs/estimate?workoutType=${encodeURIComponent(workoutType)}&durationMin=${durationMin}`,
    ),

  /** Last 5 distinct workout types the user logged */
  getRecents: () => api.get<{ data: WorkoutLog[] }>('/workout-logs/recents'),

  /** This week's workout summary */
  getSummary: () => api.get<{ data: WorkoutSummary }>('/workout-logs/summary'),

  /** Create a workout log */
  create: async (payload: CreateWorkoutPayload) => {
    try {
      return await api.post<{ data: WorkoutLog }>('/workout-logs', payload);
    } catch (e) {
      if (isNetworkError(e)) {
        offlineQueue.enqueue({ path: '/workout-logs', body: payload });
        useSyncStore.getState().refreshCount();
        return { data: null };
      }
      throw e;
    }
  },

  /** List workouts with filters */
  list: (params?: { date?: string; days?: number; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.date) qs.set('date', params.date);
    if (params?.days) qs.set('days', String(params.days));
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    qs.set('tz', getDeviceTimezone());
    return api.get<{ data: WorkoutLog[]; meta: ListMeta }>(`/workout-logs?${qs}`);
  },

  /** Get single workout */
  get: (id: string) => api.get<{ data: WorkoutLog }>(`/workout-logs/${id}`),

  /** Update workout */
  update: (id: string, payload: UpdateWorkoutPayload) =>
    api.patch<{ data: WorkoutLog }>(`/workout-logs/${id}`, payload),

  /** Delete workout */
  delete: (id: string) => api.delete<void>(`/workout-logs/${id}`),
};
