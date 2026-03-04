import { create } from 'zustand';
import { api } from '../api';

interface User {
  id: string;
  email?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  signIn: async (token: string) => {
    await api.setToken(token);
    set({ token, isAuthenticated: true, user: { id: 'placeholder' } });
  },

  signOut: async () => {
    await api.clearToken();
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadToken: async () => {
    set({ isLoading: true });
    try {
      const token = await api.getToken();
      if (token) {
        set({ token, isAuthenticated: true, user: { id: 'placeholder' }, isLoading: false });
      } else {
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
