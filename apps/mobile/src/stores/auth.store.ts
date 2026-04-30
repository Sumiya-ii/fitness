import { create } from 'zustand';
import { api } from '../api';
import { setTokenRefreshCallback } from '../api/client';
import { useDashboardStore } from './dashboard.store';
import { useWaterStore } from './water.store';
import { useWeightStore } from './weight.store';
import {
  configureGoogleSignIn,
  resetPassword as firebaseResetPassword,
  restoreFirebaseSession,
  signInWithApple,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutFirebase,
  signUpWithEmailPassword,
  subscribeToTokenRefresh,
  type FirebaseSessionUser,
} from '../services/firebase-auth.service';
import { getFirebaseAuth } from '../lib/firebase';

configureGoogleSignIn();

// Register the 401 token-refresh callback on the API client so that any request
// that returns 401 (stale kid / expired token) will force-refresh and retry once.
setTokenRefreshCallback(async () => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const freshToken = await user.getIdToken(true);
    await api.setToken(freshToken);
    return freshToken;
  } catch {
    return null;
  }
});

// Keeps the stored token in sync when Firebase auto-refreshes it (every ~1 hr).
let _tokenRefreshUnsub: (() => void) | null = null;

function ensureTokenRefresh(getState: () => AuthState, setState: (s: Partial<AuthState>) => void) {
  if (_tokenRefreshUnsub) return;
  _tokenRefreshUnsub = subscribeToTokenRefresh(async (freshToken) => {
    if (getState().isAuthenticated) {
      await api.setToken(freshToken);
      setState({ token: freshToken });
    }
  });
}

interface User {
  id: string;
  email: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithToken: (token: string, user?: FirebaseSessionUser) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  signInWithToken: async (token: string, user?: FirebaseSessionUser) => {
    await api.setToken(token);
    set({
      token,
      isAuthenticated: true,
      user: user ? { id: user.id, email: user.email } : { id: 'legacy-token-user', email: null },
    });
  },

  signIn: async (email: string, password: string) => {
    const session = await signInWithEmailPassword(email, password);
    await api.setToken(session.token);
    ensureTokenRefresh(get, set);
    set({
      token: session.token,
      isAuthenticated: true,
      user: { id: session.user.id, email: session.user.email },
    });
  },

  signUp: async (email: string, password: string) => {
    const session = await signUpWithEmailPassword(email, password);
    await api.setToken(session.token);
    ensureTokenRefresh(get, set);
    set({
      token: session.token,
      isAuthenticated: true,
      user: { id: session.user.id, email: session.user.email },
    });
  },

  signInWithGoogle: async () => {
    const session = await signInWithGoogle();
    await api.setToken(session.token);
    ensureTokenRefresh(get, set);
    set({
      token: session.token,
      isAuthenticated: true,
      user: { id: session.user.id, email: session.user.email },
    });
  },

  signInWithApple: async () => {
    const session = await signInWithApple();
    await api.setToken(session.token);
    ensureTokenRefresh(get, set);
    set({
      token: session.token,
      isAuthenticated: true,
      user: { id: session.user.id, email: session.user.email },
    });
  },

  signOut: async () => {
    _tokenRefreshUnsub?.();
    _tokenRefreshUnsub = null;
    await Promise.allSettled([signOutFirebase(), api.clearToken()]);
    set({ token: null, user: null, isAuthenticated: false });
    // Clear per-user cached state so the next user starts fresh
    useDashboardStore.setState({ data: null, error: null });
    useWaterStore.setState({ consumed: 0 });
    useWeightStore.setState({ history: [], trend: null, isLoading: false, error: null });
  },

  resetPassword: async (email: string) => {
    await firebaseResetPassword(email);
  },

  loadToken: async () => {
    set({ isLoading: true });
    try {
      const firebaseSession = await restoreFirebaseSession();
      if (firebaseSession) {
        await api.setToken(firebaseSession.token);
        ensureTokenRefresh(get, set);
        set({
          token: firebaseSession.token,
          isAuthenticated: true,
          user: {
            id: firebaseSession.user.id,
            email: firebaseSession.user.email,
          },
          isLoading: false,
        });
        return;
      }

      // No Firebase session — clear any leftover legacy token and treat as signed out.
      await api.clearToken();
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    } catch {
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
