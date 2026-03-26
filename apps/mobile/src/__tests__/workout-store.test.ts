/**
 * Unit tests for workout store.
 */

jest.mock('../api/workouts', () => ({
  workoutsApi: {
    getTypes: jest.fn(),
    getTypesList: jest.fn(),
    getEstimate: jest.fn(),
    getRecents: jest.fn(),
    getSummary: jest.fn(),
    create: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

import { workoutsApi } from '../api/workouts';
import { useWorkoutStore } from '../stores/workout.store';

const mockApi = workoutsApi as jest.Mocked<typeof workoutsApi>;

const MOCK_WORKOUT = {
  id: 'w-1',
  workoutType: 'running',
  durationMin: 30,
  calorieBurned: 343,
  note: 'Morning jog',
  label: { en: 'Running', mn: 'Гүйлт' },
  icon: '🏃',
  loggedAt: '2026-03-26T08:00:00Z',
  createdAt: '2026-03-26T08:00:00Z',
};

const MOCK_SUMMARY = {
  weekStart: '2026-03-23',
  weekEnd: '2026-03-29',
  workoutCount: 3,
  totalDurationMin: 90,
  totalCaloriesBurned: 900,
  activeDays: 3,
  byType: { running: 2, yoga: 1 },
};

const MOCK_CATALOG_GROUPED = {
  cardio: [
    {
      key: 'running',
      met: 9.8,
      category: 'cardio',
      label: { en: 'Running', mn: 'Гүйлт' },
      icon: '🏃',
    },
  ],
  strength: [
    {
      key: 'weight_training',
      met: 3.5,
      category: 'strength',
      label: { en: 'Weight Training', mn: 'Хүндийн дасгал' },
      icon: '🏋️',
    },
  ],
};

const MOCK_CATALOG_FLAT = [...MOCK_CATALOG_GROUPED.cardio, ...MOCK_CATALOG_GROUPED.strength];

function resetStore() {
  useWorkoutStore.setState({
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
  });
}

describe('workout store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  describe('fetchCatalog', () => {
    it('loads and caches workout type catalog', async () => {
      mockApi.getTypes.mockResolvedValue({ data: MOCK_CATALOG_GROUPED });
      mockApi.getTypesList.mockResolvedValue({ data: MOCK_CATALOG_FLAT });

      await useWorkoutStore.getState().fetchCatalog();

      const state = useWorkoutStore.getState();
      expect(state.catalog).toEqual(MOCK_CATALOG_GROUPED);
      expect(state.catalogFlat).toEqual(MOCK_CATALOG_FLAT);
      expect(state.catalogLoading).toBe(false);
    });

    it('skips fetch if catalog already loaded', async () => {
      useWorkoutStore.setState({ catalog: MOCK_CATALOG_GROUPED });

      await useWorkoutStore.getState().fetchCatalog();

      expect(mockApi.getTypes).not.toHaveBeenCalled();
    });
  });

  describe('fetchSummary', () => {
    it('loads weekly summary', async () => {
      mockApi.getSummary.mockResolvedValue({ data: MOCK_SUMMARY });

      await useWorkoutStore.getState().fetchSummary();

      const state = useWorkoutStore.getState();
      expect(state.summary).toEqual(MOCK_SUMMARY);
      expect(state.summaryLoading).toBe(false);
    });

    it('sets error on failure', async () => {
      mockApi.getSummary.mockRejectedValue(new Error('Network error'));

      await useWorkoutStore.getState().fetchSummary();

      expect(useWorkoutStore.getState().error).toBe('Network error');
    });
  });

  describe('fetchRecents', () => {
    it('loads recent workouts', async () => {
      mockApi.getRecents.mockResolvedValue({ data: [MOCK_WORKOUT] });

      await useWorkoutStore.getState().fetchRecents();

      expect(useWorkoutStore.getState().recents).toEqual([MOCK_WORKOUT]);
    });
  });

  describe('fetchHistory', () => {
    it('loads workout history with default params', async () => {
      mockApi.list.mockResolvedValue({
        data: [MOCK_WORKOUT],
        meta: { total: 1, page: 1, limit: 20 },
      });

      await useWorkoutStore.getState().fetchHistory();

      const state = useWorkoutStore.getState();
      expect(state.history).toEqual([MOCK_WORKOUT]);
      expect(state.historyMeta).toEqual({ total: 1, page: 1, limit: 20 });
      expect(mockApi.list).toHaveBeenCalledWith({ days: 30, page: 1, limit: 20 });
    });

    it('appends on page > 1', async () => {
      useWorkoutStore.setState({ history: [MOCK_WORKOUT] });
      const workout2 = { ...MOCK_WORKOUT, id: 'w-2' };
      mockApi.list.mockResolvedValue({
        data: [workout2],
        meta: { total: 2, page: 2, limit: 20 },
      });

      await useWorkoutStore.getState().fetchHistory({ page: 2 });

      expect(useWorkoutStore.getState().history).toEqual([MOCK_WORKOUT, workout2]);
    });
  });

  describe('createWorkout', () => {
    it('creates workout and refreshes summary/recents', async () => {
      mockApi.create.mockResolvedValue({ data: MOCK_WORKOUT });
      mockApi.getSummary.mockResolvedValue({ data: MOCK_SUMMARY });
      mockApi.getRecents.mockResolvedValue({ data: [MOCK_WORKOUT] });

      const result = await useWorkoutStore.getState().createWorkout({
        workoutType: 'running',
        durationMin: 30,
      });

      expect(result).toEqual(MOCK_WORKOUT);
      expect(useWorkoutStore.getState().saving).toBe(false);
      expect(mockApi.create).toHaveBeenCalledWith({
        workoutType: 'running',
        durationMin: 30,
      });
    });

    it('sets error on failure', async () => {
      mockApi.create.mockRejectedValue(new Error('Server error'));

      const result = await useWorkoutStore.getState().createWorkout({
        workoutType: 'running',
      });

      expect(result).toBeNull();
      expect(useWorkoutStore.getState().error).toBe('Server error');
    });
  });

  describe('updateWorkout', () => {
    it('updates workout and sets detail', async () => {
      const updated = { ...MOCK_WORKOUT, durationMin: 45 };
      mockApi.update.mockResolvedValue({ data: updated });
      mockApi.getSummary.mockResolvedValue({ data: MOCK_SUMMARY });

      const success = await useWorkoutStore.getState().updateWorkout('w-1', { durationMin: 45 });

      expect(success).toBe(true);
      expect(useWorkoutStore.getState().detail).toEqual(updated);
    });
  });

  describe('deleteWorkout', () => {
    it('deletes workout and removes from history', async () => {
      useWorkoutStore.setState({ history: [MOCK_WORKOUT], detail: MOCK_WORKOUT });
      mockApi.delete.mockResolvedValue(undefined as any);
      mockApi.getSummary.mockResolvedValue({ data: MOCK_SUMMARY });

      const success = await useWorkoutStore.getState().deleteWorkout('w-1');

      expect(success).toBe(true);
      expect(useWorkoutStore.getState().history).toEqual([]);
      expect(useWorkoutStore.getState().detail).toBeNull();
    });
  });

  describe('timer', () => {
    it('starts and stops timer', () => {
      const store = useWorkoutStore.getState();
      store.startTimer('running');

      let state = useWorkoutStore.getState();
      expect(state.activeWorkoutType).toBe('running');
      expect(state.activeStartTime).toBeDefined();

      // Simulate some time passing
      const elapsed = useWorkoutStore.getState().stopTimer();
      expect(elapsed).toBeDefined();
      expect(elapsed!.elapsedMin).toBeGreaterThanOrEqual(0);

      state = useWorkoutStore.getState();
      expect(state.activeWorkoutType).toBeNull();
      expect(state.activeStartTime).toBeNull();
    });

    it('returns minimum 1 minute', () => {
      useWorkoutStore.getState().startTimer('yoga');
      const elapsed = useWorkoutStore.getState().stopTimer();
      expect(elapsed!.elapsedMin).toBeGreaterThanOrEqual(1);
    });

    it('returns null if no timer active', () => {
      const result = useWorkoutStore.getState().stopTimer();
      expect(result).toBeNull();
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useWorkoutStore.setState({ error: 'some error' });
      useWorkoutStore.getState().clearError();
      expect(useWorkoutStore.getState().error).toBeNull();
    });
  });
});
