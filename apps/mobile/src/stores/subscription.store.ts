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
  /** True once the first fetchStatus call has resolved (success or failure) */
  initialLoadDone: boolean;
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
  /**
   * Show the paywall modal overlay. No-op if user is already pro.
   */
  showPaywall: () => void;
  /** Hide the paywall modal overlay. */
  hidePaywall: () => void;
  /** Resets to default free state — call on sign-out. */
  reset: () => void;
  /** Start listening for AppState foreground transitions to refresh status. */
  startForegroundListener: () => () => void;
  /**
   * Resolves once the initial fetchStatus has completed (success or failure).
   * Use this to avoid gating features on stale default state.
   */
  waitForInitialLoad: () => Promise<void>;
  /**
   * Ensures the user's entitlement is fresh before gating.
   * Checks store → waits for in-flight load → checks RC directly → calls verify.
   * Returns true if user has pro access.
   */
  ensureEntitlement: () => Promise<boolean>;
}

const DEFAULT: Pick<
  SubscriptionState,
  'tier' | 'status' | 'currentPeriodEnd' | 'isLoading' | 'paywallVisible' | 'initialLoadDone'
> = {
  tier: 'free',
  status: 'active',
  currentPeriodEnd: null,
  isLoading: false,
  initialLoadDone: false,
  paywallVisible: false,
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  ...DEFAULT,

  fetchStatus: async () => {
    set({ isLoading: true });
    try {
      const res = await subscriptionsApi.getStatus();
      const data: SubscriptionStatus = res.data;

      // If server still says free, check RevenueCat directly. If RC says pro,
      // call verify endpoint to sync the DB immediately (closes the webhook lag window).
      if (data.tier === 'free') {
        const rcPro = await get().checkRcEntitlement();
        if (rcPro) {
          try {
            const verifyRes = await subscriptionsApi.verify();
            if (verifyRes.data.tier === 'pro') {
              set({ tier: 'pro', status: 'active', currentPeriodEnd: data.currentPeriodEnd });
              return;
            }
          } catch {
            // verify failed — still set optimistic state from RC
            set({ tier: 'pro', status: 'active', currentPeriodEnd: data.currentPeriodEnd });
            return;
          }
        }
      }

      set({ tier: data.tier, status: data.status, currentPeriodEnd: data.currentPeriodEnd });
    } catch {
      // Server unreachable — check RC as fallback so we don't block paid users
      try {
        const rcPro = await get().checkRcEntitlement();
        if (rcPro) {
          set({ tier: 'pro', status: 'active' });
          // Fire-and-forget server sync attempt
          subscriptionsApi.verify().catch(() => {});
          return;
        }
      } catch {
        // RC also failed — keep existing state
      }
    } finally {
      set({ isLoading: false, initialLoadDone: true });
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

  showPaywall: () => {
    // Never show paywall if already known as pro
    if (get().tier === 'pro') return;
    set({ paywallVisible: true });
  },
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

  waitForInitialLoad: () => {
    const state = get();
    if (state.initialLoadDone) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const unsub = useSubscriptionStore.subscribe((s) => {
        if (s.initialLoadDone) {
          unsub();
          resolve();
        }
      });
    });
  },

  ensureEntitlement: async () => {
    // 1. Already known as pro
    if (get().tier === 'pro') return true;

    // 2. Initial load in flight — wait for it
    if (!get().initialLoadDone) {
      await get().waitForInitialLoad();
      if (get().tier === 'pro') return true;
    }

    // 3. Store says free — but maybe RC has the entitlement (webhook lag).
    //    Do a direct RC check + server verify.
    const rcPro = await get().checkRcEntitlement();
    if (rcPro) {
      set({ tier: 'pro', status: 'active' });
      // Sync server in background
      subscriptionsApi.verify().catch(() => {});
      return true;
    }

    // 4. Genuinely free
    return false;
  },
}));
