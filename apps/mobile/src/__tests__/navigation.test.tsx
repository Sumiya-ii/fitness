/**
 * Unit tests for RootNavigator (C-058).
 * Superseded by screens/root-navigator.test.tsx for comprehensive routing tests.
 * This file kept for backwards compatibility — just verifies import works.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../services/firebase-auth.service', () => ({
  configureGoogleSignIn: jest.fn(),
  subscribeToTokenRefresh: jest.fn(() => jest.fn()),
  signInWithEmailPassword: jest.fn(),
  signUpWithEmailPassword: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  sendPasswordReset: jest.fn(),
  signOutFirebase: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

jest.mock('../navigation/OnboardingStack', () => ({ OnboardingStack: () => null }));
jest.mock('../navigation/MainStack', () => ({ MainStack: () => null }));
jest.mock('../hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }));
jest.mock('../hooks/useSyncQueue', () => ({ useSyncQueue: jest.fn() }));

import { RootNavigator } from '../navigation/RootNavigator';

describe('RootNavigator', () => {
  it('can be imported without throwing', () => {
    expect(RootNavigator).toBeDefined();
  });
});
