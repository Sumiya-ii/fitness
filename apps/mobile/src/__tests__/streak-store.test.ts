/**
 * Unit tests for useStreakStore.
 *
 * Covers: initial state, fetch (success, loading transitions, error paths).
 */

jest.mock('../api/streaks', () => ({
  streaksApi: {
    get: jest.fn(),
  },
}));

// Firebase is imported transitively — stub it to avoid side effects.
jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
}));

import { streaksApi, type StreakData } from '../api/streaks';
import { useStreakStore } from '../stores/streak.store';

const mockStreaksApi = streaksApi as jest.Mocked<typeof streaksApi>;

const MOCK_STREAK: StreakData = {
  currentStreak: 5,
  longestStreak: 14,
  weekConsistency: 85,
  monthConsistency: 72,
  todayLogged: true,
  calendar: [
    { date: '2026-03-24', logged: true },
    { date: '2026-03-25', logged: true },
    { date: '2026-03-26', logged: true },
    { date: '2026-03-27', logged: true },
    { date: '2026-03-28', logged: true },
  ],
};

function resetStore() {
  useStreakStore.setState({
    data: null,
    isLoading: false,
    error: null,
  });
}

describe('useStreakStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has null data, not loading, no error', () => {
      const state = useStreakStore.getState();
      expect(state.data).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('exposes the fetch function', () => {
      expect(typeof useStreakStore.getState().fetch).toBe('function');
    });
  });

  // ─── fetch ────────────────────────────────────────────────────────────────

  describe('fetch', () => {
    it('loads streak data and stores it', async () => {
      mockStreaksApi.get.mockResolvedValue({ data: MOCK_STREAK } as any);

      await useStreakStore.getState().fetch();

      const state = useStreakStore.getState();
      expect(state.data).toEqual(MOCK_STREAK);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets isLoading to true while fetching', async () => {
      let resolve!: (v: any) => void;
      mockStreaksApi.get.mockReturnValue(new Promise((r) => (resolve = r)));

      const fetchPromise = useStreakStore.getState().fetch();
      expect(useStreakStore.getState().isLoading).toBe(true);

      resolve({ data: MOCK_STREAK });
      await fetchPromise;

      expect(useStreakStore.getState().isLoading).toBe(false);
    });

    it('sets error and clears isLoading when API fails', async () => {
      mockStreaksApi.get.mockRejectedValue(new Error('Network error'));

      await useStreakStore.getState().fetch();

      const state = useStreakStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network error');
      expect(state.data).toBeNull();
    });

    it('uses generic error message for non-Error rejections', async () => {
      mockStreaksApi.get.mockRejectedValue('unexpected');

      await useStreakStore.getState().fetch();

      expect(useStreakStore.getState().error).toBe('Failed to load streak data');
    });

    it('stores all streak fields correctly', async () => {
      mockStreaksApi.get.mockResolvedValue({ data: MOCK_STREAK } as any);

      await useStreakStore.getState().fetch();

      const { data } = useStreakStore.getState();
      expect(data!.currentStreak).toBe(5);
      expect(data!.longestStreak).toBe(14);
      expect(data!.weekConsistency).toBe(85);
      expect(data!.monthConsistency).toBe(72);
      expect(data!.todayLogged).toBe(true);
      expect(data!.calendar).toHaveLength(5);
    });

    it('overwrites previous data on re-fetch', async () => {
      const oldStreak = { ...MOCK_STREAK, currentStreak: 3 };
      const newStreak = { ...MOCK_STREAK, currentStreak: 6 };

      mockStreaksApi.get
        .mockResolvedValueOnce({ data: oldStreak } as any)
        .mockResolvedValueOnce({ data: newStreak } as any);

      await useStreakStore.getState().fetch();
      expect(useStreakStore.getState().data!.currentStreak).toBe(3);

      await useStreakStore.getState().fetch();
      expect(useStreakStore.getState().data!.currentStreak).toBe(6);
    });

    it('handles zero streak correctly', async () => {
      const zeroStreak: StreakData = {
        ...MOCK_STREAK,
        currentStreak: 0,
        todayLogged: false,
        calendar: [],
      };
      mockStreaksApi.get.mockResolvedValue({ data: zeroStreak } as any);

      await useStreakStore.getState().fetch();

      const { data } = useStreakStore.getState();
      expect(data!.currentStreak).toBe(0);
      expect(data!.todayLogged).toBe(false);
    });
  });
});
