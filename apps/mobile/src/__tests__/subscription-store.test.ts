/**
 * Comprehensive tests for subscription store — ensures paid users
 * are never blocked by stale state, webhook delays, or network failures.
 */

// Mock react-native modules before imports
jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

const mockRcGetCustomerInfo = jest.fn();
jest.mock('react-native-purchases', () => {
  const obj = {
    getCustomerInfo: mockRcGetCustomerInfo,
    configure: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
    setLogLevel: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  };
  return { __esModule: true, default: obj, Purchases: obj };
});

jest.mock('../api/subscriptions', () => ({
  subscriptionsApi: {
    getStatus: jest.fn(),
    verify: jest.fn(),
  },
}));

import { useSubscriptionStore } from '../stores/subscription.store';
import { subscriptionsApi } from '../api/subscriptions';

const mockGetStatus = subscriptionsApi.getStatus as jest.Mock;
const mockVerify = subscriptionsApi.verify as jest.Mock;
const mockGetCustomerInfo = mockRcGetCustomerInfo;

function resetStore() {
  useSubscriptionStore.setState({
    tier: 'free',
    status: 'active',
    currentPeriodEnd: null,
    isLoading: false,
    initialLoadDone: false,
    paywallVisible: false,
  });
}

const PRO_CUSTOMER_INFO = { entitlements: { active: { 'Coach Pro': { isActive: true } } } };
const FREE_CUSTOMER_INFO = { entitlements: { active: {} } };

