/**
 * useProGate / subscription store gating tests — verifies the pro feature gating logic.
 *
 * Key scenarios:
 * - Paywall shows for free users, not for pro users
 * - Store reset returns to free defaults
 * - showPaywall is a no-op when already pro
 */
import { useSubscriptionStore } from '../../stores/subscription.store';

// Mock subscriptions API
jest.mock('../../api/subscriptions', () => ({
  subscriptionsApi: {
    getStatus: jest
      .fn()
      .mockResolvedValue({ data: { tier: 'free', status: 'active', currentPeriodEnd: null } }),
    verify: jest.fn().mockResolvedValue({ data: { tier: 'free' } }),
  },
}));

beforeEach(() => {
  jest.restoreAllMocks();
  // Full reset to ensure clean state — reset() uses the store's own method
  useSubscriptionStore.getState().reset();
});

describe('Subscription store gating', () => {
  it('defaults to free tier', () => {
    const state = useSubscriptionStore.getState();
    expect(state.tier).toBe('free');
    expect(state.paywallVisible).toBe(false);
  });

  it('showPaywall sets paywallVisible when free', () => {
    const store = useSubscriptionStore;
    expect(store.getState().tier).toBe('free');
    expect(store.getState().paywallVisible).toBe(false);

    store.getState().showPaywall();
    expect(store.getState().paywallVisible).toBe(true);
  });

  it('hidePaywall clears paywallVisible', () => {
    useSubscriptionStore.setState({ paywallVisible: true });
    useSubscriptionStore.getState().hidePaywall();
    expect(useSubscriptionStore.getState().paywallVisible).toBe(false);
  });

  it('showPaywall is a no-op when already pro', () => {
    useSubscriptionStore.setState({ tier: 'pro', paywallVisible: false });

    useSubscriptionStore.getState().showPaywall();
    expect(useSubscriptionStore.getState().paywallVisible).toBe(false);
  });

  it('reset returns store to free defaults', () => {
    useSubscriptionStore.setState({
      tier: 'pro',
      status: 'active',
      paywallVisible: true,
      currentPeriodEnd: '2026-12-31',
    });

    useSubscriptionStore.getState().reset();

    const state = useSubscriptionStore.getState();
    expect(state.tier).toBe('free');
    expect(state.paywallVisible).toBe(false);
    expect(state.currentPeriodEnd).toBeNull();
  });

  it('pro tier is detected correctly after setState', () => {
    useSubscriptionStore.setState({ tier: 'pro' });
    expect(useSubscriptionStore.getState().tier).toBe('pro');
  });

  it('fetchStatus updates tier from API response', async () => {
    const { subscriptionsApi } = require('../../api/subscriptions');
    subscriptionsApi.getStatus.mockResolvedValue({
      data: { tier: 'pro', status: 'active', currentPeriodEnd: '2026-12-31' },
    });

    expect(useSubscriptionStore.getState().tier).toBe('free');

    await useSubscriptionStore.getState().fetchStatus();

    expect(useSubscriptionStore.getState().tier).toBe('pro');
    expect(useSubscriptionStore.getState().currentPeriodEnd).toBe('2026-12-31');
  });
});
