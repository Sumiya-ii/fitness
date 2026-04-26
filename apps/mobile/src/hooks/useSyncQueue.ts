import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import { api } from '../api/client';
import { isClientError, isNetworkError, offlineQueue } from '../services/offlineQueue';
import { useSyncStore } from '../stores/sync.store';

/**
 * Mount once at the app root. Subscribes to network state and flushes
 * queued writes in FIFO order whenever the device comes back online.
 */
export function useSyncQueue() {
  const { setIsOnline, setIsSyncing, refreshCount } = useSyncStore();
  const isFlushing = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(connected);

      if (connected && !isFlushing.current) {
        void flushQueue();
      }
    });

    return () => unsubscribe();
  }, []);

  async function flushQueue() {
    const items = offlineQueue.getAll();
    if (items.length === 0) return;

    isFlushing.current = true;
    setIsSyncing(true);

    for (const item of items) {
      try {
        await api.post(item.path, item.body);
        offlineQueue.dequeue(item.id);
        refreshCount();
      } catch (e) {
        if (isClientError(e)) {
          // 4xx — this request can never succeed; drop it silently.
          offlineQueue.dequeue(item.id);
          refreshCount();
          continue;
        }
        if (isNetworkError(e)) {
          // Device went offline again mid-flush — stop and let next reconnect retry.
          break;
        }
        // 5xx or unknown server error — leave in queue, try again on next reconnect.
        break;
      }
    }

    setIsSyncing(false);
    isFlushing.current = false;
  }
}
