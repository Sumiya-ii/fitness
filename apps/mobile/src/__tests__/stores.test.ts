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

jest.mock('../services/firebase-auth.service', () => ({
  signInWithEmailPassword: jest.fn(),
  signUpWithEmailPassword: jest.fn(),
  restoreFirebaseSession: jest.fn(),
  signOutFirebase: jest.fn(),
}));

import { api } from '../api';
import { useAuthStore } from '../stores/auth.store';
import { useDashboardStore } from '../stores/dashboard.store';
import {
  restoreFirebaseSession,
  signInWithEmailPassword,
  signOutFirebase,
  signUpWithEmailPassword,
} from '../services/firebase-auth.service';

const mockApi = api as jest.Mocked<typeof api>;
const mockSignIn = signInWithEmailPassword as jest.MockedFunction<typeof signInWithEmailPassword>;
const mockSignUp = signUpWithEmailPassword as jest.MockedFunction<typeof signUpWithEmailPassword>;
const mockRestoreSession = restoreFirebaseSession as jest.MockedFunction<
  typeof restoreFirebaseSession
>;
const mockSignOutFirebase = signOutFirebase as jest.MockedFunction<typeof signOutFirebase>;

describe('auth store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('signIn sets token and isAuthenticated', async () => {
    mockSignIn.mockResolvedValue({
      token: 'test-token-123',
      user: { id: 'uid-1', email: 'test@example.com' },
    });
    mockApi.setToken.mockResolvedValue(undefined);

    await useAuthStore.getState().signIn('test@example.com', 'password123');

    expect(mockApi.setToken).toHaveBeenCalledWith('test-token-123');
    expect(useAuthStore.getState().token).toBe('test-token-123');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('signUp sets token and isAuthenticated', async () => {
    mockSignUp.mockResolvedValue({
      token: 'new-token-456',
      user: { id: 'uid-2', email: 'new@example.com' },
    });
    mockApi.setToken.mockResolvedValue(undefined);

    await useAuthStore.getState().signUp('new@example.com', 'password123');

    expect(mockApi.setToken).toHaveBeenCalledWith('new-token-456');
    expect(useAuthStore.getState().token).toBe('new-token-456');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('signOut clears token and isAuthenticated', async () => {
    useAuthStore.setState({ token: 'x', isAuthenticated: true });
    mockApi.clearToken.mockResolvedValue(undefined);
    mockSignOutFirebase.mockResolvedValue(undefined);

    await useAuthStore.getState().signOut();

    expect(mockApi.clearToken).toHaveBeenCalled();
    expect(mockSignOutFirebase).toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('loadToken restores firebase session first', async () => {
    mockRestoreSession.mockResolvedValue({
      token: 'firebase-token',
      user: { id: 'uid-fb', email: 'fb@example.com' },
    });
    mockApi.setToken.mockResolvedValue(undefined);

    await useAuthStore.getState().loadToken();

    expect(mockApi.setToken).toHaveBeenCalledWith('firebase-token');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().token).toBe('firebase-token');
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
