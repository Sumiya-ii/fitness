import { create } from 'zustand';
import { api } from '../api';
import {
  restoreFirebaseSession,
  signInWithEmailPassword,
  signOutFirebase,
  signUpWithEmailPassword,
  type FirebaseSessionUser,
} from '../services/firebase-auth.service';

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
  signOut: () => Promise<void>;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  signInWithToken: async (token: string, user?: FirebaseSessionUser) => {
    await api.setToken(token);
    set({
      token,
      isAuthenticated: true,
      user: user
        ? { id: user.id, email: user.email }
        : { id: 'legacy-token-user', email: null },
    });
  },

  signIn: async (email: string, password: string) => {
    const session = await signInWithEmailPassword(email, password);
    await api.setToken(session.token);
    set({
      token: session.token,
      isAuthenticated: true,
      user: { id: session.user.id, email: session.user.email },
    });
  },

  signUp: async (email: string, password: string) => {
    const session = await signUpWithEmailPassword(email, password);
    await api.setToken(session.token);
    set({
      token: session.token,
      isAuthenticated: true,
      user: { id: session.user.id, email: session.user.email },
    });
  },

  signOut: async () => {
    await Promise.allSettled([signOutFirebase(), api.clearToken()]);
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadToken: async () => {
    set({ isLoading: true });
    try {
      const firebaseSession = await restoreFirebaseSession();
      if (firebaseSession) {
        await api.setToken(firebaseSession.token);
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

      const fallbackToken = await api.getToken();
      if (fallbackToken) {
        set({
          token: fallbackToken,
          isAuthenticated: true,
          user: { id: 'legacy-token-user', email: null },
          isLoading: false,
        });
      } else {
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
