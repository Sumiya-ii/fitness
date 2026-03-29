import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';
const PROFILE_SETUP_COMPLETE_KEY = 'profile_setup_complete';

interface OnboardingState {
  onboardingComplete: boolean | null;
  profileSetupComplete: boolean | null;
  loadOnboardingStatus: () => Promise<void>;
  syncProfileSetupStatus: () => Promise<void>;
  setOnboardingComplete: () => Promise<void>;
  setProfileSetupComplete: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  onboardingComplete: null,
  profileSetupComplete: null,

  loadOnboardingStatus: async () => {
    try {
      const [onboarding, profile] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY),
        AsyncStorage.getItem(PROFILE_SETUP_COMPLETE_KEY),
      ]);
      set({
        onboardingComplete: onboarding === 'true',
        profileSetupComplete: profile === 'true',
      });
    } catch {
      set({ onboardingComplete: false, profileSetupComplete: false });
    }
  },

  syncProfileSetupStatus: async () => {
    set({ profileSetupComplete: null });
    try {
      const response = await api.get<{ data: { completed: boolean } }>('/onboarding/status');
      const completed = response.data.completed === true;
      await AsyncStorage.setItem(PROFILE_SETUP_COMPLETE_KEY, completed ? 'true' : 'false');
      set({ profileSetupComplete: completed });
    } catch {
      // Backend is the source of truth. If we can't reach it, default to false
      // so the user re-does onboarding rather than entering the app with no data.
      set({ profileSetupComplete: false });
    }
  },

  setOnboardingComplete: async () => {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    set({ onboardingComplete: true });
  },

  setProfileSetupComplete: async () => {
    await AsyncStorage.setItem(PROFILE_SETUP_COMPLETE_KEY, 'true');
    set({ profileSetupComplete: true });
  },
}));
