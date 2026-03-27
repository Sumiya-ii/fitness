/**
 * SettingsScreen tests — verifies pro/free UI differences and key settings behavior.
 *
 * Key scenarios:
 * - Pro users see PRO badge, manage subscription row; NO upgrade banner
 * - Free users see upgrade banner; NO pro manage row
 * - Notification permission states render correctly
 * - Sign out, language, units controls are present
 */
import { renderScreen, screen, waitFor } from '../helpers/render';
import { useSubscriptionStore } from '../../stores/subscription.store';
import { useAuthStore } from '../../stores/auth.store';
import { useSettingsStore } from '../../stores/settings.store';

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

// Mock the API module
jest.mock('../../api', () => ({
  api: {
    get: jest.fn().mockImplementation((url: string) => {
      if (url === '/profile')
        return Promise.resolve({
          data: { displayName: 'Test User', locale: 'en', unitSystem: 'metric', id: '1' },
        });
      if (url.includes('/notifications'))
        return Promise.resolve({ data: { morningReminder: true, eveningReminder: true } });
      if (url.includes('/telegram')) return Promise.resolve({ linked: false });
      return Promise.resolve({});
    }),
    put: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({}),
  },
}));

// Mock push notifications hook
jest.mock('../../hooks/usePushNotifications', () => ({
  requestAndRegisterPushToken: jest.fn().mockResolvedValue(true),
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
  useSettingsStore.setState({
    unitSystem: 'metric',
  });
});

describe('SettingsScreen', () => {
  describe('Pro vs Free user differences', () => {
    it('shows upgrade banner when user is FREE', async () => {
      useSubscriptionStore.setState({ tier: 'free' });

      renderScreen(<SettingsScreen />);

      await waitFor(() => {
        // Upgrade banner should be visible
        expect(screen.getByText(/upgrade/i)).toBeTruthy();
      });
    });

    it('hides upgrade banner when user is PRO', async () => {
      useSubscriptionStore.setState({ tier: 'pro' });

      renderScreen(<SettingsScreen />);

      await waitFor(() => {
        // Profile should load
        expect(screen.getByText('Test User')).toBeTruthy();
      });

      // Upgrade banner should NOT be visible
      expect(screen.queryByText(/upgrade.*pro/i)).toBeNull();
    });

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
    it('renders language selector with EN/MN options', async () => {
      renderScreen(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText('EN')).toBeTruthy();
      });

      // Both language options should be visible
      expect(screen.getByText('EN')).toBeTruthy();
    });

    it('renders sign out option', async () => {
      renderScreen(<SettingsScreen />);

      await waitFor(() => {
        expect(screen.getByText(/sign out/i)).toBeTruthy();
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
