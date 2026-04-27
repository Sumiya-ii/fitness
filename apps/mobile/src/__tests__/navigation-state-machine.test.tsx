/**
 * Navigation state machine tests.
 *
 * Tests the routing logic in RootNavigator that decides which stack to show
 * based on the combination of auth, profile-setup, and loading states.
 *
 * State matrix:
 *   isLoading=true                                  → spinner (no stack)
 *   isLoading=false, isAuthenticated=false          → OnboardingStack
 *   isLoading=false, isAuthenticated=true,
 *     profileSetupComplete=null                     → spinner (no stack)
 *   isLoading=false, isAuthenticated=true,
 *     profileSetupComplete=false                    → OnboardingStack
 *   isLoading=false, isAuthenticated=true,
 *     profileSetupComplete=true                     → MainStack
 */

// ---------------------------------------------------------------------------
// Stack trackers — set by mocked components when they render
// ---------------------------------------------------------------------------
let renderedStack = '';

jest.mock('../navigation/OnboardingStack', () => ({
  OnboardingStack: () => {
    renderedStack = 'OnboardingStack';
    return null;
  },
}));

jest.mock('../navigation/MainStack', () => ({
  MainStack: () => {
    renderedStack = 'MainStack';
    return null;
  },
}));

// ---------------------------------------------------------------------------
// Firebase — always mock, never call real service
// ---------------------------------------------------------------------------
jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
  signInWithEmailPassword: jest.fn(),
  signUpWithEmailPassword: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  sendPasswordReset: jest.fn(),
  signOutFirebase: jest.fn(),
  restoreFirebaseSession: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Hooks used by RootNavigator that are irrelevant to routing logic
// ---------------------------------------------------------------------------
jest.mock('../hooks/usePushNotifications', () => ({
  usePushNotifications: jest.fn(),
}));

jest.mock('../hooks/useSyncQueue', () => ({
  useSyncQueue: jest.fn(),
}));

// ---------------------------------------------------------------------------
// AsyncStorage
// ---------------------------------------------------------------------------
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// ---------------------------------------------------------------------------
// API client — used by onboarding store's syncProfileSetupStatus
// ---------------------------------------------------------------------------
jest.mock('../api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    setToken: jest.fn(),
    clearToken: jest.fn(),
    getToken: jest.fn(),
  },
  setTokenRefreshCallback: jest.fn(),
}));

jest.mock('../lib/firebase', () => ({
  getFirebaseAuth: jest.fn(() => ({ currentUser: null })),
}));

// ---------------------------------------------------------------------------
// Imports (after all jest.mock calls)
// ---------------------------------------------------------------------------
import React from 'react';
import { act } from '@testing-library/react-native';
import { renderScreen } from './helpers/render';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
import { useProfileStore } from '../stores/profile.store';
import { RootNavigator } from '../navigation/RootNavigator';
import { api } from '../api/client';

const _mockApi = api as jest.Mocked<typeof api>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Snapshot of the current rendered stack identifier. */
function currentStack() {
  return renderedStack;
}

/**
 * Set auth store state and onboarding store state in one call.
 * Provides sensible no-op defaults for action fields so individual tests only
 * need to specify the values they care about.
 */
