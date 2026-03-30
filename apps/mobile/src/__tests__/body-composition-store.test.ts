/**
 * Unit tests for useBodyCompositionStore.
 *
 * Covers: initial state, fetchLatest, fetchHistory, fetchWeeklyBudget, logMeasurement.
 */

const mockApiGet = jest.fn();
const mockApiPost = jest.fn();

jest.mock('../api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    setToken: jest.fn(),
    clearToken: jest.fn(),
    getToken: jest.fn(),
  },
}));

// Firebase is imported transitively — stub it to avoid side effects.
jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
}));

import {
  useBodyCompositionStore,
  type BodyMeasurementEntry,
  type WeeklyBudget,
} from '../stores/body-composition.store';

const MOCK_MEASUREMENT: BodyMeasurementEntry = {
  id: 'bm-1',
  waistCm: 85,
  neckCm: 38,
  hipCm: 100,
  weightKg: 82.5,
  bodyFatPercent: 22.5,
  fatMassKg: 18.6,
  leanMassKg: 63.9,
  bmi: 26.9,
  bmiCategory: 'overweight',
  bodyFatCategory: 'acceptable',
  loggedAt: '2026-03-28T08:00:00Z',
};

const MOCK_WEEKLY_BUDGET: WeeklyBudget = {
  weekStart: '2026-03-23',
  weekEnd: '2026-03-29',
  dailyTarget: 2100,
  weeklyBudget: 14700,
  totalConsumed: 8400,
  remaining: 6300,
  days: [
    { date: '2026-03-23', target: 2100, consumed: 1800, delta: -300 },
    { date: '2026-03-24', target: 2100, consumed: 2200, delta: 100 },
  ],
  adjustedDailyTarget: 2050,
};

function resetStore() {
  useBodyCompositionStore.setState({
    latest: null,
    history: [],
    weeklyBudget: null,
    isLoading: false,
    error: null,
  });
}

