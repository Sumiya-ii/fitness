/**
 * Unit tests for useSyncStore.
 *
 * The sync store tracks the offline queue count and network status.
 * offlineQueue is mocked so MMKV is not accessed in tests.
 */

const mockCount = jest.fn(() => 0);
const mockFailedCount = jest.fn(() => 0);

jest.mock('../services/offlineQueue', () => ({
  offlineQueue: {
    count: () => mockCount(),
    failedCount: () => mockFailedCount(),
    enqueue: jest.fn(),
    dequeue: jest.fn(),
    getAll: jest.fn(() => []),
    clear: jest.fn(),
  },
  isNetworkError: jest.fn(() => false),
}));

// Firebase is imported transitively — stub it to avoid side effects.
jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
}));

import { useSyncStore } from '../stores/sync.store';

function resetStore() {
  useSyncStore.setState({
    pendingCount: 0,
    failedCount: 0,
    isSyncing: false,
    isOnline: true,
  });
}

describe('useSyncStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCount.mockReturnValue(0);
    mockFailedCount.mockReturnValue(0);
    resetStore();
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has pendingCount of 0, not syncing, online', () => {
      const state = useSyncStore.getState();
      expect(state.pendingCount).toBe(0);
      expect(state.isSyncing).toBe(false);
      expect(state.isOnline).toBe(true);
    });

    it('exposes all action functions', () => {
      const state = useSyncStore.getState();
      expect(typeof state.refreshCount).toBe('function');
      expect(typeof state.setIsSyncing).toBe('function');
      expect(typeof state.setIsOnline).toBe('function');
    });
  });

  // ─── refreshCount ─────────────────────────────────────────────────────────

  describe('refreshCount', () => {
    it('updates pendingCount from offlineQueue.count()', () => {
      mockCount.mockReturnValue(3);

      useSyncStore.getState().refreshCount();

      expect(useSyncStore.getState().pendingCount).toBe(3);
    });

    it('sets pendingCount to 0 when queue is empty', () => {
      useSyncStore.setState({ pendingCount: 5 });
      mockCount.mockReturnValue(0);

      useSyncStore.getState().refreshCount();

      expect(useSyncStore.getState().pendingCount).toBe(0);
    });

    it('reflects the live queue count each call', () => {
      mockCount.mockReturnValueOnce(2).mockReturnValueOnce(1).mockReturnValueOnce(0);

      useSyncStore.getState().refreshCount();
      expect(useSyncStore.getState().pendingCount).toBe(2);

      useSyncStore.getState().refreshCount();
      expect(useSyncStore.getState().pendingCount).toBe(1);

      useSyncStore.getState().refreshCount();
      expect(useSyncStore.getState().pendingCount).toBe(0);
    });
  });

  // ─── setIsSyncing ─────────────────────────────────────────────────────────

  describe('setIsSyncing', () => {
    it('sets isSyncing to true', () => {
      useSyncStore.getState().setIsSyncing(true);
      expect(useSyncStore.getState().isSyncing).toBe(true);
    });

    it('sets isSyncing to false', () => {
      useSyncStore.setState({ isSyncing: true });
      useSyncStore.getState().setIsSyncing(false);
      expect(useSyncStore.getState().isSyncing).toBe(false);
    });
  });

  // ─── setIsOnline ──────────────────────────────────────────────────────────

  describe('setIsOnline', () => {
    it('sets isOnline to false when device goes offline', () => {
      useSyncStore.getState().setIsOnline(false);
      expect(useSyncStore.getState().isOnline).toBe(false);
    });

    it('sets isOnline back to true when device comes online', () => {
      useSyncStore.setState({ isOnline: false });
      useSyncStore.getState().setIsOnline(true);
      expect(useSyncStore.getState().isOnline).toBe(true);
    });
  });

  // ─── State independence ───────────────────────────────────────────────────

  describe('state independence', () => {
    it('setIsSyncing does not affect isOnline or pendingCount', () => {
      useSyncStore.setState({ pendingCount: 3, isOnline: false });

      useSyncStore.getState().setIsSyncing(true);

      const state = useSyncStore.getState();
      expect(state.pendingCount).toBe(3);
      expect(state.isOnline).toBe(false);
    });

    it('setIsOnline does not affect isSyncing or pendingCount', () => {
      useSyncStore.setState({ pendingCount: 2, isSyncing: true });

      useSyncStore.getState().setIsOnline(false);

      const state = useSyncStore.getState();
      expect(state.pendingCount).toBe(2);
      expect(state.isSyncing).toBe(true);
    });
  });
});