function setStoreState({
  isAuthenticated,
  isLoading,
  profileSetupComplete,
}: {
  isAuthenticated: boolean;
  isLoading: boolean;
  profileSetupComplete: boolean | null;
}) {
  useAuthStore.setState({ isAuthenticated, isLoading });
  useOnboardingStore.setState({
    profileSetupComplete,
    onboardingComplete: false,
    loadOnboardingStatus: jest.fn().mockResolvedValue(undefined),
    syncProfileSetupStatus: jest.fn().mockResolvedValue(undefined),
    submitCachedOnboardingData: jest.fn().mockResolvedValue(undefined),
    setOnboardingComplete: jest.fn().mockResolvedValue(undefined),
    setProfileSetupComplete: jest.fn().mockResolvedValue(undefined),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  renderedStack = '';

  // Reset profile store to fully incomplete (no cached data)
  useProfileStore.setState({
    goalType: null,
    goalWeightKg: null,
    weeklyRateKg: null,
    gender: null,
    birthDate: null,
    heightCm: null,
    weightKg: null,
    activityLevel: null,
    dietPreference: null,
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 1. State combinations — which stack is shown
// ───────────────────────────────────────────────────────────────────────────
describe('stack selection', () => {
  it('shows OnboardingStack when user is not authenticated', () => {
    setStoreState({ isAuthenticated: false, isLoading: false, profileSetupComplete: null });

    renderScreen(<RootNavigator />);

    expect(currentStack()).toBe('OnboardingStack');
  });

  it('shows OnboardingStack when authenticated but profileSetupComplete is false', () => {
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: false });

    renderScreen(<RootNavigator />);

    expect(currentStack()).toBe('OnboardingStack');
  });

  it('shows MainStack when authenticated and profileSetupComplete is true', () => {
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: true });

    renderScreen(<RootNavigator />);

    expect(currentStack()).toBe('MainStack');
  });

  it('shows no stack (spinner) when auth is loading', () => {
    setStoreState({ isAuthenticated: false, isLoading: true, profileSetupComplete: null });

    renderScreen(<RootNavigator />);

    expect(currentStack()).toBe('');
  });

  it('shows no stack (spinner) when authenticated but profileSetupComplete is null (profile sync in-flight)', () => {
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: null });

    renderScreen(<RootNavigator />);

    expect(currentStack()).toBe('');
  });

  it('shows OnboardingStack when authenticated=false regardless of profileSetupComplete value', () => {
    // profileSetupComplete=true should not matter when not authenticated
    setStoreState({ isAuthenticated: false, isLoading: false, profileSetupComplete: true });

    renderScreen(<RootNavigator />);

    // isAuthenticated is checked first; unauthenticated path always yields OnboardingStack
    expect(currentStack()).toBe('OnboardingStack');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 2. Loading state precedence
// ───────────────────────────────────────────────────────────────────────────
describe('loading state precedence', () => {
  it('shows spinner when isLoading=true even though authenticated and profile complete', () => {
    // isLoading is checked before any routing logic in RootNavigator
    setStoreState({ isAuthenticated: true, isLoading: true, profileSetupComplete: true });

    renderScreen(<RootNavigator />);

    expect(currentStack()).toBe('');
  });

  it('shows spinner indicator component while isLoading', () => {
    setStoreState({ isAuthenticated: false, isLoading: true, profileSetupComplete: null });

    const { UNSAFE_getAllByType } = renderScreen(<RootNavigator />);

    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('shows spinner indicator component when authenticated but profile status is null', () => {
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: null });

    const { UNSAFE_getAllByType } = renderScreen(<RootNavigator />);

    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 3. State transitions — simulating the journey through the app
// ───────────────────────────────────────────────────────────────────────────
describe('state transitions', () => {
  it('transitions from spinner to OnboardingStack when auth finishes loading unauthenticated', async () => {
    setStoreState({ isAuthenticated: false, isLoading: true, profileSetupComplete: null });

    const { rerender } = renderScreen(<RootNavigator />);
    expect(currentStack()).toBe('');

    // Auth check completes — user is not logged in
    await act(async () => {
      useAuthStore.setState({ isLoading: false, isAuthenticated: false });
    });
    rerender(<RootNavigator />);

    expect(currentStack()).toBe('OnboardingStack');
  });

  it('transitions from spinner to MainStack when auth finishes and profile is complete', async () => {
    setStoreState({ isAuthenticated: false, isLoading: true, profileSetupComplete: null });

    const { rerender } = renderScreen(<RootNavigator />);
    expect(currentStack()).toBe('');

    await act(async () => {
      useAuthStore.setState({ isLoading: false, isAuthenticated: true });
      useOnboardingStore.setState({ profileSetupComplete: true });
    });
    rerender(<RootNavigator />);

    expect(currentStack()).toBe('MainStack');
  });

  it('transitions OnboardingStack → MainStack when onboarding is completed', async () => {
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: false });

    const { rerender } = renderScreen(<RootNavigator />);
    expect(currentStack()).toBe('OnboardingStack');

    // User completes onboarding; backend confirms profile setup done
    await act(async () => {
      useOnboardingStore.setState({ profileSetupComplete: true });
    });
    rerender(<RootNavigator />);

    expect(currentStack()).toBe('MainStack');
  });

  it('transitions MainStack → OnboardingStack on sign out (authentication cleared)', async () => {
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: true });

    const { rerender } = renderScreen(<RootNavigator />);
    expect(currentStack()).toBe('MainStack');

    // User signs out
    await act(async () => {
      useAuthStore.setState({ isAuthenticated: false, token: null, user: null });
      useOnboardingStore.setState({ profileSetupComplete: null });
    });
    rerender(<RootNavigator />);

    // Back to onboarding/auth flow
    expect(currentStack()).toBe('OnboardingStack');
  });

  it('shows spinner then OnboardingStack when auth resolves to authenticated but profile sync is still in-flight', async () => {
    setStoreState({ isAuthenticated: false, isLoading: true, profileSetupComplete: null });

    const { rerender } = renderScreen(<RootNavigator />);
    expect(currentStack()).toBe('');

    // Auth resolved — user authenticated, but profile sync not yet complete
    await act(async () => {
      useAuthStore.setState({ isLoading: false, isAuthenticated: true });
      // profileSetupComplete stays null — sync in-flight
    });
    rerender(<RootNavigator />);

    expect(currentStack()).toBe('');

    // Profile sync resolves — incomplete
    await act(async () => {
      useOnboardingStore.setState({ profileSetupComplete: false });
    });
    rerender(<RootNavigator />);

    expect(currentStack()).toBe('OnboardingStack');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 4. Effect: loadOnboardingStatus called on mount
// ───────────────────────────────────────────────────────────────────────────
describe('RootNavigator effects', () => {
  it('calls loadOnboardingStatus on mount', () => {
    const loadOnboardingStatus = jest.fn().mockResolvedValue(undefined);
    setStoreState({ isAuthenticated: false, isLoading: false, profileSetupComplete: false });
    useOnboardingStore.setState({ loadOnboardingStatus });

    renderScreen(<RootNavigator />);

    expect(loadOnboardingStatus).toHaveBeenCalledTimes(1);
  });

  it('calls syncProfileSetupStatus when user becomes authenticated', async () => {
    const syncProfileSetupStatus = jest.fn().mockResolvedValue(undefined);
    setStoreState({ isAuthenticated: false, isLoading: false, profileSetupComplete: null });
    useOnboardingStore.setState({ syncProfileSetupStatus });

    const { rerender } = renderScreen(<RootNavigator />);

    // User signs in
    await act(async () => {
      useAuthStore.setState({ isAuthenticated: true });
    });
    rerender(<RootNavigator />);

    expect(syncProfileSetupStatus).toHaveBeenCalled();
  });

  it('does NOT call syncProfileSetupStatus when user is not authenticated', () => {
    const syncProfileSetupStatus = jest.fn().mockResolvedValue(undefined);
    setStoreState({ isAuthenticated: false, isLoading: false, profileSetupComplete: null });
    useOnboardingStore.setState({ syncProfileSetupStatus });

    renderScreen(<RootNavigator />);

    expect(syncProfileSetupStatus).not.toHaveBeenCalled();
  });

  it('calls submitCachedOnboardingData when authenticated, profile incomplete, and profile data is complete in store', async () => {
    const submitCachedOnboardingData = jest.fn().mockResolvedValue(undefined);
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: false });
    useOnboardingStore.setState({ submitCachedOnboardingData });

    // Populate profile store so isComplete() returns true
    useProfileStore.setState({
      goalType: 'lose_fat',
      goalWeightKg: 70,
      weeklyRateKg: 0.5,
      gender: 'female',
      birthDate: new Date('1990-01-01'),
      heightCm: 165,
      weightKg: 75,
      activityLevel: 'moderately_active',
      dietPreference: 'standard',
    });

    renderScreen(<RootNavigator />);

    // Effect runs after render — wait a tick
    await act(async () => {});

    expect(submitCachedOnboardingData).toHaveBeenCalledTimes(1);
  });

  it('does NOT call submitCachedOnboardingData when profile store is incomplete', async () => {
    const submitCachedOnboardingData = jest.fn().mockResolvedValue(undefined);
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: false });
    useOnboardingStore.setState({ submitCachedOnboardingData });

    // Profile store is empty (default from beforeEach)
    renderScreen(<RootNavigator />);

    await act(async () => {});

    expect(submitCachedOnboardingData).not.toHaveBeenCalled();
  });

  it('does NOT call submitCachedOnboardingData when profileSetupComplete is true', async () => {
    const submitCachedOnboardingData = jest.fn().mockResolvedValue(undefined);
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: true });
    useOnboardingStore.setState({ submitCachedOnboardingData });

    useProfileStore.setState({
      goalType: 'lose_fat',
      goalWeightKg: 70,
      weeklyRateKg: 0.5,
      gender: 'female',
      birthDate: new Date('1990-01-01'),
      heightCm: 165,
      weightKg: 75,
      activityLevel: 'moderately_active',
      dietPreference: 'standard',
    });

    renderScreen(<RootNavigator />);

    await act(async () => {});

    // Already complete — no need to re-submit
    expect(submitCachedOnboardingData).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// 5. Edge cases
// ───────────────────────────────────────────────────────────────────────────
describe('edge cases', () => {
  it('shows OnboardingStack when token expires mid-session (isAuthenticated flips to false)', async () => {
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: true });

    const { rerender } = renderScreen(<RootNavigator />);
    expect(currentStack()).toBe('MainStack');

    // Simulate token expiry — auth store clears authentication
    await act(async () => {
      useAuthStore.setState({ isAuthenticated: false, token: null, user: null });
    });
    rerender(<RootNavigator />);

    expect(currentStack()).toBe('OnboardingStack');
  });

  it('handles profileSetupComplete transitioning null → false without showing main app', async () => {
    // Covers the case where syncProfileSetupStatus resolves with incomplete
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: null });

    const { rerender } = renderScreen(<RootNavigator />);
    expect(currentStack()).toBe('');

    await act(async () => {
      useOnboardingStore.setState({ profileSetupComplete: false });
    });
    rerender(<RootNavigator />);

    expect(currentStack()).toBe('OnboardingStack');
  });

  it('handles profileSetupComplete transitioning null → true and goes to MainStack', async () => {
    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: null });

    const { rerender } = renderScreen(<RootNavigator />);
    expect(currentStack()).toBe('');

    await act(async () => {
      useOnboardingStore.setState({ profileSetupComplete: true });
    });
    rerender(<RootNavigator />);

    expect(currentStack()).toBe('MainStack');
  });

  it('treats explicit null profileSetupComplete as loading (not same as false)', async () => {
    // null = still loading; false = loaded and not complete — different UX outcomes

    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: null });
    const { unmount: unmount1 } = renderScreen(<RootNavigator />);
    const whenNull = currentStack();
    unmount1();

    renderedStack = '';

    await act(async () => {
      setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: false });
    });
    renderScreen(<RootNavigator />);
    const whenFalse = currentStack();

    expect(whenNull).toBe(''); // spinner
    expect(whenFalse).toBe('OnboardingStack');
    expect(whenNull).not.toBe(whenFalse);
  });

  it('handles rapid auth state changes without crashing', async () => {
    setStoreState({ isAuthenticated: false, isLoading: true, profileSetupComplete: null });

    const { rerender } = renderScreen(<RootNavigator />);

    // Rapid sequence: loading → authenticated → signed out → authenticated again
    await act(async () => {
      useAuthStore.setState({ isLoading: false, isAuthenticated: true });
      useOnboardingStore.setState({ profileSetupComplete: true });
    });
    rerender(<RootNavigator />);
    expect(currentStack()).toBe('MainStack');

    await act(async () => {
      useAuthStore.setState({ isAuthenticated: false, token: null });
      useOnboardingStore.setState({ profileSetupComplete: null });
    });
    rerender(<RootNavigator />);
    expect(currentStack()).toBe('OnboardingStack');

    await act(async () => {
      useAuthStore.setState({ isAuthenticated: true });
      useOnboardingStore.setState({ profileSetupComplete: true });
    });
    rerender(<RootNavigator />);
    expect(currentStack()).toBe('MainStack');
  });

  it('shows OnboardingStack when network error during profile sync causes profileSetupComplete to default to false', async () => {
    // syncProfileSetupStatus defaults to false on network error (backend is source of truth)
    const syncProfileSetupStatus = jest.fn().mockImplementation(async () => {
      // Simulates what the real store does: network error → set false
      useOnboardingStore.setState({ profileSetupComplete: false });
    });

    setStoreState({ isAuthenticated: true, isLoading: false, profileSetupComplete: null });
    useOnboardingStore.setState({ syncProfileSetupStatus });

    const { rerender } = renderScreen(<RootNavigator />);

    await act(async () => {
      await syncProfileSetupStatus();
    });
    rerender(<RootNavigator />);

    expect(currentStack()).toBe('OnboardingStack');
  });

  it('keeps showing spinner during auth load regardless of previous profile state', () => {
    // Guard: isLoading must always trump everything else
    setStoreState({ isAuthenticated: true, isLoading: true, profileSetupComplete: true });

    renderScreen(<RootNavigator />);

    expect(currentStack()).toBe('');
  });
});