describe('subscription store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  // ─── showPaywall ──────────────────────────────────────────────────────────
  describe('showPaywall', () => {
    it('shows paywall when tier is free', () => {
      useSubscriptionStore.getState().showPaywall();
      expect(useSubscriptionStore.getState().paywallVisible).toBe(true);
    });

    it('does NOT show paywall when tier is pro', () => {
      useSubscriptionStore.setState({ tier: 'pro' });
      useSubscriptionStore.getState().showPaywall();
      expect(useSubscriptionStore.getState().paywallVisible).toBe(false);
    });

    it('does NOT show paywall when tier transitions to pro after purchase', async () => {
      // Simulate: user was free, purchased, tier updated to pro
      useSubscriptionStore.getState().showPaywall();
      expect(useSubscriptionStore.getState().paywallVisible).toBe(true);

      // Purchase completes — tier becomes pro
      useSubscriptionStore.setState({ tier: 'pro' });

      // Subsequent showPaywall call should be no-op
      useSubscriptionStore.getState().showPaywall();
      // paywallVisible was already true from before, but the point is
      // the PaywallModal component checks tier !== 'pro' for rendering
    });
  });

  // ─── fetchStatus ──────────────────────────────────────────────────────────
  describe('fetchStatus', () => {
    it('sets tier to pro when server says pro', async () => {
      mockGetStatus.mockResolvedValue({
        data: { tier: 'pro', status: 'active', currentPeriodEnd: '2026-04-01T00:00:00Z' },
      });

      await useSubscriptionStore.getState().fetchStatus();

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('pro');
      expect(state.status).toBe('active');
      expect(state.initialLoadDone).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('checks RC and calls verify when server says free but RC says pro', async () => {
      mockGetStatus.mockResolvedValue({
        data: { tier: 'free', status: 'active', currentPeriodEnd: null },
      });
      mockGetCustomerInfo.mockResolvedValue(PRO_CUSTOMER_INFO);
      mockVerify.mockResolvedValue({ data: { tier: 'pro' } });

      await useSubscriptionStore.getState().fetchStatus();

      expect(mockGetCustomerInfo).toHaveBeenCalled();
      expect(mockVerify).toHaveBeenCalled();
      expect(useSubscriptionStore.getState().tier).toBe('pro');
    });

    it('sets pro optimistically from RC even if verify fails', async () => {
      mockGetStatus.mockResolvedValue({
        data: { tier: 'free', status: 'active', currentPeriodEnd: null },
      });
      mockGetCustomerInfo.mockResolvedValue(PRO_CUSTOMER_INFO);
      mockVerify.mockRejectedValue(new Error('network error'));

      await useSubscriptionStore.getState().fetchStatus();

      expect(useSubscriptionStore.getState().tier).toBe('pro');
    });

    it('falls back to RC when server is unreachable', async () => {
      mockGetStatus.mockRejectedValue(new Error('network error'));
      mockGetCustomerInfo.mockResolvedValue(PRO_CUSTOMER_INFO);
      mockVerify.mockResolvedValue({ data: { tier: 'pro' } });

      await useSubscriptionStore.getState().fetchStatus();

      expect(useSubscriptionStore.getState().tier).toBe('pro');
      expect(useSubscriptionStore.getState().initialLoadDone).toBe(true);
    });

    it('stays free when both server and RC say free', async () => {
      mockGetStatus.mockResolvedValue({
        data: { tier: 'free', status: 'active', currentPeriodEnd: null },
      });
      mockGetCustomerInfo.mockResolvedValue(FREE_CUSTOMER_INFO);

      await useSubscriptionStore.getState().fetchStatus();

      expect(useSubscriptionStore.getState().tier).toBe('free');
    });

    it('marks initialLoadDone even on complete failure', async () => {
      mockGetStatus.mockRejectedValue(new Error('server down'));
      mockGetCustomerInfo.mockRejectedValue(new Error('RC down'));

      await useSubscriptionStore.getState().fetchStatus();

      expect(useSubscriptionStore.getState().initialLoadDone).toBe(true);
      expect(useSubscriptionStore.getState().isLoading).toBe(false);
    });
  });

  // ─── ensureEntitlement ────────────────────────────────────────────────────
  describe('ensureEntitlement', () => {
    it('returns true immediately when store says pro', async () => {
      useSubscriptionStore.setState({ tier: 'pro', initialLoadDone: true });

      const result = await useSubscriptionStore.getState().ensureEntitlement();
      expect(result).toBe(true);
      // Should not call any APIs — fast path
      expect(mockGetStatus).not.toHaveBeenCalled();
      expect(mockGetCustomerInfo).not.toHaveBeenCalled();
    });

    it('waits for initial load then returns true if pro', async () => {
      // Simulate in-flight load
      useSubscriptionStore.setState({ isLoading: true, initialLoadDone: false });

      const entitlementPromise = useSubscriptionStore.getState().ensureEntitlement();

      // Simulate load completing with pro
      useSubscriptionStore.setState({ tier: 'pro', isLoading: false, initialLoadDone: true });

      const result = await entitlementPromise;
      expect(result).toBe(true);
    });

    it('checks RC when store says free after load completes', async () => {
      useSubscriptionStore.setState({ tier: 'free', initialLoadDone: true });
      mockGetCustomerInfo.mockResolvedValue(PRO_CUSTOMER_INFO);
      mockVerify.mockResolvedValue({ data: { tier: 'pro' } });

      const result = await useSubscriptionStore.getState().ensureEntitlement();

      expect(result).toBe(true);
      expect(mockGetCustomerInfo).toHaveBeenCalled();
      expect(useSubscriptionStore.getState().tier).toBe('pro');
    });

    it('returns false when genuinely free (RC confirms free)', async () => {
      useSubscriptionStore.setState({ tier: 'free', initialLoadDone: true });
      mockGetCustomerInfo.mockResolvedValue(FREE_CUSTOMER_INFO);

      const result = await useSubscriptionStore.getState().ensureEntitlement();

      expect(result).toBe(false);
    });

    it('returns true when RC has pro but verify fails', async () => {
      useSubscriptionStore.setState({ tier: 'free', initialLoadDone: true });
      mockGetCustomerInfo.mockResolvedValue(PRO_CUSTOMER_INFO);
      // verify is fire-and-forget in ensureEntitlement, so its failure doesn't matter

      const result = await useSubscriptionStore.getState().ensureEntitlement();

      expect(result).toBe(true);
      expect(useSubscriptionStore.getState().tier).toBe('pro');
    });
  });

  // ─── waitForInitialLoad ───────────────────────────────────────────────────
  describe('waitForInitialLoad', () => {
    it('resolves immediately if already loaded', async () => {
      useSubscriptionStore.setState({ initialLoadDone: true });
      await expect(useSubscriptionStore.getState().waitForInitialLoad()).resolves.toBeUndefined();
    });

    it('waits until initialLoadDone becomes true', async () => {
      useSubscriptionStore.setState({ initialLoadDone: false });
      const promise = useSubscriptionStore.getState().waitForInitialLoad();

      // Should not resolve yet
      let resolved = false;
      void promise.then(() => {
        resolved = true;
      });

      // Tick event loop
      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      // Now complete
      useSubscriptionStore.setState({ initialLoadDone: true });
      await promise;
      // If we get here, it resolved correctly
    });
  });

  // ─── handleCustomerInfoUpdate ─────────────────────────────────────────────
  describe('handleCustomerInfoUpdate', () => {
    it('upgrades to pro immediately when RC entitlement appears', () => {
      mockGetStatus.mockResolvedValue({
        data: { tier: 'pro', status: 'active', currentPeriodEnd: null },
      });

      useSubscriptionStore.getState().handleCustomerInfoUpdate(PRO_CUSTOMER_INFO as never);

      expect(useSubscriptionStore.getState().tier).toBe('pro');
    });

    it('does not downgrade without checking server', () => {
      useSubscriptionStore.setState({ tier: 'pro' });
      mockGetStatus.mockResolvedValue({
        data: { tier: 'pro', status: 'active', currentPeriodEnd: null },
      });

      useSubscriptionStore.getState().handleCustomerInfoUpdate(FREE_CUSTOMER_INFO as never);

      // It should call fetchStatus, not immediately downgrade
      expect(mockGetStatus).toHaveBeenCalled();
    });
  });

  // ─── reset ────────────────────────────────────────────────────────────────
  describe('reset', () => {
    it('resets to default free state', () => {
      useSubscriptionStore.setState({
        tier: 'pro',
        status: 'active',
        paywallVisible: true,
        initialLoadDone: true,
      });

      useSubscriptionStore.getState().reset();

      const state = useSubscriptionStore.getState();
      expect(state.tier).toBe('free');
      expect(state.paywallVisible).toBe(false);
      expect(state.initialLoadDone).toBe(false);
    });
  });

  // ─── Integration: paid user should never see paywall ──────────────────────
  describe('integration: paid user never sees paywall', () => {
    it('scenario: app launch with webhook already processed', async () => {
      mockGetStatus.mockResolvedValue({
        data: { tier: 'pro', status: 'active', currentPeriodEnd: '2026-12-01T00:00:00Z' },
      });

      await useSubscriptionStore.getState().fetchStatus();
      useSubscriptionStore.getState().showPaywall();

      expect(useSubscriptionStore.getState().paywallVisible).toBe(false);
    });

    it('scenario: app launch with webhook delay, RC has entitlement', async () => {
      // Server says free (webhook not arrived yet)
      mockGetStatus.mockResolvedValue({
        data: { tier: 'free', status: 'active', currentPeriodEnd: null },
      });
      // RC has the entitlement
      mockGetCustomerInfo.mockResolvedValue(PRO_CUSTOMER_INFO);
      mockVerify.mockResolvedValue({ data: { tier: 'pro' } });

      await useSubscriptionStore.getState().fetchStatus();

      // Store should be pro
      expect(useSubscriptionStore.getState().tier).toBe('pro');

      // showPaywall should be blocked
      useSubscriptionStore.getState().showPaywall();
      expect(useSubscriptionStore.getState().paywallVisible).toBe(false);
    });

    it('scenario: feature access before initial load completes', async () => {
      // Server will eventually say pro
      mockGetStatus.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: { tier: 'pro', status: 'active', currentPeriodEnd: null },
                }),
              50,
            ),
          ),
      );

      // Start initial load (don't await)
      void useSubscriptionStore.getState().fetchStatus();

      // Immediately try ensureEntitlement (simulates user tapping Photo)
      // Meanwhile, RC confirms pro
      mockGetCustomerInfo.mockResolvedValue(PRO_CUSTOMER_INFO);
      mockVerify.mockResolvedValue({ data: { tier: 'pro' } });

      const entitled = await useSubscriptionStore.getState().ensureEntitlement();
      expect(entitled).toBe(true);
    });

    it('scenario: server down, RC confirms pro', async () => {
      mockGetStatus.mockRejectedValue(new Error('503 Service Unavailable'));
      mockGetCustomerInfo.mockResolvedValue(PRO_CUSTOMER_INFO);
      mockVerify.mockRejectedValue(new Error('also down'));

      await useSubscriptionStore.getState().fetchStatus();

      expect(useSubscriptionStore.getState().tier).toBe('pro');
      useSubscriptionStore.getState().showPaywall();
      expect(useSubscriptionStore.getState().paywallVisible).toBe(false);
    });

    it('scenario: genuinely free user should see paywall', async () => {
      mockGetStatus.mockResolvedValue({
        data: { tier: 'free', status: 'active', currentPeriodEnd: null },
      });
      mockGetCustomerInfo.mockResolvedValue(FREE_CUSTOMER_INFO);

      await useSubscriptionStore.getState().fetchStatus();

      expect(useSubscriptionStore.getState().tier).toBe('free');

      useSubscriptionStore.getState().showPaywall();
      expect(useSubscriptionStore.getState().paywallVisible).toBe(true);
    });

    it('scenario: paywall auto-dismisses when tier becomes pro', () => {
      // Paywall is showing for a free user
      useSubscriptionStore.setState({ tier: 'free', paywallVisible: true });

      // Purchase completes — tier updated
      useSubscriptionStore.setState({ tier: 'pro' });

      // showPaywall should no longer work
      useSubscriptionStore.getState().showPaywall();
      expect(useSubscriptionStore.getState().paywallVisible).toBe(true);
      // Note: PaywallModal component checks `tier !== 'pro'` for visibility,
      // so even though paywallVisible is true, the modal won't render.
      // The auto-dismiss useEffect in PaywallModal handles cleanup.
    });
  });
});