describe('useBodyCompositionStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has null latest, empty history, null weeklyBudget, not loading, no error', () => {
      const state = useBodyCompositionStore.getState();
      expect(state.latest).toBeNull();
      expect(state.history).toEqual([]);
      expect(state.weeklyBudget).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('exposes all action functions', () => {
      const state = useBodyCompositionStore.getState();
      expect(typeof state.fetchLatest).toBe('function');
      expect(typeof state.fetchHistory).toBe('function');
      expect(typeof state.fetchWeeklyBudget).toBe('function');
      expect(typeof state.logMeasurement).toBe('function');
    });
  });

  // ─── fetchLatest ──────────────────────────────────────────────────────────

  describe('fetchLatest', () => {
    it('stores the latest measurement from API', async () => {
      mockApiGet.mockResolvedValue({ data: MOCK_MEASUREMENT });

      await useBodyCompositionStore.getState().fetchLatest();

      expect(useBodyCompositionStore.getState().latest).toEqual(MOCK_MEASUREMENT);
    });

    it('stores null when API returns null (no measurements yet)', async () => {
      mockApiGet.mockResolvedValue({ data: null });

      await useBodyCompositionStore.getState().fetchLatest();

      expect(useBodyCompositionStore.getState().latest).toBeNull();
    });

    it('calls the correct endpoint', async () => {
      mockApiGet.mockResolvedValue({ data: null });

      await useBodyCompositionStore.getState().fetchLatest();

      expect(mockApiGet).toHaveBeenCalledWith('/body-composition');
    });

    it('sets error when API fails', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));

      await useBodyCompositionStore.getState().fetchLatest();

      expect(useBodyCompositionStore.getState().error).toBe('Server error');
    });

    it('uses generic error message for non-Error rejections', async () => {
      mockApiGet.mockRejectedValue('unexpected');

      await useBodyCompositionStore.getState().fetchLatest();

      expect(useBodyCompositionStore.getState().error).toBe('Failed to load body composition');
    });
  });

  // ─── fetchHistory ─────────────────────────────────────────────────────────

  describe('fetchHistory', () => {
    it('stores measurement history from API', async () => {
      mockApiGet.mockResolvedValue({ data: [MOCK_MEASUREMENT] });

      await useBodyCompositionStore.getState().fetchHistory();

      const state = useBodyCompositionStore.getState();
      expect(state.history).toEqual([MOCK_MEASUREMENT]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('calls API with default 90-day window', async () => {
      mockApiGet.mockResolvedValue({ data: [] });

      await useBodyCompositionStore.getState().fetchHistory();

      expect(mockApiGet).toHaveBeenCalledWith('/body-composition/history?days=90');
    });

    it('passes custom days parameter to the API', async () => {
      mockApiGet.mockResolvedValue({ data: [] });

      await useBodyCompositionStore.getState().fetchHistory(30);

      expect(mockApiGet).toHaveBeenCalledWith('/body-composition/history?days=30');
    });

    it('sets isLoading to true while fetching and false after', async () => {
      let resolve!: (v: any) => void;
      mockApiGet.mockReturnValue(new Promise((r) => (resolve = r)));

      const fetchPromise = useBodyCompositionStore.getState().fetchHistory();
      expect(useBodyCompositionStore.getState().isLoading).toBe(true);

      resolve({ data: [] });
      await fetchPromise;

      expect(useBodyCompositionStore.getState().isLoading).toBe(false);
    });

    it('clears history and sets error on failure', async () => {
      useBodyCompositionStore.setState({ history: [MOCK_MEASUREMENT] });
      mockApiGet.mockRejectedValue(new Error('Network error'));

      await useBodyCompositionStore.getState().fetchHistory();

      const state = useBodyCompositionStore.getState();
      expect(state.history).toEqual([]);
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('uses generic error message for non-Error rejections', async () => {
      mockApiGet.mockRejectedValue('unexpected');

      await useBodyCompositionStore.getState().fetchHistory();

      expect(useBodyCompositionStore.getState().error).toBe('Failed to load history');
    });
  });

  // ─── fetchWeeklyBudget ────────────────────────────────────────────────────

  describe('fetchWeeklyBudget', () => {
    it('stores weekly budget from API', async () => {
      mockApiGet.mockResolvedValue({ data: MOCK_WEEKLY_BUDGET });

      await useBodyCompositionStore.getState().fetchWeeklyBudget();

      expect(useBodyCompositionStore.getState().weeklyBudget).toEqual(MOCK_WEEKLY_BUDGET);
    });

    it('stores null when API returns null', async () => {
      mockApiGet.mockResolvedValue({ data: null });

      await useBodyCompositionStore.getState().fetchWeeklyBudget();

      expect(useBodyCompositionStore.getState().weeklyBudget).toBeNull();
    });

    it('calls the correct endpoint', async () => {
      mockApiGet.mockResolvedValue({ data: null });

      await useBodyCompositionStore.getState().fetchWeeklyBudget();

      expect(mockApiGet).toHaveBeenCalledWith('/body-composition/weekly-budget');
    });

    it('silently ignores errors — does not set error state', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));

      await useBodyCompositionStore.getState().fetchWeeklyBudget();

      // fetchWeeklyBudget is non-critical and silently swallows errors
      expect(useBodyCompositionStore.getState().error).toBeNull();
      expect(useBodyCompositionStore.getState().weeklyBudget).toBeNull();
    });
  });

  // ─── logMeasurement ───────────────────────────────────────────────────────

  describe('logMeasurement', () => {
    it('posts measurement to API and updates latest', async () => {
      mockApiPost.mockResolvedValue({ data: MOCK_MEASUREMENT });
      // fetchHistory is called internally after logging
      mockApiGet.mockResolvedValue({ data: [MOCK_MEASUREMENT] });

      const result = await useBodyCompositionStore.getState().logMeasurement({
        waistCm: 85,
        neckCm: 38,
        hipCm: 100,
      });

      expect(result).toEqual(MOCK_MEASUREMENT);
      expect(useBodyCompositionStore.getState().latest).toEqual(MOCK_MEASUREMENT);
    });

    it('calls the correct endpoint with provided data', async () => {
      mockApiPost.mockResolvedValue({ data: MOCK_MEASUREMENT });
      mockApiGet.mockResolvedValue({ data: [] });

      const measurementData = { waistCm: 85, neckCm: 38 };
      await useBodyCompositionStore.getState().logMeasurement(measurementData);

      expect(mockApiPost).toHaveBeenCalledWith('/body-composition/measurements', measurementData);
    });

    it('includes optional hipCm when provided', async () => {
      mockApiPost.mockResolvedValue({ data: MOCK_MEASUREMENT });
      mockApiGet.mockResolvedValue({ data: [] });

      await useBodyCompositionStore.getState().logMeasurement({
        waistCm: 85,
        neckCm: 38,
        hipCm: 100,
      });

      expect(mockApiPost).toHaveBeenCalledWith('/body-composition/measurements', {
        waistCm: 85,
        neckCm: 38,
        hipCm: 100,
      });
    });

    it('triggers fetchHistory after logging', async () => {
      mockApiPost.mockResolvedValue({ data: MOCK_MEASUREMENT });
      mockApiGet.mockResolvedValue({ data: [] });

      await useBodyCompositionStore.getState().logMeasurement({ waistCm: 85, neckCm: 38 });

      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/body-composition/history'));
    });

    it('propagates errors from API', async () => {
      mockApiPost.mockRejectedValue(new Error('API error 422: Validation failed'));

      await expect(
        useBodyCompositionStore.getState().logMeasurement({ waistCm: 85, neckCm: 38 }),
      ).rejects.toThrow('API error 422: Validation failed');
    });

    it('handles measurement without optional fields', async () => {
      const measurementWithoutHip: BodyMeasurementEntry = { ...MOCK_MEASUREMENT, hipCm: null };
      mockApiPost.mockResolvedValue({ data: measurementWithoutHip });
      mockApiGet.mockResolvedValue({ data: [] });

      const result = await useBodyCompositionStore.getState().logMeasurement({
        waistCm: 85,
        neckCm: 38,
      });

      expect(result.hipCm).toBeNull();
    });
  });
});
