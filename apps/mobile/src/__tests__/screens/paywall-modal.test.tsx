/**
 * PaywallModal tests — verifies the global paywall modal behavior.
 *
 * Key scenarios:
 * - Modal is hidden when paywallVisible is false
 * - Modal is hidden when user is pro (even if paywallVisible is true)
 * - Modal shows when paywallVisible is true AND tier is free
 * - Auto-dismisses when tier transitions to pro
 */
import { renderScreen, screen, waitFor, act } from '../helpers/render';
import { useSubscriptionStore } from '../../stores/subscription.store';

// Mock PaywallContent
jest.mock('../../components/PaywallContent', () => ({
  PaywallContent: ({ onClose }: { onClose: () => void }) => {
    const { Text, Pressable } = require('react-native');
    return (
      <>
        <Text>Paywall Content</Text>
        <Pressable onPress={onClose}>
          <Text>Close</Text>
        </Pressable>
      </>
    );
  },
}));

// Mock subscriptions API
jest.mock('../../api/subscriptions', () => ({
  subscriptionsApi: {
    getStatus: jest
      .fn()
      .mockResolvedValue({ data: { tier: 'free', status: 'active', currentPeriodEnd: null } }),
    verify: jest.fn().mockResolvedValue({ data: { tier: 'free' } }),
  },
}));

import { PaywallModal } from '../../components/PaywallModal';

beforeEach(() => {
  jest.clearAllMocks();
  useSubscriptionStore.setState({
    tier: 'free',
    status: 'active',
    currentPeriodEnd: null,
    isLoading: false,
    paywallVisible: false,
  });
});

describe('PaywallModal', () => {
  it('is hidden when paywallVisible is false', () => {
    useSubscriptionStore.setState({ paywallVisible: false, tier: 'free' });

    renderScreen(<PaywallModal />);

    expect(screen.queryByText('Paywall Content')).toBeNull();
  });

  it('shows paywall when paywallVisible is true and tier is free', () => {
    useSubscriptionStore.setState({ paywallVisible: true, tier: 'free' });

    renderScreen(<PaywallModal />);

    expect(screen.getByText('Paywall Content')).toBeTruthy();
  });

  it('hides paywall when user is pro even if paywallVisible is true', () => {
    useSubscriptionStore.setState({ paywallVisible: true, tier: 'pro' });

    renderScreen(<PaywallModal />);

    expect(screen.queryByText('Paywall Content')).toBeNull();
  });

  it('auto-dismisses when tier transitions from free to pro', async () => {
    useSubscriptionStore.setState({ paywallVisible: true, tier: 'free' });

    renderScreen(<PaywallModal />);

    // Paywall should initially be visible
    expect(screen.getByText('Paywall Content')).toBeTruthy();

    // Simulate purchase completing — tier becomes pro
    act(() => {
      useSubscriptionStore.setState({ tier: 'pro' });
    });

    // Paywall should be dismissed
    await waitFor(() => {
      expect(screen.queryByText('Paywall Content')).toBeNull();
    });
  });

  it('calls hidePaywall when tier becomes pro while visible', async () => {
    const hidePaywall = jest.fn();
    useSubscriptionStore.setState({
      paywallVisible: true,
      tier: 'free',
      hidePaywall,
    });

    renderScreen(<PaywallModal />);

    // Transition to pro
    act(() => {
      useSubscriptionStore.setState({ tier: 'pro' });
    });

    await waitFor(() => {
      expect(hidePaywall).toHaveBeenCalled();
    });
  });
});
