/**
 * Unit tests for the offline queue service.
 * MMKV is mocked in-memory via src/__mocks__/react-native-mmkv.js.
 */
import { offlineQueue, isNetworkError, isClientError } from '../services/offlineQueue';

// Reset MMKV state between tests via mock
beforeEach(() => {
  offlineQueue.clear();
});

describe('offlineQueue', () => {
  it('starts empty', () => {
    expect(offlineQueue.count()).toBe(0);
    expect(offlineQueue.getAll()).toEqual([]);
  });

  it('enqueues items and persists them', () => {
    offlineQueue.enqueue({ path: '/meal-logs', body: { calories: 300 } });
    offlineQueue.enqueue({ path: '/weight-logs', body: { weightKg: 72.5 } });

    expect(offlineQueue.count()).toBe(2);
    const all = offlineQueue.getAll();
    expect(all[0]!.path).toBe('/meal-logs');
    expect(all[1]!.path).toBe('/weight-logs');
  });

  it('preserves FIFO order', () => {
    offlineQueue.enqueue({ path: '/meal-logs', body: { calories: 100 } });
    offlineQueue.enqueue({ path: '/meal-logs', body: { calories: 200 } });
    offlineQueue.enqueue({ path: '/weight-logs', body: { weightKg: 70 } });

    const paths = offlineQueue.getAll().map((i) => i.path);
    expect(paths).toEqual(['/meal-logs', '/meal-logs', '/weight-logs']);
  });

  it('dequeues a specific item by id', () => {
    offlineQueue.enqueue({ path: '/meal-logs', body: {} });
    offlineQueue.enqueue({ path: '/weight-logs', body: {} });

    const [first, second] = offlineQueue.getAll();
    offlineQueue.dequeue(first!.id);

    expect(offlineQueue.count()).toBe(1);
    expect(offlineQueue.getAll()[0]!.id).toBe(second!.id);
  });

  it('clear() empties the queue', () => {
    offlineQueue.enqueue({ path: '/meal-logs', body: {} });
    offlineQueue.clear();

    expect(offlineQueue.count()).toBe(0);
  });

  it('each item gets a unique id and a createdAt timestamp', () => {
    offlineQueue.enqueue({ path: '/meal-logs', body: {} });
    offlineQueue.enqueue({ path: '/meal-logs', body: {} });

    const [a, b] = offlineQueue.getAll();
    expect(a!.id).toBeTruthy();
    expect(b!.id).toBeTruthy();
    expect(a!.id).not.toBe(b!.id);
    expect(new Date(a!.createdAt).getTime()).not.toBeNaN();
  });
});

describe('isNetworkError', () => {
  it('returns true for "Network request failed" TypeError', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
  });

  it('returns true for "Failed to fetch"', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('returns false for API 400 errors', () => {
    expect(isNetworkError(new Error('API error 400: Bad Request'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isNetworkError('offline')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('isClientError', () => {
  it('returns true for 4xx API errors', () => {
    expect(isClientError(new Error('API error 400: Bad Request'))).toBe(true);
    expect(isClientError(new Error('API error 422: Unprocessable Entity'))).toBe(true);
  });

  it('returns false for 5xx errors', () => {
    expect(isClientError(new Error('API error 500: Internal Server Error'))).toBe(false);
  });

  it('returns false for network errors', () => {
    expect(isClientError(new TypeError('Network request failed'))).toBe(false);
  });
});
