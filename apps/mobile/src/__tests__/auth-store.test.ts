/**
 * Comprehensive tests for useAuthStore.
 *
 * Covers: initial state, all sign-in methods, sign-out, loadToken
 * (Firebase session restore, fallback token, and error paths).
 */

jest.mock('../api', () => ({
  api: {
    setToken: jest.fn(),
    clearToken: jest.fn(),
    getToken: jest.fn(),
  },
  setTokenRefreshCallback: jest.fn(),
}));

jest.mock('../lib/firebase', () => ({
  getFirebaseAuth: jest.fn(() => ({ currentUser: null })),
}));

jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
  signInWithEmailPassword: jest.fn(),
  signUpWithEmailPassword: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  signOutFirebase: jest.fn(),
  resetPassword: jest.fn(),
  restoreFirebaseSession: jest.fn(),
}));

import { api } from '../api';
import { useAuthStore } from '../stores/auth.store';
import {
  signInWithEmailPassword,
  signUpWithEmailPassword,
  signInWithGoogle,
  signInWithApple,
  signOutFirebase,
  resetPassword,
  restoreFirebaseSession,
} from '../services/firebase-auth.service';

const mockApi = api as jest.Mocked<typeof api>;
const mockSignIn = signInWithEmailPassword as jest.MockedFunction<typeof signInWithEmailPassword>;
const mockSignUp = signUpWithEmailPassword as jest.MockedFunction<typeof signUpWithEmailPassword>;
const mockGoogleSignIn = signInWithGoogle as jest.MockedFunction<typeof signInWithGoogle>;
const mockAppleSignIn = signInWithApple as jest.MockedFunction<typeof signInWithApple>;
const mockSignOutFirebase = signOutFirebase as jest.MockedFunction<typeof signOutFirebase>;
const mockResetPassword = resetPassword as jest.MockedFunction<typeof resetPassword>;
const mockRestoreSession = restoreFirebaseSession as jest.MockedFunction<
  typeof restoreFirebaseSession
>;

const MOCK_SESSION = {
  token: 'test-token-abc',
  user: { id: 'uid-123', email: 'user@example.com' },
};

function resetStore() {
  useAuthStore.setState({
    token: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });
}

