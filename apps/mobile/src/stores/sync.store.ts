import { create } from 'zustand';
import { offlineQueue } from '../services/offlineQueue';

interface SyncState {
  /** Number of writes currently sitting in the offline queue. */
  pendingCount: number;
  /** Number of queued writes that failed permanently during replay. */
  failedCount: number;
  /** True while the queue is being replayed after reconnection. */
  isSyncing: boolean;
  /** Last known network reachability state. */
  isOnline: boolean;

  // ─── Actions ────────────────────────────────────────────────────
  /** Re-reads the queue length from MMKV and updates pendingCount. */
  refreshCount: () => void;
  setIsSyncing: (value: boolean) => void;
  setIsOnline: (value: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  pendingCount: offlineQueue.count(),
  failedCount: offlineQueue.failedCount(),
  isSyncing: false,
  isOnline: true,

  refreshCount: () =>
    set({ pendingCount: offlineQueue.count(), failedCount: offlineQueue.failedCount() }),
  setIsSyncing: (value) => set({ isSyncing: value }),
  setIsOnline: (value) => set({ isOnline: value }),
}));
