/**
 * Unit tests for RootNavigator (C-058).
 * Real E2E requires Detox/Maestro setup.
 */

// Mock react-native first (hoisted)
jest.mock('react-native', () => ({
  View: ({ children }: { children?: unknown }) => children,
  ActivityIndicator: () => null,
  useEffect: (fn: () => void) => fn(),
}));

// Mock stores
jest.mock('../stores/auth.store', () => ({
  useAuthStore: (fn: (s: unknown) => unknown) => {
    const state = { isAuthenticated: false, isLoading: false };
    return fn(state);
  },
}));

jest.mock('../stores/onboarding.store', () => ({
  useOnboardingStore: (fn: (s: unknown) => unknown) => {
    const state = {
      onboardingComplete: true,
      profileSetupComplete: true,
      loadOnboardingStatus: jest.fn(),
    };
    return fn(state);
  },
}));

// Mock navigation stacks
jest.mock('../navigation/AuthStack', () => ({ AuthStack: () => null }));
jest.mock('../navigation/SetupStack', () => ({ SetupStack: () => null }));
jest.mock('../navigation/MainStack', () => ({ MainStack: () => null }));

import { RootNavigator } from '../navigation/RootNavigator';

describe('RootNavigator', () => {
  it('is a function component', () => {
    expect(typeof RootNavigator).toBe('function');
  });

  it('can be imported without throwing', () => {
    expect(RootNavigator).toBeDefined();
  });
});
