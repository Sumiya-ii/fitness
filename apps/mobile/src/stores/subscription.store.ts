import { create } from 'zustand';
import { AppState, type AppStateStatus } from 'react-native';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import { subscriptionsApi, type SubscriptionStatus } from '../api/subscriptions';

interface SubscriptionState {
  tier: 'free' | 'pro';
  status: string;
  currentPeriodEnd: string | null;
  /** True while an API fetch or RC check is in flight */
  isLoading: boolean;
  /** Controls the global paywall modal overlay */
  paywallVisible: boolean;
  /**
   * Fetches subscription status from the API (server is the source of truth
   * for gated endpoints). Falls back to RevenueCat entitlement if server
   * hasn't received the webhook yet (e.g. right after purchase).
   */
  fetchStatus: () => Promise<void>;
  /**
   * Checks the RevenueCat customer info client-side for immediate UI feedback.
   * Returns true if the 'pro' entitlement is active.
   */
  checkRcEntitlement: () => Promise<boolean>;
  /**
   * Called by the RevenueCat CustomerInfo listener when entitlements change.
   * Updates the store immediately for responsive UI, then syncs with server.
   */
  handleCustomerInfoUpdate: (info: CustomerInfo) => void;
  /** Show the paywall modal overlay. */
  showPaywall: () => void;
  /** Hide the paywall modal overlay. */
  hidePaywall: () => void;
  /** Resets to default free state — call on sign-out. */
  reset: () => void;
  /** Start listening for AppState foreground transitions to refresh status. */
  startForegroundListener: () => () => void;
}

const DEFAULT: Pick<
  SubscriptionState,
  'tier' | 'status' | 'currentPeriodEnd' | 'isLoading' | 'paywallVisible'
> = {
  tier: 'free',
  status: 'active',
  currentPeriodEnd: null,
  isLoading: false,
  paywallVisible: false,
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  ...DEFAULT,

  fetchStatus: async () => {
    set({ isLoading: true });
    try {
      const res = await subscriptionsApi.getStatus();
      const data: SubscriptionStatus = res.data;

      // If server still says free, check RevenueCat directly as a fallback.
      // This covers the window between purchase completion and webhook arrival.
      if (data.tier === 'free') {
        const rcPro = await get().checkRcEntitlement();
        if (rcPro) {
          set({ tier: 'pro', status: 'active', currentPeriodEnd: data.currentPeriodEnd });
          return;
        }
      }

      set({ tier: data.tier, status: data.status, currentPeriodEnd: data.currentPeriodEnd });
    } catch {
      // Silent — keep existing state; error surface is up to the calling screen
    } finally {
      set({ isLoading: false });
    }
  },

  checkRcEntitlement: async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return typeof customerInfo.entitlements.active['pro'] !== 'undefined';
    } catch {
      return false;
    }
  },

  handleCustomerInfoUpdate: (info: CustomerInfo) => {
    const rcPro = typeof info.entitlements.active['pro'] !== 'undefined';
    if (rcPro && get().tier !== 'pro') {
      // Entitlement appeared — update UI immediately, then confirm with server
      set({ tier: 'pro', status: 'active' });
      void get().fetchStatus();
    } else if (!rcPro && get().tier === 'pro') {
      // Entitlement gone — re-check with server (source of truth)
      void get().fetchStatus();
    }
  },

  showPaywall: () => set({ paywallVisible: true }),
  hidePaywall: () => set({ paywallVisible: false }),

  reset: () => set(DEFAULT),

  startForegroundListener: () => {
    let previousState: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (previousState.match(/inactive|background/) && nextState === 'active') {
        // App came to foreground — refresh subscription status
        void get().fetchStatus();
      }
      previousState = nextState;
    });
    return () => subscription.remove();
  },
}));
