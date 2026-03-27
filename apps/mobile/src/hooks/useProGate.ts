import { useSubscriptionStore } from '../stores/subscription.store';

/**
 * Hook that provides a gate for pro-only features.
 * Call `requirePro()` before navigating to a pro feature —
 * it returns `true` if the user is subscribed, or shows the
 * paywall and returns `false` if they are not.
 */
export function useProGate() {
  const tier = useSubscriptionStore((s) => s.tier);
  const showPaywall = useSubscriptionStore((s) => s.showPaywall);

  const requirePro = (): boolean => {
    if (tier === 'pro') return true;
    showPaywall();
    return false;
  };

  return { isPro: tier === 'pro', requirePro };
}
