/**
 * SettingsScreen tests — verifies pro/free UI differences and key settings behavior.
 *
 * Key scenarios:
 * - Pro users see PRO badge; free users do not
 * - Sign out option is present
 * - User profile name and initials display correctly
 */
import { renderScreen, screen, waitFor } from '../helpers/render';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { useAuthStore } from '../../stores/auth.store';

// Mock firebase auth (loaded transitively via auth.store)
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

jest.mock('../../lib/firebase', () => ({
  getFirebaseAuth: jest.fn(() => ({ currentUser: null })),
}));

// Mock the API module
jest.mock('../../api', () => ({
  api: {
    get: jest.fn().mockImplementation((url: string) => {
      if (url === '/profile')
        return Promise.resolve({
          data: { displayName: 'Test User', locale: 'en', unitSystem: 'metric', id: '1' },
        });
      if (url.includes('/telegram')) return Promise.resolve({ linked: false });
      return Promise.resolve({});
    }),
    put: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({}),
  },
  setTokenRefreshCallback: jest.fn(),
}));

import { SettingsScreen } from '../../screens/SettingsScreen';

beforeEach(() => {
  jest.clearAllMocks();
  useSubscriptionStore.setState({
    tier: 'free',
    status: 'active',
    currentPeriodEnd: null,
    isLoading: false,
    paywallVisible: false,
  });
  useAuthStore.setState({
    isAuthenticated: true,
    isLoading: false,
    signOut: jest.fn(),
  });
});

describe('SettingsScreen', () => {
  describe('Pro vs Free user differences', () => {
    it('shows PRO badge next to name when subscribed', async () => {
      useSubscriptionStore.setState({ tier: 'pro' });

      renderScreen(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('PRO')).toBeTruthy();
      });
    });

    it('does not show PRO badge for free users', async () => {
      useSubscriptionStore.setState({ tier: 'free' });

      renderScreen(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeTruthy();
      });

      expect(screen.queryByText('PRO')).toBeNull();
    });
  });

  describe('Core settings controls', () => {
    it('renders sign out option', async () => {
      renderScreen(<SettingsScreen />);

      // Sign out label is in Mongolian: 'Гарах'
      await waitFor(() => {
        expect(screen.getByText('Гарах')).toBeTruthy();
      });
    });

    it('displays user profile name from API', async () => {
      renderScreen(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeTruthy();
      });
    });

    it('shows initials in avatar', async () => {
      renderScreen(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('TU')).toBeTruthy();
      });
    });
  });
});
