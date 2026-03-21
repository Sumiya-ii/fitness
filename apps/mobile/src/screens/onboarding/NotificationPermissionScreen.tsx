import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui/Button';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { requestAndRegisterPushToken } from '../../hooks/usePushNotifications';

type Props = NativeStackScreenProps<SetupStackParamList, 'NotificationPermission'>;

const FEATURES = [
  {
    icon: 'sunny-outline' as const,
    color: '#f59e0b',
    bg: '#f59e0b1a',
    title: 'Morning check-ins',
    desc: 'Start each day with your Coach',
  },
  {
    icon: 'water-outline' as const,
    color: '#3b82f6',
    bg: '#3b82f61a',
    title: 'Water & meal nudges',
    desc: 'Smart reminders when you need them',
  },
  {
    icon: 'bar-chart-outline' as const,
    color: '#8b5cf6',
    bg: '#8b5cf61a',
    title: 'Daily progress feedback',
    desc: 'Personalized insights every evening',
  },
  {
    icon: 'trophy-outline' as const,
    color: '#10b981',
    bg: '#10b9811a',
    title: 'Streak celebrations',
    desc: 'Your Coach cheers you on',
  },
] as const;

export function NotificationPermissionScreen(_props: Props) {
  const [loading, setLoading] = useState(false);
  const setProfileSetupComplete = useOnboardingStore((s) => s.setProfileSetupComplete);

  const handleAllow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await requestAndRegisterPushToken();
    } finally {
      setLoading(false);
      await setProfileSetupComplete();
    }
  };

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setProfileSetupComplete();
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-app">
      <View className="flex-1 px-6 justify-between py-6">
        {/* Top illustration */}
        <View className="items-center pt-4 pb-2">
          <LinearGradient
            colors={['#1f2028', '#15161d']}
            style={{
              width: 96,
              height: 96,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 28,
            }}
          >
            <Ionicons name="notifications" size={44} color="#ffffff" />
          </LinearGradient>

          <Text className="text-3xl font-sans-bold text-text text-center mb-3">
            Your Coach needs{'\n'}to reach you
          </Text>
          <Text className="text-base text-text-secondary text-center leading-6 px-2">
            Enable notifications so your Coach can check in, remind you to log meals, and celebrate
            your wins.
          </Text>
        </View>

        {/* Feature list */}
        <View className="gap-3 my-2">
          {FEATURES.map((f) => (
            <View
              key={f.title}
              className="flex-row items-center rounded-2xl bg-surface-card border border-surface-border p-4"
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: f.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name={f.icon} size={20} color={f.color} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-semibold text-text text-sm">{f.title}</Text>
                <Text className="text-xs text-text-tertiary mt-0.5">{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View className="gap-3 pt-2">
          <Button onPress={handleAllow} size="lg" loading={loading} className="w-full">
            Turn On Notifications
          </Button>
          <Pressable onPress={handleSkip} className="items-center py-3">
            <Text className="text-sm text-text-tertiary font-sans-medium">Not now</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
