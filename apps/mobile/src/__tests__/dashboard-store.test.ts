import { useDashboardStore, type DashboardData } from '../stores/dashboard.store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockGet = jest.fn();
jest.mock('../api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    setToken: jest.fn(),
    getToken: jest.fn(),
    clearToken: jest.fn(),
  },
}));

jest.mock('../utils/timezone', () => ({
  getDeviceTimezone: () => 'Asia/Ulaanbaatar',
}));

const makeDashboardData = (overrides?: Partial<DashboardData>): DashboardData => ({
  date: '2026-03-28',
  consumed: {
    calories: 1200,
    protein: 80,
    carbs: 100,
    fat: 40,
    fiber: null,
    sugar: null,
    sodium: null,
    saturatedFat: null,
  },
  targets: { calories: 2100, protein: 170, carbs: 200, fat: 60 },
  remaining: { calories: 900, protein: 90, carbs: 100, fat: 20 },
  proteinProgress: { current: 80, target: 170, percentage: 47.1 },
  mealCount: 2,
  meals: [],
  waterConsumed: 1000,
  waterTarget: 2000,
  ...overrides,
});

describe('DashboardStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDashboardStore.setState({ data: null, isLoading: false, error: null });
  });

  it('should fetch dashboard data and store it', async () => {
    const mockData = makeDashboardData();
    mockGet.mockResolvedValue({ data: mockData });

    await useDashboardStore.getState().fetchDashboard('2026-03-28');

    const state = useDashboardStore.getState();
    expect(state.data).toEqual(mockData);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should keep previous data on API error (stale-while-revalidate)', async () => {
    const existingData = makeDashboardData();
    useDashboardStore.setState({ data: existingData });

    mockGet.mockRejectedValue(new Error('Network error'));

    await useDashboardStore.getState().fetchDashboard('2026-03-28');

    const state = useDashboardStore.getState();
    expect(state.data).toEqual(existingData);
    expect(state.error).toBe('Network error');
  });

  it('should keep data as null when error occurs with no previous data', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    await useDashboardStore.getState().fetchDashboard('2026-03-28');

    const state = useDashboardStore.getState();
    expect(state.data).toBeNull();
    expect(state.error).toBe('Network error');
  });

  it('should handle null targets from API (no onboarding completed)', async () => {
    const mockData = makeDashboardData({ targets: null, remaining: null, proteinProgress: null });
    mockGet.mockResolvedValue({ data: mockData });

    await useDashboardStore.getState().fetchDashboard('2026-03-28');

    const state = useDashboardStore.getState();
    expect(state.data?.targets).toBeNull();
    expect(state.data?.remaining).toBeNull();
  });

  it('should cache successful response to AsyncStorage', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const mockData = makeDashboardData();
    mockGet.mockResolvedValue({ data: mockData });

    await useDashboardStore.getState().fetchDashboard('2026-03-28');

    // Give async cache write time to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('dashboard_last', JSON.stringify(mockData));
  });

  it('should load cached data when no current data exists', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const cachedData = makeDashboardData();
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(cachedData));

    await useDashboardStore.getState().loadCachedDashboard();

    const state = useDashboardStore.getState();
    expect(state.data).toEqual(cachedData);
  });

  it('should not overwrite current data when loading cache', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const currentData = makeDashboardData({ date: '2026-03-28' });
    const cachedData = makeDashboardData({ date: '2026-03-27' });

    useDashboardStore.setState({ data: currentData });
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(cachedData));

    await useDashboardStore.getState().loadCachedDashboard();

    const state = useDashboardStore.getState();
    expect(state.data?.date).toBe('2026-03-28');
  });
});
