import { create } from 'zustand';
import Purchases from 'react-native-purchases';
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
   * for gated endpoints). Call on app resume and after any purchase.
   */
  fetchStatus: () => Promise<void>;
  /**
   * Checks the RevenueCat customer info client-side for immediate UI feedback.
   * Returns true if the 'pro' entitlement is active.
   */
  checkRcEntitlement: () => Promise<boolean>;
  /** Show the paywall modal overlay. */
  showPaywall: () => void;
  /** Hide the paywall modal overlay. */
  hidePaywall: () => void;
  /** Resets to default free state — call on sign-out. */
  reset: () => void;
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

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  ...DEFAULT,

  fetchStatus: async () => {
    set({ isLoading: true });
    try {
      const res = await subscriptionsApi.getStatus();
      const data: SubscriptionStatus = res.data;
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

  showPaywall: () => set({ paywallVisible: true }),
  hidePaywall: () => set({ paywallVisible: false }),

  reset: () => set(DEFAULT),
}));
