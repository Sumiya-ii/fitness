import { useNavigation } from '@react-navigation/native';
import { useSubscriptionStore } from '../stores/subscription.store';
import { PaywallContent } from '../components/PaywallContent';

export function SubscriptionScreen() {
  const navigation = useNavigation();
  const tier = useSubscriptionStore((s) => s.tier);

  // If user is already Pro and navigates here from Settings, just go back
  if (tier === 'pro') {
    navigation.goBack();
    return null;
  }

  return <PaywallContent onClose={() => navigation.goBack()} />;
}
