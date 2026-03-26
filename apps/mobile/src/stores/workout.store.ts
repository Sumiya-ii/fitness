import { create } from 'zustand';
import {
  workoutsApi,
  type WorkoutLog,
  type WorkoutTypeInfo,
  type WorkoutSummary,
  type WorkoutEstimate,
} from '../api/workouts';

// ─── State ───────────────────────────────────────────────────────────────────

interface WorkoutState {
  // Workout type catalog
  catalog: Record<string, WorkoutTypeInfo[]>;
  catalogFlat: WorkoutTypeInfo[];
  catalogLoading: boolean;

  // Weekly summary
  summary: WorkoutSummary | null;
  summaryLoading: boolean;

  // Recent workout types
  recents: WorkoutLog[];
  recentsLoading: boolean;

  // Workout history (paginated)
  history: WorkoutLog[];
  historyMeta: { total: number; page: number; limit: number } | null;
  historyLoading: boolean;

  // Single workout detail
  detail: WorkoutLog | null;
  detailLoading: boolean;

  // Calorie estimate
  estimate: WorkoutEstimate | null;
  estimateLoading: boolean;

  // Active workout timer
  activeWorkoutType: string | null;
  activeStartTime: number | null;

  // Saving state
  saving: boolean;

  // Error
  error: string | null;

  // Actions
  fetchCatalog: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  fetchRecents: () => Promise<void>;
  fetchHistory: (params?: { days?: number; page?: number }) => Promise<void>;
  fetchDetail: (id: string) => Promise<void>;
  fetchEstimate: (workoutType: string, durationMin: number) => Promise<void>;
  createWorkout: (payload: {
    workoutType: string;
    durationMin?: number;
    note?: string;
    loggedAt?: string;
  }) => Promise<WorkoutLog | null>;
  updateWorkout: (
    id: string,
    payload: { workoutType?: string; durationMin?: number | null; note?: string | null },
  ) => Promise<boolean>;
  deleteWorkout: (id: string) => Promise<boolean>;
  startTimer: (workoutType: string) => void;
  stopTimer: () => { elapsedMin: number } | null;
  clearError: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  catalog: {},
  catalogFlat: [],
  catalogLoading: false,

  summary: null,
  summaryLoading: false,

  recents: [],
  recentsLoading: false,

  history: [],
  historyMeta: null,
  historyLoading: false,

  detail: null,
  detailLoading: false,

  estimate: null,
  estimateLoading: false,

  activeWorkoutType: null,
  activeStartTime: null,

  saving: false,
  error: null,

  fetchCatalog: async () => {
    if (Object.keys(get().catalog).length > 0) return; // cached
    set({ catalogLoading: true });
    try {
      const [grouped, flat] = await Promise.all([
        workoutsApi.getTypes(),
        workoutsApi.getTypesList(),
      ]);
      set({ catalog: grouped.data, catalogFlat: flat.data, catalogLoading: false });
    } catch (e) {
      set({
        catalogLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load workout types',
      });
    }
  },

  fetchSummary: async () => {
    set({ summaryLoading: true });
    try {
      const res = await workoutsApi.getSummary();
      set({ summary: res.data, summaryLoading: false });
    } catch (e) {
      set({
        summaryLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load summary',
      });
    }
  },

  fetchRecents: async () => {
    set({ recentsLoading: true });
    try {
      const res = await workoutsApi.getRecents();
      set({ recents: res.data, recentsLoading: false });
    } catch (e) {
      set({
        recentsLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load recents',
      });
    }
  },

  fetchHistory: async (params) => {
    set({ historyLoading: true });
    try {
      const res = await workoutsApi.list({
        days: params?.days ?? 30,
        page: params?.page ?? 1,
        limit: 20,
      });
      const page = params?.page ?? 1;
      set({
        history: page === 1 ? res.data : [...get().history, ...res.data],
        historyMeta: res.meta,
        historyLoading: false,
      });
    } catch (e) {
      set({
        historyLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load history',
      });
    }
  },

  fetchDetail: async (id: string) => {
    set({ detailLoading: true });
    try {
      const res = await workoutsApi.get(id);
      set({ detail: res.data, detailLoading: false });
    } catch (e) {
      set({
        detailLoading: false,
        error: e instanceof Error ? e.message : 'Failed to load workout',
      });
    }
  },

  fetchEstimate: async (workoutType: string, durationMin: number) => {
    set({ estimateLoading: true });
    try {
      const res = await workoutsApi.getEstimate(workoutType, durationMin);
      set({ estimate: res.data, estimateLoading: false });
    } catch (e) {
      set({ estimateLoading: false });
    }
  },

  createWorkout: async (payload) => {
    set({ saving: true, error: null });
    try {
      const res = await workoutsApi.create(payload);
      set({ saving: false });
      // Refresh summary + recents
      get().fetchSummary();
      get().fetchRecents();
      return res.data;
    } catch (e) {
      set({
        saving: false,
        error: e instanceof Error ? e.message : 'Failed to save workout',
      });
      return null;
    }
  },

  updateWorkout: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      const res = await workoutsApi.update(id, payload);
      set({ saving: false, detail: res.data });
      get().fetchSummary();
      return true;
    } catch (e) {
      set({
        saving: false,
        error: e instanceof Error ? e.message : 'Failed to update workout',
      });
      return false;
    }
  },

  deleteWorkout: async (id) => {
    set({ saving: true, error: null });
    try {
      await workoutsApi.delete(id);
      set((s) => ({
        saving: false,
        history: s.history.filter((w) => w.id !== id),
        detail: s.detail?.id === id ? null : s.detail,
      }));
      get().fetchSummary();
      return true;
    } catch (e) {
      set({
        saving: false,
        error: e instanceof Error ? e.message : 'Failed to delete workout',
      });
      return false;
    }
  },

  startTimer: (workoutType: string) => {
    set({ activeWorkoutType: workoutType, activeStartTime: Date.now() });
  },

  stopTimer: () => {
    const { activeStartTime } = get();
    if (!activeStartTime) return null;
    const elapsedMin = Math.round((Date.now() - activeStartTime) / 60000);
    set({ activeWorkoutType: null, activeStartTime: null });
    return { elapsedMin: Math.max(elapsedMin, 1) };
  },

  clearError: () => set({ error: null }),
}));
