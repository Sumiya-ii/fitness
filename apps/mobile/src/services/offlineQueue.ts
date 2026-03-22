import { queueStorage } from '../storage/mmkv';

const QUEUE_KEY = 'write_queue_v1';

export interface QueueItem {
  id: string;
  path: string;
  body: unknown;
  createdAt: string;
}

// ─── Pure storage helpers ──────────────────────────────────────────────────

function readQueue(): QueueItem[] {
  const raw = queueStorage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]): void {
  queueStorage.set(QUEUE_KEY, JSON.stringify(items));
}

// ─── Public API ────────────────────────────────────────────────────────────

export const offlineQueue = {
  getAll(): QueueItem[] {
    return readQueue();
  },

  enqueue(entry: Pick<QueueItem, 'path' | 'body'>): void {
    const items = readQueue();
    items.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      ...entry,
    });
    writeQueue(items);
  },

  /** Remove a single item by id (called after successful replay). */
  dequeue(id: string): void {
    writeQueue(readQueue().filter((item) => item.id !== id));
  },

  count(): number {
    return readQueue().length;
  },

  clear(): void {
    queueStorage.delete(QUEUE_KEY);
  },
};

// ─── Network-error detection ───────────────────────────────────────────────

/**
 * Returns true when `fetch()` threw because the device had no connectivity.
 * React Native's `fetch` always throws `TypeError: Network request failed` when offline.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error')
  );
}

/**
 * Returns true when the API responded with a 4xx client error.
 * These items will never succeed and should be dropped from the queue.
 */
export function isClientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const match = error.message.match(/^API error (\d+):/);
  if (!match) return false;
  const status = parseInt(match[1]!, 10);
  return status >= 400 && status < 500;
}
