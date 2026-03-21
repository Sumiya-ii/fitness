/**
 * Unit tests for useNutritionHistoryStore.
 */

jest.mock('../api/dashboard', () => ({
  dashboardApi: {
    getHistory: jest.fn(),
  },
}));

jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
}));

import { dashboardApi } from '../api/dashboard';
import { useNutritionHistoryStore } from '../stores/nutrition-history.store';

const mockGetHistory = dashboardApi.getHistory as jest.MockedFunction<
  typeof dashboardApi.getHistory
>;

const makeDayHistory = (date: string, calories = 0, waterMl = 0) => ({
  date,
  calories,
  protein: 0,
  carbs: 0,
  fat: 0,
  waterMl,
});

const mockHistoryData = {
  history: [
    makeDayHistory('2026-03-15', 1800, 1500),
    makeDayHistory('2026-03-16', 2100, 2200),
    makeDayHistory('2026-03-17', 0, 0),
    makeDayHistory('2026-03-18', 1950, 1800),
    makeDayHistory('2026-03-19', 2050, 2000),
    makeDayHistory('2026-03-20', 1700, 1600),
    makeDayHistory('2026-03-21', 900, 800),
  ],
  target: { calories: 2000, protein: 150, carbs: 250, fat: 65 },
};

describe('useNutritionHistoryStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNutritionHistoryStore.setState({ data: {}, isLoading: false, error: null });
  });

  it('fetches history and caches by period', async () => {
    mockGetHistory.mockResolvedValue({ data: mockHistoryData } as any);

    await useNutritionHistoryStore.getState().fetchHistory(7);

    expect(mockGetHistory).toHaveBeenCalledWith(7);
    const stored = useNutritionHistoryStore.getState().data[7];
    expect(stored).toBeDefined();
    expect(stored!.history).toHaveLength(7);
    expect(stored!.target?.calories).toBe(2000);
  });

  it('sets isLoading during fetch and clears on success', async () => {
    let resolvePromise!: (v: any) => void;
    mockGetHistory.mockReturnValue(
      new Promise((r) => {
        resolvePromise = r;
      }) as any,
    );

    const fetchPromise = useNutritionHistoryStore.getState().fetchHistory(7);
    expect(useNutritionHistoryStore.getState().isLoading).toBe(true);

    resolvePromise({ data: mockHistoryData });
    await fetchPromise;

    expect(useNutritionHistoryStore.getState().isLoading).toBe(false);
  });

  it('sets error and clears isLoading on failure', async () => {
    mockGetHistory.mockRejectedValue(new Error('Network error'));

    await useNutritionHistoryStore.getState().fetchHistory(30);

    const state = useNutritionHistoryStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Network error');
    expect(state.data[30]).toBeUndefined();
  });

  it('caches different periods independently', async () => {
    const data7 = { history: [makeDayHistory('2026-03-21', 1800, 2000)], target: null };
    const data30 = {
      history: Array.from({ length: 30 }, (_, i) => {
        const d = new Date('2026-02-20');
        d.setDate(d.getDate() + i);
        return makeDayHistory(d.toISOString().split('T')[0]!, 1500 + i * 10, 1800);
      }),
      target: null,
    };

    mockGetHistory
      .mockResolvedValueOnce({ data: data7 } as any)
      .mockResolvedValueOnce({ data: data30 } as any);

    await useNutritionHistoryStore.getState().fetchHistory(7);
    await useNutritionHistoryStore.getState().fetchHistory(30);

    const state = useNutritionHistoryStore.getState();
    expect(state.data[7]?.history).toHaveLength(1);
    expect(state.data[30]?.history).toHaveLength(30);
    expect(mockGetHistory).toHaveBeenCalledTimes(2);
  });

  it('overwrites cached data on re-fetch', async () => {
    const first = { history: [makeDayHistory('2026-03-21', 1800, 0)], target: null };
    const second = { history: [makeDayHistory('2026-03-21', 2200, 1500)], target: null };

    mockGetHistory
      .mockResolvedValueOnce({ data: first } as any)
      .mockResolvedValueOnce({ data: second } as any);

    await useNutritionHistoryStore.getState().fetchHistory(7);
    expect(useNutritionHistoryStore.getState().data[7]?.history[0]?.calories).toBe(1800);

    await useNutritionHistoryStore.getState().fetchHistory(7);
    expect(useNutritionHistoryStore.getState().data[7]?.history[0]?.calories).toBe(2200);
  });
});
