import { useEffect } from 'react';
import { Modal } from 'react-native';
import { useSubscriptionStore } from '../stores/subscription.store';
import { PaywallContent } from './PaywallContent';

/**
 * Global paywall overlay triggered whenever a premium feature is accessed
 * by a non-pro user. Rendered in App.tsx so it can appear from any screen
 * without requiring navigation.
 *
 * Safety: never renders when tier is 'pro', and auto-dismisses if the tier
 * transitions to 'pro' while the modal is visible (e.g. webhook arrives).
 */
export function PaywallModal() {
  const paywallVisible = useSubscriptionStore((s) => s.paywallVisible);
  const hidePaywall = useSubscriptionStore((s) => s.hidePaywall);
  const tier = useSubscriptionStore((s) => s.tier);

  // Auto-dismiss if user becomes pro while paywall is showing
  useEffect(() => {
    if (paywallVisible && tier === 'pro') {
      hidePaywall();
    }
  }, [paywallVisible, tier, hidePaywall]);

  return (
    <Modal
      visible={paywallVisible && tier !== 'pro'}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={hidePaywall}
    >
      <PaywallContent onClose={hidePaywall} />
    </Modal>
  );
}
