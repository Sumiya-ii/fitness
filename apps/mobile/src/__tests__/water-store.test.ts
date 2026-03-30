/**
 * Unit tests for useWaterStore.
 *
 * Covers: initial state, fetchDaily, addWater (optimistic), removeCup, undoLast.
 * The waterApi is mocked at module level to avoid real HTTP calls.
 */

jest.mock('../api/water', () => ({
  waterApi: {
    getDaily: jest.fn(),
    add: jest.fn(),
    deleteLast: jest.fn(),
  },
}));

// Firebase is imported transitively — stub it to avoid side effects.
jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
}));

import { waterApi } from '../api/water';
import { useWaterStore } from '../stores/water.store';

const mockWaterApi = waterApi as jest.Mocked<typeof waterApi>;

function resetStore() {
  useWaterStore.setState({
    consumed: 0,
    target: 2000,
    isLoading: false,
    error: null,
  });
}

describe('useWaterStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has consumed of 0, target of 2000, not loading, no error', () => {
      const state = useWaterStore.getState();
      expect(state.consumed).toBe(0);
      expect(state.target).toBe(2000);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('exposes all action functions', () => {
      const state = useWaterStore.getState();
      expect(typeof state.fetchDaily).toBe('function');
      expect(typeof state.addWater).toBe('function');
      expect(typeof state.removeCup).toBe('function');
      expect(typeof state.undoLast).toBe('function');
    });
  });

  // ─── fetchDaily ───────────────────────────────────────────────────────────

  describe('fetchDaily', () => {
    it('updates consumed and target from API response', async () => {
      mockWaterApi.getDaily.mockResolvedValue({
        data: { consumed: 1500, target: 2500, entries: [] },
      } as any);

      await useWaterStore.getState().fetchDaily();

      const state = useWaterStore.getState();
      expect(state.consumed).toBe(1500);
      expect(state.target).toBe(2500);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets isLoading to true while fetching and false after', async () => {
      let resolve!: (v: any) => void;
      mockWaterApi.getDaily.mockReturnValue(new Promise((r) => (resolve = r)));

      const fetchPromise = useWaterStore.getState().fetchDaily();
      expect(useWaterStore.getState().isLoading).toBe(true);

      resolve({ data: { consumed: 0, target: 2000, entries: [] } });
      await fetchPromise;

      expect(useWaterStore.getState().isLoading).toBe(false);
    });

    it('sets error and clears isLoading when API fails', async () => {
      mockWaterApi.getDaily.mockRejectedValue(new Error('Network error'));

      await useWaterStore.getState().fetchDaily();

      const state = useWaterStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Network error');
    });

    it('uses generic error message for non-Error rejections', async () => {
      mockWaterApi.getDaily.mockRejectedValue('unexpected');

      await useWaterStore.getState().fetchDaily();

      expect(useWaterStore.getState().error).toBe('Failed to load water data');
    });

    it('passes the date parameter to waterApi.getDaily', async () => {
      mockWaterApi.getDaily.mockResolvedValue({
        data: { consumed: 0, target: 2000, entries: [] },
      } as any);

      await useWaterStore.getState().fetchDaily('2026-03-28');

      expect(mockWaterApi.getDaily).toHaveBeenCalledWith('2026-03-28');
    });

    it('clears error on successful re-fetch after prior failure', async () => {
      useWaterStore.setState({ error: 'prior error' });
      mockWaterApi.getDaily.mockResolvedValue({
        data: { consumed: 500, target: 2000, entries: [] },
      } as any);

      await useWaterStore.getState().fetchDaily();

      expect(useWaterStore.getState().error).toBeNull();
    });
  });

  // ─── addWater ─────────────────────────────────────────────────────────────

  describe('addWater', () => {
    it('optimistically increments consumed before API call', async () => {
      useWaterStore.setState({ consumed: 500 });
      mockWaterApi.add.mockResolvedValue({ data: {} } as any);

      const addPromise = useWaterStore.getState().addWater(250);
      // Optimistic update should already be applied
      expect(useWaterStore.getState().consumed).toBe(750);

      await addPromise;
      expect(useWaterStore.getState().consumed).toBe(750);
    });

    it('calls waterApi.add with the correct amount', async () => {
      mockWaterApi.add.mockResolvedValue({ data: {} } as any);

      await useWaterStore.getState().addWater(300);

      expect(mockWaterApi.add).toHaveBeenCalledWith(300, undefined);
    });

    it('passes loggedAt when date is provided', async () => {
      mockWaterApi.add.mockResolvedValue({ data: {} } as any);

      await useWaterStore.getState().addWater(250, '2026-03-28');

      expect(mockWaterApi.add).toHaveBeenCalledWith(250, expect.stringContaining('2026-03-28'));
    });

    it('keeps optimistic state even when API call fails (silent error)', async () => {
      useWaterStore.setState({ consumed: 1000 });
      mockWaterApi.add.mockRejectedValue(new Error('Network error'));

      await useWaterStore.getState().addWater(250);

      // Optimistic state is kept — pull-to-refresh will correct it
      expect(useWaterStore.getState().consumed).toBe(1250);
      expect(useWaterStore.getState().error).toBeNull();
    });
  });

  // ─── removeCup ────────────────────────────────────────────────────────────

  describe('removeCup', () => {
    it('optimistically decrements consumed', async () => {
      useWaterStore.setState({ consumed: 1000 });
      mockWaterApi.deleteLast.mockResolvedValue({ data: { deleted: true } } as any);
      mockWaterApi.getDaily.mockResolvedValue({
        data: { consumed: 750, target: 2000, entries: [] },
      } as any);

      const removePromise = useWaterStore.getState().removeCup(250);
      expect(useWaterStore.getState().consumed).toBe(750);

      await removePromise;
    });

    it('does not decrement below 0', async () => {
      useWaterStore.setState({ consumed: 100 });
      mockWaterApi.deleteLast.mockResolvedValue({ data: { deleted: false } } as any);

      await useWaterStore.getState().removeCup(250);

      expect(useWaterStore.getState().consumed).toBe(0);
    });

    it('calls fetchDaily when server confirms deletion', async () => {
      useWaterStore.setState({ consumed: 500 });
      mockWaterApi.deleteLast.mockResolvedValue({ data: { deleted: true } } as any);
      mockWaterApi.getDaily.mockResolvedValue({
        data: { consumed: 250, target: 2000, entries: [] },
      } as any);

      await useWaterStore.getState().removeCup(250);

      expect(mockWaterApi.getDaily).toHaveBeenCalled();
    });

    it('does not call fetchDaily when server says nothing was deleted', async () => {
      useWaterStore.setState({ consumed: 500 });
      mockWaterApi.deleteLast.mockResolvedValue({ data: { deleted: false } } as any);

      await useWaterStore.getState().removeCup(250);

      expect(mockWaterApi.getDaily).not.toHaveBeenCalled();
    });

    it('silently ignores errors and keeps optimistic state', async () => {
      useWaterStore.setState({ consumed: 1000 });
      mockWaterApi.deleteLast.mockRejectedValue(new Error('Network error'));

      await useWaterStore.getState().removeCup(250);

      expect(useWaterStore.getState().consumed).toBe(750);
      expect(useWaterStore.getState().error).toBeNull();
    });
  });

  // ─── undoLast ─────────────────────────────────────────────────────────────

  describe('undoLast', () => {
    it('calls fetchDaily when server confirms deletion', async () => {
      mockWaterApi.deleteLast.mockResolvedValue({ data: { deleted: true } } as any);
      mockWaterApi.getDaily.mockResolvedValue({
        data: { consumed: 500, target: 2000, entries: [] },
      } as any);

      await useWaterStore.getState().undoLast();

      expect(mockWaterApi.deleteLast).toHaveBeenCalled();
      expect(mockWaterApi.getDaily).toHaveBeenCalled();
    });

    it('does not call fetchDaily when nothing was deleted', async () => {
      mockWaterApi.deleteLast.mockResolvedValue({ data: { deleted: false } } as any);

      await useWaterStore.getState().undoLast();

      expect(mockWaterApi.getDaily).not.toHaveBeenCalled();
    });

    it('sets error when deleteLast throws', async () => {
      mockWaterApi.deleteLast.mockRejectedValue(new Error('Server error'));

      await useWaterStore.getState().undoLast();

      expect(useWaterStore.getState().error).toBe('Server error');
    });

    it('sets generic error message for non-Error rejections', async () => {
      mockWaterApi.deleteLast.mockRejectedValue('unexpected');

      await useWaterStore.getState().undoLast();

      expect(useWaterStore.getState().error).toBe('Failed to undo');
    });
  });
});
