/**
 * RootNavigator tests — verifies auth/onboarding routing logic.
 *
 * Key scenarios:
 * - Unauthenticated user sees AuthStack
 * - Authenticated but not onboarded user sees SetupStack
 * - Fully onboarded user sees MainStack
 * - Loading states show spinner
 */

// Track which stack renders
let renderedStack = '';

jest.mock('../../navigation/AuthStack', () => ({
  AuthStack: () => {
    renderedStack = 'AuthStack';
    return null;
  },
}));
jest.mock('../../navigation/SetupStack', () => ({
  SetupStack: () => {
    renderedStack = 'SetupStack';
    return null;
  },
}));
jest.mock('../../navigation/MainStack', () => ({
  MainStack: () => {
    renderedStack = 'MainStack';
    return null;
  },
}));

jest.mock('../../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
  signInWithEmailPassword: jest.fn(),
  signUpWithEmailPassword: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  sendPasswordReset: jest.fn(),
  signOutFirebase: jest.fn(),
}));

jest.mock('../../hooks/usePushNotifications', () => ({
  usePushNotifications: jest.fn(),
}));

jest.mock('../../hooks/useSyncQueue', () => ({
  useSyncQueue: jest.fn(),
}));

import { renderScreen, act } from '../helpers/render';
import { useAuthStore } from '../../stores/auth.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { RootNavigator } from '../../navigation/RootNavigator';

beforeEach(() => {
  jest.clearAllMocks();
  renderedStack = '';
});

describe('RootNavigator', () => {
  it('shows AuthStack when user is NOT authenticated', () => {
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: false,
    });
    useOnboardingStore.setState({
      profileSetupComplete: null,
      loadOnboardingStatus: jest.fn(),
      syncProfileSetupStatus: jest.fn(),
    });

    renderScreen(<RootNavigator />);

    expect(renderedStack).toBe('AuthStack');
  });

  it('shows SetupStack when authenticated but profile not complete', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
    });
    useOnboardingStore.setState({
      profileSetupComplete: false,
      loadOnboardingStatus: jest.fn(),
      syncProfileSetupStatus: jest.fn().mockResolvedValue(undefined),
    });

    renderScreen(<RootNavigator />);

    expect(renderedStack).toBe('SetupStack');
  });

  it('shows MainStack when authenticated AND profile is complete', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
    });
    useOnboardingStore.setState({
      profileSetupComplete: true,
      loadOnboardingStatus: jest.fn(),
      syncProfileSetupStatus: jest.fn().mockResolvedValue(undefined),
    });

    renderScreen(<RootNavigator />);

    expect(renderedStack).toBe('MainStack');
  });

  it('shows nothing useful (spinner) while auth is loading', () => {
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: true,
    });
    useOnboardingStore.setState({
      profileSetupComplete: null,
      loadOnboardingStatus: jest.fn(),
      syncProfileSetupStatus: jest.fn(),
    });

    renderScreen(<RootNavigator />);

    // Neither stack should render
    expect(renderedStack).toBe('');
  });

  it('shows spinner when authenticated but profileSetupComplete is null (loading)', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
    });
    useOnboardingStore.setState({
      profileSetupComplete: null,
      loadOnboardingStatus: jest.fn(),
      syncProfileSetupStatus: jest.fn().mockResolvedValue(undefined),
    });

    renderScreen(<RootNavigator />);

    // profileSetupComplete is null = still loading, so no stack renders
    expect(renderedStack).toBe('');
  });
});
