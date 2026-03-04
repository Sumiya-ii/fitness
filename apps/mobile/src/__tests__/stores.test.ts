/**
 * Unit tests for auth and dashboard stores (C-058).
 */

jest.mock('../api', () => ({
  api: {
    setToken: jest.fn(),
    clearToken: jest.fn(),
    getToken: jest.fn(),
  },
}));

import { api } from '../api';
import { useAuthStore } from '../stores/auth.store';
import { useDashboardStore } from '../stores/dashboard.store';

const mockApi = api as jest.Mocked<typeof api>;

describe('auth store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('signIn sets token and isAuthenticated', async () => {
    mockApi.setToken.mockResolvedValue(undefined);

    await useAuthStore.getState().signIn('test-token-123');

    expect(mockApi.setToken).toHaveBeenCalledWith('test-token-123');
    expect(useAuthStore.getState().token).toBe('test-token-123');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('signOut clears token and isAuthenticated', async () => {
    useAuthStore.setState({ token: 'x', isAuthenticated: true });
    mockApi.clearToken.mockResolvedValue(undefined);

    await useAuthStore.getState().signOut();

    expect(mockApi.clearToken).toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe('dashboard store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDashboardStore.setState({
      data: null,
      isLoading: false,
      error: null,
    });
  });

  it('has correct initial state', () => {
    const state = useDashboardStore.getState();
    expect(state.data).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(typeof state.fetchDashboard).toBe('function');
  });
});