describe('useAuthStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    mockApi.setToken.mockResolvedValue(undefined);
    mockApi.clearToken.mockResolvedValue(undefined);
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has null token, null user, and is not authenticated', () => {
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('exposes all expected action functions', () => {
      const state = useAuthStore.getState();
      expect(typeof state.signIn).toBe('function');
      expect(typeof state.signUp).toBe('function');
      expect(typeof state.signInWithToken).toBe('function');
      expect(typeof state.signInWithGoogle).toBe('function');
      expect(typeof state.signInWithApple).toBe('function');
      expect(typeof state.signOut).toBe('function');
      expect(typeof state.resetPassword).toBe('function');
      expect(typeof state.loadToken).toBe('function');
    });
  });

  // ─── signIn ───────────────────────────────────────────────────────────────

  describe('signIn', () => {
    it('sets token, user, and isAuthenticated on success', async () => {
      mockSignIn.mockResolvedValue(MOCK_SESSION);

      await useAuthStore.getState().signIn('user@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.token).toBe('test-token-abc');
      expect(state.user).toEqual({ id: 'uid-123', email: 'user@example.com' });
      expect(state.isAuthenticated).toBe(true);
    });

    it('calls api.setToken with the returned token', async () => {
      mockSignIn.mockResolvedValue(MOCK_SESSION);

      await useAuthStore.getState().signIn('user@example.com', 'password123');

      expect(mockApi.setToken).toHaveBeenCalledWith('test-token-abc');
    });

    it('calls signInWithEmailPassword with provided credentials', async () => {
      mockSignIn.mockResolvedValue(MOCK_SESSION);

      await useAuthStore.getState().signIn('user@example.com', 'password123');

      expect(mockSignIn).toHaveBeenCalledWith('user@example.com', 'password123');
    });

    it('propagates errors from firebase', async () => {
      mockSignIn.mockRejectedValue(new Error('auth/wrong-password'));

      await expect(useAuthStore.getState().signIn('u@e.com', 'wrong')).rejects.toThrow(
        'auth/wrong-password',
      );

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ─── signUp ───────────────────────────────────────────────────────────────

  describe('signUp', () => {
    it('sets token, user, and isAuthenticated on success', async () => {
      mockSignUp.mockResolvedValue(MOCK_SESSION);

      await useAuthStore.getState().signUp('new@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.token).toBe('test-token-abc');
      expect(state.user).toEqual({ id: 'uid-123', email: 'user@example.com' });
      expect(state.isAuthenticated).toBe(true);
    });

    it('calls api.setToken with the returned token', async () => {
      mockSignUp.mockResolvedValue(MOCK_SESSION);

      await useAuthStore.getState().signUp('new@example.com', 'password123');

      expect(mockApi.setToken).toHaveBeenCalledWith('test-token-abc');
    });

    it('propagates errors from firebase', async () => {
      mockSignUp.mockRejectedValue(new Error('auth/email-already-in-use'));

      await expect(useAuthStore.getState().signUp('taken@example.com', 'pass')).rejects.toThrow(
        'auth/email-already-in-use',
      );
    });
  });

  // ─── signInWithToken ──────────────────────────────────────────────────────

  describe('signInWithToken', () => {
    it('sets token and isAuthenticated when user is provided', async () => {
      const user = { id: 'uid-999', email: 'token@example.com' };

      await useAuthStore.getState().signInWithToken('direct-token', user);

      const state = useAuthStore.getState();
      expect(state.token).toBe('direct-token');
      expect(state.user).toEqual({ id: 'uid-999', email: 'token@example.com' });
      expect(state.isAuthenticated).toBe(true);
    });

    it('uses legacy-token-user placeholder when no user is provided', async () => {
      await useAuthStore.getState().signInWithToken('legacy-token');

      const state = useAuthStore.getState();
      expect(state.token).toBe('legacy-token');
      expect(state.user).toEqual({ id: 'legacy-token-user', email: null });
      expect(state.isAuthenticated).toBe(true);
    });

    it('calls api.setToken with the provided token', async () => {
      await useAuthStore.getState().signInWithToken('direct-token');

      expect(mockApi.setToken).toHaveBeenCalledWith('direct-token');
    });
  });

  // ─── signInWithGoogle ─────────────────────────────────────────────────────

  describe('signInWithGoogle', () => {
    it('sets token, user, and isAuthenticated on success', async () => {
      mockGoogleSignIn.mockResolvedValue(MOCK_SESSION);

      await useAuthStore.getState().signInWithGoogle();

      const state = useAuthStore.getState();
      expect(state.token).toBe('test-token-abc');
      expect(state.user).toEqual({ id: 'uid-123', email: 'user@example.com' });
      expect(state.isAuthenticated).toBe(true);
    });

    it('calls api.setToken with the returned token', async () => {
      mockGoogleSignIn.mockResolvedValue(MOCK_SESSION);

      await useAuthStore.getState().signInWithGoogle();

      expect(mockApi.setToken).toHaveBeenCalledWith('test-token-abc');
    });

    it('propagates errors from google sign in', async () => {
      mockGoogleSignIn.mockRejectedValue(new Error('SIGN_IN_CANCELLED'));

      await expect(useAuthStore.getState().signInWithGoogle()).rejects.toThrow('SIGN_IN_CANCELLED');

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ─── signInWithApple ──────────────────────────────────────────────────────

  describe('signInWithApple', () => {
    it('sets token, user, and isAuthenticated on success', async () => {
      mockAppleSignIn.mockResolvedValue({
        token: 'apple-token',
        user: { id: 'apple-uid', email: 'apple@example.com' },
      });

      await useAuthStore.getState().signInWithApple();

      const state = useAuthStore.getState();
      expect(state.token).toBe('apple-token');
      expect(state.user).toEqual({ id: 'apple-uid', email: 'apple@example.com' });
      expect(state.isAuthenticated).toBe(true);
    });

    it('propagates errors from apple sign in', async () => {
      mockAppleSignIn.mockRejectedValue(new Error('ERR_CANCELED'));

      await expect(useAuthStore.getState().signInWithApple()).rejects.toThrow('ERR_CANCELED');
    });
  });

  // ─── signOut ──────────────────────────────────────────────────────────────

  describe('signOut', () => {
    it('clears token, user, and isAuthenticated', async () => {
      useAuthStore.setState({
        token: 'some-token',
        user: { id: 'uid-1', email: 'u@e.com' },
        isAuthenticated: true,
      });
      mockSignOutFirebase.mockResolvedValue(undefined);

      await useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('calls both signOutFirebase and api.clearToken', async () => {
      mockSignOutFirebase.mockResolvedValue(undefined);
      useAuthStore.setState({ isAuthenticated: true });

      await useAuthStore.getState().signOut();

      expect(mockSignOutFirebase).toHaveBeenCalled();
      expect(mockApi.clearToken).toHaveBeenCalled();
    });

    it('clears state even when signOutFirebase rejects (allSettled)', async () => {
      mockSignOutFirebase.mockRejectedValue(new Error('firebase error'));

      await useAuthStore.getState().signOut();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().token).toBeNull();
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('calls firebaseResetPassword with the provided email', async () => {
      mockResetPassword.mockResolvedValue(undefined);

      await useAuthStore.getState().resetPassword('user@example.com');

      expect(mockResetPassword).toHaveBeenCalledWith('user@example.com');
    });

    it('propagates errors from firebase', async () => {
      mockResetPassword.mockRejectedValue(new Error('auth/user-not-found'));

      await expect(useAuthStore.getState().resetPassword('ghost@example.com')).rejects.toThrow(
        'auth/user-not-found',
      );
    });
  });

  // ─── loadToken ────────────────────────────────────────────────────────────

  describe('loadToken', () => {
    it('restores firebase session when available', async () => {
      mockRestoreSession.mockResolvedValue({
        token: 'firebase-token',
        user: { id: 'uid-fb', email: 'fb@example.com' },
      });

      await useAuthStore.getState().loadToken();

      const state = useAuthStore.getState();
      expect(state.token).toBe('firebase-token');
      expect(state.user).toEqual({ id: 'uid-fb', email: 'fb@example.com' });
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('calls api.setToken with firebase token when restoring session', async () => {
      mockRestoreSession.mockResolvedValue(MOCK_SESSION);

      await useAuthStore.getState().loadToken();

      expect(mockApi.setToken).toHaveBeenCalledWith('test-token-abc');
    });

    it('falls back to stored API token when firebase session is null', async () => {
      mockRestoreSession.mockResolvedValue(null);
      mockApi.getToken.mockResolvedValue('stored-token');

      await useAuthStore.getState().loadToken();

      const state = useAuthStore.getState();
      expect(state.token).toBe('stored-token');
      expect(state.user).toEqual({ id: 'legacy-token-user', email: null });
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('sets unauthenticated state when both firebase and stored token are absent', async () => {
      mockRestoreSession.mockResolvedValue(null);
      mockApi.getToken.mockResolvedValue(null);

      await useAuthStore.getState().loadToken();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('sets unauthenticated state and clears isLoading when restoreFirebaseSession throws', async () => {
      mockRestoreSession.mockRejectedValue(new Error('firebase unavailable'));

      await useAuthStore.getState().loadToken();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('sets isLoading to true at the start of loadToken', async () => {
      let resolveRestore!: (v: null) => void;
      mockRestoreSession.mockReturnValue(new Promise((r) => (resolveRestore = r)));

      const loadPromise = useAuthStore.getState().loadToken();
      expect(useAuthStore.getState().isLoading).toBe(true);

      resolveRestore(null);
      mockApi.getToken.mockResolvedValue(null);
      await loadPromise;

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });
});
