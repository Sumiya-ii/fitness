/**
 * LogScreen tests — verifies pro-gated features and recent meals display.
 *
 * Key scenarios:
 * - Camera action requires pro (show paywall if free)
 * - Recent meals display correctly
 * - Empty state when no recents
 * - All action buttons are rendered
 * - Search bar is rendered
 *
 * Note: UI text is rendered in Mongolian (default locale).
 */
import { renderScreen, screen, waitFor, fireEvent } from '../helpers/render';
import { useSubscriptionStore } from '../../stores/subscription.store';

const mockGetRecents = jest.fn();

jest.mock('../../api/meals', () => ({
  mealsApi: {
    getRecents: (...args: unknown[]) => mockGetRecents(...args),
    quickAdd: jest.fn().mockResolvedValue({ data: null }),
  },
}));

jest.mock('../../stores/dashboard.store', () => ({
  useDashboardStore: jest.fn((fn: (s: unknown) => unknown) => fn({ fetchDashboard: jest.fn() })),
}));

// Mock subscriptions API for the store
jest.mock('../../api/subscriptions', () => ({
  subscriptionsApi: {
    getStatus: jest
      .fn()
      .mockResolvedValue({ data: { tier: 'free', status: 'active', currentPeriodEnd: null } }),
    verify: jest.fn().mockResolvedValue({ data: { tier: 'free' } }),
  },
}));

import { LogScreen } from '../../screens/LogScreen';
import { mockNavigation } from '../helpers/render';

beforeEach(() => {
  jest.clearAllMocks();
  useSubscriptionStore.setState({
    tier: 'free',
    status: 'active',
    currentPeriodEnd: null,
    isLoading: false,
    paywallVisible: false,
  });
  mockGetRecents.mockResolvedValue({ data: [] });
});

describe('LogScreen', () => {
  describe('Recent meals', () => {
    it('shows empty state when no recent meals', async () => {
      mockGetRecents.mockResolvedValue({ data: [] });

      renderScreen(<LogScreen />);

      // t('logging.noRecents') = 'Түүх алга'
      await waitFor(() => {
        expect(screen.getByText('Түүх алга')).toBeTruthy();
      });
    });

    it('shows recent meals when available', async () => {
      mockGetRecents.mockResolvedValue({
        data: [
          {
            foodId: '1',
            name: 'Chicken Breast',
            lastCalories: 250,
            lastProtein: 40,
            lastUsedAt: '2026-03-27',
          },
          {
            foodId: '2',
            name: 'Brown Rice',
            lastCalories: 180,
            lastProtein: 4,
            lastUsedAt: '2026-03-27',
          },
        ],
      });

      renderScreen(<LogScreen />);

      await waitFor(() => {
        expect(screen.getByText('Chicken Breast')).toBeTruthy();
        expect(screen.getByText('Brown Rice')).toBeTruthy();
      });
    });
  });

  describe('Pro-gated features', () => {
    it('shows paywall when free user taps camera', async () => {
      useSubscriptionStore.setState({ tier: 'free' });
      // ensureEntitlement returns false
      const state = useSubscriptionStore.getState();
      jest.spyOn(useSubscriptionStore, 'getState').mockReturnValue({
        ...state,
        ensureEntitlement: jest.fn().mockResolvedValue(false),
      });

      mockGetRecents.mockResolvedValue({ data: [] });
      renderScreen(<LogScreen />);

      // t('logging.noRecents') = 'Түүх алга'
      await waitFor(() => {
        expect(screen.getByText('Түүх алга')).toBeTruthy();
      });

      // t('logging.photo') = 'Зураг'
      const photoButton = screen.getByText('Зураг');
      fireEvent.press(photoButton);

      // Should NOT navigate to PhotoLog
      await waitFor(() => {
        expect(mockNavigation.navigate).not.toHaveBeenCalledWith('PhotoLog');
      });
    });

    it('allows pro user to access camera', async () => {
      useSubscriptionStore.setState({ tier: 'pro' });

      mockGetRecents.mockResolvedValue({ data: [] });
      renderScreen(<LogScreen />);

      // t('logging.noRecents') = 'Түүх алга'
      await waitFor(() => {
        expect(screen.getByText('Түүх алга')).toBeTruthy();
      });

      // t('logging.photo') = 'Зураг'
      const photoButton = screen.getByText('Зураг');
      fireEvent.press(photoButton);

      await waitFor(() => {
        expect(mockNavigation.navigate).toHaveBeenCalledWith('PhotoLog');
      });
    });
  });

  describe('Action buttons', () => {
    it('renders default action buttons', async () => {
      mockGetRecents.mockResolvedValue({ data: [] });
      renderScreen(<LogScreen />);

      // In-app voice was removed from v1; voice logging happens through Telegram.
      await waitFor(() => {
        expect(screen.getByText('Зураг')).toBeTruthy();
        expect(screen.getByText('Шууд')).toBeTruthy();
      });
      expect(screen.queryByText('Скан')).toBeNull();
    });

    it('renders search bar', async () => {
      mockGetRecents.mockResolvedValue({ data: [] });
      renderScreen(<LogScreen />);

      // t('logging.findFoods') = 'Хоол хайх'
      await waitFor(() => {
        expect(screen.getByText('Хоол хайх')).toBeTruthy();
      });
    });
  });
});
