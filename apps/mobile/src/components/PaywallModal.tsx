import { Modal } from 'react-native';
import { useSubscriptionStore } from '../stores/subscription.store';
import { PaywallContent } from './PaywallContent';

/**
 * Global paywall overlay triggered whenever a 403 "Pro subscription required"
 * error is returned by the API. Rendered in App.tsx so it can appear from
 * any screen without requiring navigation.
 */
export function PaywallModal() {
  const paywallVisible = useSubscriptionStore((s) => s.paywallVisible);
  const hidePaywall = useSubscriptionStore((s) => s.hidePaywall);

  return (
    <Modal
      visible={paywallVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={hidePaywall}
    >
      <PaywallContent onClose={hidePaywall} />
    </Modal>
  );
}
