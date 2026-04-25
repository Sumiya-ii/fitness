import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, AppState, type AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Linking, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui/Button';
import { api } from '../../api';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ConnectTelegram'>;

const TELEGRAM_BOT_USERNAME = (process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'CoachBot').replace(
  /^@/,
  '',
);

export function ConnectTelegramScreen({ navigation }: Props) {
  const c = useColors();
  const { t } = useLocale();
  const [connecting, setConnecting] = useState(false);
  const [pendingLink, setPendingLink] = useState(false);
  const [linked, setLinked] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<{ linked: boolean }>('/telegram/status');
      if (res.linked) {
        setLinked(true);
        setPendingLink(false);
      }
    } catch {
      // Network error — keep previous state
    }
  }, []);

  // Re-check link status when user returns from Telegram
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active' && pendingLink) {
        void fetchStatus();
      }
      appStateRef.current = next;
    });
    return () => subscription.remove();
  }, [fetchStatus, pendingLink]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.post<{ code: string }>('/telegram/link-code', {});
      const deepLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${res.code}`;
      setPendingLink(true);
      await Linking.openURL(deepLink);
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('telegram.connectError'));
    } finally {
      setConnecting(false);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('NotificationPermission');
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
            style={{ backgroundColor: c.primary }}
          >
            <Ionicons name="paper-plane" size={44} color={c.onPrimary} />
          </View>

          <Text
            className="text-3xl font-sans-bold text-text text-center mb-3"
            accessibilityRole="header"
          >
            {t('onboarding.connectTelegramTitle')}
          </Text>
          <Text className="text-base text-text-secondary text-center leading-6 px-2">
            {t('onboarding.connectTelegramSubtitle')}
          </Text>
        </Animated.View>

        {/* How-it-works steps */}
        <Animated.View entering={FadeInDown.duration(400).delay(250)} className="gap-3 my-2">
          {(
            [
              {
                icon: 'mic-outline' as const,
                titleKey: 'onboarding.connectTelegramStep1Title',
                descKey: 'onboarding.connectTelegramStep1Desc',
              },
              {
                icon: 'chatbubbles-outline' as const,
                titleKey: 'onboarding.connectTelegramStep2Title',
                descKey: 'onboarding.connectTelegramStep2Desc',
              },
              {
                icon: 'bar-chart-outline' as const,
                titleKey: 'onboarding.connectTelegramStep3Title',
                descKey: 'onboarding.connectTelegramStep3Desc',
              },
            ] as const
          ).map((step) => (
            <View
              key={step.titleKey}
              className="flex-row items-center rounded-2xl bg-surface-card border border-surface-border p-4"
            >
              <View
                className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                style={{ backgroundColor: `${c.primary}1a` }}
              >
                <Ionicons name={step.icon} size={20} color={c.primary} />
              </View>
              <View className="flex-1">
                <Text className="font-sans-semibold text-text text-sm">{t(step.titleKey)}</Text>
                <Text className="text-xs text-text-tertiary mt-0.5">{t(step.descKey)}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* CTAs */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)} className="gap-3 pt-2">
          {linked ? (
            <>
              <View className="flex-row items-center justify-center gap-2 mb-1">
                <Ionicons name="checkmark-circle" size={20} color={c.success} />
                <Text className="text-sm font-sans-semibold" style={{ color: c.success }}>
                  {t('telegram.connected')}
                </Text>
              </View>
              <Button onPress={handleContinue} size="lg" className="w-full">
                {t('onboarding.continue')}
              </Button>
            </>
          ) : pendingLink ? (
            <>
              <Button
                onPress={() => void fetchStatus()}
                size="lg"
                className="w-full"
                accessibilityLabel={t('telegram.checkStatus')}
              >
                {t('telegram.checkStatus')}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onPress={() => void handleConnect()}
                loading={connecting}
                accessibilityLabel={t('telegram.openAgain')}
              >
                {t('telegram.openAgain')}
              </Button>
            </>
          ) : (
            <Button
              onPress={() => void handleConnect()}
              size="lg"
              loading={connecting}
              className="w-full"
              accessibilityLabel={t('onboarding.connectTelegramButton')}
            >
              {t('onboarding.connectTelegramButton')}
            </Button>
          )}

          <Pressable
            onPress={handleContinue}
            className="items-center py-3 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.connectTelegramSkip')}
          >
            <Text className="text-sm text-text-tertiary font-sans-medium">
              {t('onboarding.connectTelegramSkip')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
