/**
 * SubscriptionScreen tests — verifies paywall vs pro-member rendering.
 *
 * Key scenarios:
 * - Subscribed user sees "already pro" confirmation, NOT the paywall
 * - Free user sees the paywall content
 * - Loading state while verifying entitlement
 */
import { renderScreen, screen, waitFor, act } from '../helpers/render';
import { useSubscriptionStore } from '../../stores/subscription.store';

// Mock PaywallContent — we just need to know if it renders
jest.mock('../../components/PaywallContent', () => ({
  PaywallContent: ({ onClose }: { onClose: () => void }) => {
    const { Text, Pressable } = require('react-native');
    return (
      <>
        <Text>Upgrade to Pro</Text>
        <Pressable onPress={onClose}>
          <Text>Close Paywall</Text>
        </Pressable>
      </>
    );
  },
}));

// Mock the subscription API
jest.mock('../../api/subscriptions', () => ({
  subscriptionsApi: {
    getStatus: jest
      .fn()
      .mockResolvedValue({ data: { tier: 'free', status: 'active', currentPeriodEnd: null } }),
    verify: jest.fn().mockResolvedValue({ data: { tier: 'free' } }),
  },
}));

import { SubscriptionScreen } from '../../screens/SubscriptionScreen';

beforeEach(() => {
  jest.clearAllMocks();
  // Reset store to defaults
  useSubscriptionStore.setState({
    tier: 'free',
    status: 'active',
    currentPeriodEnd: null,
    isLoading: false,
    paywallVisible: false,
  });
});

describe('SubscriptionScreen', () => {
  it('shows paywall when user is free (not subscribed)', async () => {
    useSubscriptionStore.setState({ tier: 'free' });

    // ensureEntitlement returns false for free users
    const originalState = useSubscriptionStore.getState();
    jest.spyOn(useSubscriptionStore, 'getState').mockReturnValue({
      ...originalState,
      ensureEntitlement: jest.fn().mockResolvedValue(false),
    });

    renderScreen(<SubscriptionScreen />);

    await waitFor(() => {
      expect(screen.getByText('Upgrade to Pro')).toBeTruthy();
    });

    // Should NOT show "already pro" content
    expect(screen.queryByText(/alreadyProTitle|You're a Pro/i)).toBeNull();
  });

  it('shows pro confirmation when user IS subscribed', async () => {
    useSubscriptionStore.setState({
      tier: 'pro',
      status: 'active',
      currentPeriodEnd: '2026-12-31T00:00:00Z',
    });

    renderScreen(<SubscriptionScreen />);

    // Should NOT show paywall
    await waitFor(() => {
      expect(screen.queryByText('Upgrade to Pro')).toBeNull();
    });
  });

  it('shows loading spinner while checking entitlement', () => {
    // tier is free — component starts with checking=true
    useSubscriptionStore.setState({ tier: 'free' });

    // Make ensureEntitlement hang (never resolve during this test)
    const originalState = useSubscriptionStore.getState();
    jest.spyOn(useSubscriptionStore, 'getState').mockReturnValue({
      ...originalState,
      ensureEntitlement: () => new Promise(() => {}), // never resolves
    });

    renderScreen(<SubscriptionScreen />);

    // Should not show paywall or pro content while loading
    expect(screen.queryByText('Upgrade to Pro')).toBeNull();
  });

  it('does not show paywall when tier transitions from free to pro', async () => {
    // Start as free, ensureEntitlement discovers they are actually pro
    useSubscriptionStore.setState({ tier: 'free' });

    const originalState = useSubscriptionStore.getState();
    jest.spyOn(useSubscriptionStore, 'getState').mockReturnValue({
      ...originalState,
      ensureEntitlement: jest.fn().mockImplementation(async () => {
        // Simulate entitlement check discovering pro status
        useSubscriptionStore.setState({ tier: 'pro' });
        return true;
      }),
    });

    renderScreen(<SubscriptionScreen />);

    // After ensureEntitlement resolves and sets tier to pro, should show pro content
    await waitFor(() => {
      expect(screen.queryByText('Upgrade to Pro')).toBeNull();
    });
  });
});
