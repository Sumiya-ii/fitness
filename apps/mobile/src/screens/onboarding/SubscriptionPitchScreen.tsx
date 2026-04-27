import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { PaywallContent } from '../../components/PaywallContent';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SubscriptionPitch'>;

export function SubscriptionPitchScreen({ navigation }: Props) {
  const goNext = () => {
    navigation.navigate('ConnectTelegram');
  };

  return <PaywallContent onClose={goNext} onPurchaseSuccess={goNext} onSkip={goNext} />;
}
