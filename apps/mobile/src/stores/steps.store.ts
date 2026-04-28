import { create } from 'zustand';
import { Pedometer } from 'expo-sensors';

export const STEPS_GOAL = 10_000;
/** Rough average: 0.04 kcal per step */
export const KCAL_PER_STEP = 0.04;

type PermissionStatus = 'undetermined' | 'granted' | 'denied';

interface StepsStore {
  steps: number;
  permissionStatus: PermissionStatus;
  isLoading: boolean;
  error: string | null;
  /** Seed permission status on mount — fetches steps if already granted */
  checkPermission: () => Promise<void>;
  /** Called when user enables step tracking */
  requestPermission: () => Promise<void>;
  /** Fetch today's step count via the device pedometer */
  fetchTodaySteps: () => Promise<void>;
}

export const useStepsStore = create<StepsStore>((set, get) => ({
  steps: 0,
  permissionStatus: 'undetermined',
  isLoading: false,
  error: null,

  checkPermission: async () => {
    const { status } = await Pedometer.getPermissionsAsync();
    set({ permissionStatus: status as PermissionStatus });
    if (status === 'granted') {
      await get().fetchTodaySteps();
    }
  },

  requestPermission: async () => {
    const { status } = await Pedometer.requestPermissionsAsync();
    set({ permissionStatus: status as PermissionStatus });
    if (status === 'granted') {
      await get().fetchTodaySteps();
    }
  },

  fetchTodaySteps: async () => {
    set({ isLoading: true, error: null });
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      const result = await Pedometer.getStepCountAsync(start, end);
      set({ steps: result.steps, isLoading: false });
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : 'Failed to fetch steps',
      });
    }
  },
}));
