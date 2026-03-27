import { useSubscriptionStore } from '../stores/subscription.store';

/**
 * Hook that provides a gate for pro-only features.
 * Call `await requirePro()` before navigating to a pro feature —
 * it returns `true` if the user is subscribed, or shows the
 * paywall and returns `false` if they are not.
 *
 * Unlike the previous sync version, this waits for in-flight loads
 * and checks RevenueCat directly before blocking — so a paid user
 * is never shown the paywall due to stale default state.
 */
export function useProGate() {
  const tier = useSubscriptionStore((s) => s.tier);
  const showPaywall = useSubscriptionStore((s) => s.showPaywall);

  const requirePro = async (): Promise<boolean> => {
    // Fast path — store already says pro
    if (tier === 'pro') return true;

    // Thorough check: wait for load, check RC, verify with server
    const entitled = await useSubscriptionStore.getState().ensureEntitlement();
    if (entitled) return true;

    showPaywall();
    return false;
  };

  return { isPro: tier === 'pro', requirePro };
}
