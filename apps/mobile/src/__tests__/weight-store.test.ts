/**
 * Unit tests for useWeightStore.
 *
 * Covers: initial state, fetchHistory, fetchTrend, logWeight (online + offline paths).
 * offlineQueue and useSyncStore are mocked to isolate the store under test.
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

const mockEnqueue = jest.fn();
const mockIsNetworkError = jest.fn();

jest.mock('../services/offlineQueue', () => ({
  offlineQueue: {
    enqueue: (...args: unknown[]) => mockEnqueue(...args),
    count: jest.fn(() => 0),
    getAll: jest.fn(() => []),
    dequeue: jest.fn(),
    clear: jest.fn(),
  },
  isNetworkError: (...args: unknown[]) => mockIsNetworkError(...args),
}));

const mockRefreshCount = jest.fn();
jest.mock(
  './sync.store',
  () => ({
    useSyncStore: {
      getState: () => ({ refreshCount: mockRefreshCount }),
    },
  }),
  { virtual: true },
);

// The real sync.store import path used in weight.store.ts
jest.mock('../stores/sync.store', () => ({
  useSyncStore: {
    getState: () => ({ refreshCount: mockRefreshCount }),
  },
}));

// Firebase is imported transitively — stub it to avoid side effects.
jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
}));

import { useWeightStore, type WeightLogEntry, type WeightTrend } from '../stores/weight.store';

const MOCK_ENTRY: WeightLogEntry = {
  id: 'wl-1',
  weightKg: 82.5,
  loggedAt: '2026-03-28T08:00:00Z',
};

const MOCK_TREND: WeightTrend = {
  current: 82.5,
  weeklyAverage: 83.0,
  previousWeekAverage: 84.0,
  weeklyDelta: -1.0,
  dataPoints: 7,
};

function resetStore() {
  useWeightStore.setState({
    history: [],
    trend: null,
    isLoading: false,
    error: null,
  });
}

describe('useWeightStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockIsNetworkError.mockReturnValue(false);
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has empty history, null trend, not loading, no error', () => {
      const state = useWeightStore.getState();
      expect(state.history).toEqual([]);
      expect(state.trend).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('exposes all action functions', () => {
      const state = useWeightStore.getState();
      expect(typeof state.fetchHistory).toBe('function');
      expect(typeof state.fetchTrend).toBe('function');
      expect(typeof state.logWeight).toBe('function');
    });
  });

  // ─── fetchHistory ─────────────────────────────────────────────────────────

  describe('fetchHistory', () => {
    it('loads weight history and stores it', async () => {
      mockApiGet.mockResolvedValue({ data: [MOCK_ENTRY] });

      await useWeightStore.getState().fetchHistory();

      const state = useWeightStore.getState();
      expect(state.history).toEqual([MOCK_ENTRY]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('calls API with default 90-day window', async () => {
      mockApiGet.mockResolvedValue({ data: [] });

      await useWeightStore.getState().fetchHistory();

      expect(mockApiGet).toHaveBeenCalledWith('/weight-logs?days=90');
    });

    it('passes custom days parameter to the API', async () => {
      mockApiGet.mockResolvedValue({ data: [] });

      await useWeightStore.getState().fetchHistory(30);

      expect(mockApiGet).toHaveBeenCalledWith('/weight-logs?days=30');
    });

    it('sets isLoading to true while fetching', async () => {
      let resolve!: (v: any) => void;
      mockApiGet.mockReturnValue(new Promise((r) => (resolve = r)));

      const fetchPromise = useWeightStore.getState().fetchHistory();
      expect(useWeightStore.getState().isLoading).toBe(true);

      resolve({ data: [] });
      await fetchPromise;
      expect(useWeightStore.getState().isLoading).toBe(false);
    });

    it('clears history and sets error on API failure', async () => {
      useWeightStore.setState({ history: [MOCK_ENTRY] });
      mockApiGet.mockRejectedValue(new Error('Network error'));

      await useWeightStore.getState().fetchHistory();

      const state = useWeightStore.getState();
      expect(state.history).toEqual([]);
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('uses generic error message for non-Error rejections', async () => {
      mockApiGet.mockRejectedValue('unexpected');

      await useWeightStore.getState().fetchHistory();

      expect(useWeightStore.getState().error).toBe('Failed to load weight history');
    });
  });

  // ─── fetchTrend ───────────────────────────────────────────────────────────

  describe('fetchTrend', () => {
    it('loads trend data and stores it', async () => {
      mockApiGet.mockResolvedValue({ data: MOCK_TREND });

      await useWeightStore.getState().fetchTrend();

      const state = useWeightStore.getState();
      expect(state.trend).toEqual(MOCK_TREND);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('stores null trend when API returns null', async () => {
      mockApiGet.mockResolvedValue({ data: null });

      await useWeightStore.getState().fetchTrend();

      expect(useWeightStore.getState().trend).toBeNull();
    });

    it('calls the correct trend endpoint', async () => {
      mockApiGet.mockResolvedValue({ data: null });

      await useWeightStore.getState().fetchTrend();

      expect(mockApiGet).toHaveBeenCalledWith('/weight-logs/trend');
    });

    it('sets error on API failure', async () => {
      mockApiGet.mockRejectedValue(new Error('Server error'));

      await useWeightStore.getState().fetchTrend();

      const state = useWeightStore.getState();
      expect(state.trend).toBeNull();
      expect(state.error).toBe('Server error');
      expect(state.isLoading).toBe(false);
    });

    it('uses generic error message for non-Error rejections', async () => {
      mockApiGet.mockRejectedValue('unexpected');

      await useWeightStore.getState().fetchTrend();

      expect(useWeightStore.getState().error).toBe('Failed to load weight trend');
    });
  });

  // ─── logWeight ────────────────────────────────────────────────────────────

  describe('logWeight', () => {
    it('posts to API and refreshes history and trend', async () => {
      mockApiPost.mockResolvedValue({ data: MOCK_ENTRY });
      mockApiGet.mockResolvedValue({ data: [] });

      const result = await useWeightStore.getState().logWeight(82.5);

      expect(result).toEqual(MOCK_ENTRY);
      expect(mockApiPost).toHaveBeenCalledWith('/weight-logs', { weightKg: 82.5 });
      // fetchHistory and fetchTrend should both be called
      expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('/weight-logs?days='));
      expect(mockApiGet).toHaveBeenCalledWith('/weight-logs/trend');
    });

    it('includes loggedAt in POST body when provided', async () => {
      mockApiPost.mockResolvedValue({ data: MOCK_ENTRY });
      mockApiGet.mockResolvedValue({ data: [] });

      await useWeightStore.getState().logWeight(82.5, '2026-03-28T08:00:00Z');

      expect(mockApiPost).toHaveBeenCalledWith('/weight-logs', {
        weightKg: 82.5,
        loggedAt: '2026-03-28T08:00:00Z',
      });
    });

    it('enqueues offline request and returns synthetic entry when network error occurs', async () => {
      const networkError = new TypeError('Network request failed');
      mockApiPost.mockRejectedValue(networkError);
      mockIsNetworkError.mockReturnValue(true);

      const result = await useWeightStore.getState().logWeight(82.5);

      expect(mockEnqueue).toHaveBeenCalledWith({
        path: '/weight-logs',
        body: { weightKg: 82.5 },
      });
      expect(result.id).toMatch(/^__offline_/);
      expect(result.weightKg).toBe(82.5);
    });

    it('calls useSyncStore.refreshCount after offline enqueue', async () => {
      const networkError = new TypeError('Network request failed');
      mockApiPost.mockRejectedValue(networkError);
      mockIsNetworkError.mockReturnValue(true);

      await useWeightStore.getState().logWeight(82.5);

      expect(mockRefreshCount).toHaveBeenCalled();
    });

    it('offline entry includes ISO loggedAt from provided date string', async () => {
      const networkError = new TypeError('Network request failed');
      mockApiPost.mockRejectedValue(networkError);
      mockIsNetworkError.mockReturnValue(true);

      const result = await useWeightStore.getState().logWeight(82.5, '2026-03-28');

      // Date-only string should be normalized to UTC noon
      expect(result.loggedAt).toContain('2026-03-28');
      expect(result.loggedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('offline entry uses current time when no date is provided', async () => {
      const networkError = new TypeError('Network request failed');
      mockApiPost.mockRejectedValue(networkError);
      mockIsNetworkError.mockReturnValue(true);

      const before = new Date().toISOString();
      const result = await useWeightStore.getState().logWeight(82.5);
      const after = new Date().toISOString();

      expect(result.loggedAt >= before).toBe(true);
      expect(result.loggedAt <= after).toBe(true);
    });

    it('throws non-network errors', async () => {
      const serverError = new Error('API error 500: Internal Server Error');
      mockApiPost.mockRejectedValue(serverError);
      mockIsNetworkError.mockReturnValue(false);

      await expect(useWeightStore.getState().logWeight(82.5)).rejects.toThrow(
        'API error 500: Internal Server Error',
      );
    });
  });
});
