import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui/Button';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { requestAndRegisterPushToken } from '../../hooks/usePushNotifications';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'NotificationPermission'>;

const FEATURE_KEYS = [
  {
    icon: 'sunny-outline' as const,
    titleKey: 'onboarding.notifMorningTitle',
    descKey: 'onboarding.notifMorningDesc',
  },
  {
    icon: 'water-outline' as const,
    titleKey: 'onboarding.notifWaterTitle',
    descKey: 'onboarding.notifWaterDesc',
  },
  {
    icon: 'bar-chart-outline' as const,
    titleKey: 'onboarding.notifProgressTitle',
    descKey: 'onboarding.notifProgressDesc',
  },
  {
    icon: 'trophy-outline' as const,
    titleKey: 'onboarding.notifStreakTitle',
    descKey: 'onboarding.notifStreakDesc',
  },
] as const;

export function NotificationPermissionScreen(_props: Props) {
  const [loading, setLoading] = useState(false);
  const setProfileSetupComplete = useOnboardingStore((s) => s.setProfileSetupComplete);
  const c = useColors();
  const { t } = useLocale();

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
        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          className="items-center pt-4 pb-2"
        >
          <View
            className="w-24 h-24 rounded-[28px] items-center justify-center mb-7"
            style={{ backgroundColor: c.card }}
          >
            <Ionicons name="notifications" size={44} color={c.text} />
          </View>

          <Text
            className="text-3xl font-sans-bold text-text text-center mb-3"
            accessibilityRole="header"
          >
            {t('onboarding.notifTitle')}
          </Text>
          <Text className="text-base text-text-secondary text-center leading-6 px-2">
            {t('onboarding.notifSubtitle')}
          </Text>
        </Animated.View>

        {/* Feature list */}
        <Animated.View entering={FadeInDown.duration(400).delay(250)} className="gap-3 my-2">
          {FEATURE_KEYS.map((f) => (
            <View
              key={f.titleKey}
              className="flex-row items-center rounded-2xl bg-surface-card border border-surface-border p-4"
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: `${c.primary}1a` }}
              >
                <Ionicons name={f.icon} size={20} color={c.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-semibold text-text text-sm">{t(f.titleKey)}</Text>
                <Text className="text-xs text-text-tertiary mt-0.5">{t(f.descKey)}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)} className="gap-3 pt-2">
          <Button
            onPress={handleAllow}
            size="lg"
            loading={loading}
            className="w-full"
            accessibilityLabel={t('onboarding.notifAllow')}
          >
            {t('onboarding.notifAllow')}
          </Button>
          <Pressable
            onPress={handleSkip}
            className="items-center py-3 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.notifSkip')}
          >
            <Text className="text-sm text-text-tertiary font-sans-medium">
              {t('onboarding.notifSkip')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
