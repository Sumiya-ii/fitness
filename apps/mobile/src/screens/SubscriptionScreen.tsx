// TODO(v2): Add QPay payment option for Mongolian users alongside RevenueCat
import { useEffect, useState } from 'react';
import { View, Text, Linking, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Button } from '../components/ui';
import { useSubscriptionStore } from '../stores/subscription.store';
import { PaywallContent } from '../components/PaywallContent';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

export function SubscriptionScreen() {
  const navigation = useNavigation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const tier = useSubscriptionStore((s) => s.tier);
  const currentPeriodEnd = useSubscriptionStore((s) => s.currentPeriodEnd);
  const { t } = useLocale();
  const [checking, setChecking] = useState(tier !== 'pro');

  // If store says free, verify entitlement before showing paywall
  useEffect(() => {
    if (tier === 'pro') {
      setChecking(false);
      return;
    }
    let cancelled = false;
    useSubscriptionStore
      .getState()
      .ensureEntitlement()
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tier]);

  if (checking) {
    return (
      <View className="flex-1 bg-surface-app items-center justify-center">
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (tier !== 'pro') {
    return <PaywallContent onClose={() => navigation.goBack()} />;
  }

  const formattedEnd = currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : null;

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
        </View>

        <View
          className="flex-1 items-center justify-center px-8"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <Animated.View entering={FadeInDown.duration(400).springify()} className="items-center">
            {/* Success icon */}
            <View
              className="h-20 w-20 rounded-3xl items-center justify-center mb-6"
              style={{ backgroundColor: `${c.success}20` }}
            >
              <Ionicons name="checkmark-circle" size={44} color={c.success} />
            </View>

            <Text className="text-2xl leading-8 font-sans-bold text-text text-center mb-3">
              {t('subscription.alreadyProTitle')}
            </Text>
            <Text
              className="text-base leading-6 font-sans-medium text-center mb-2"
              style={{ color: c.textSecondary }}
            >
              {t('subscription.alreadyProDesc')}
            </Text>

            {formattedEnd ? (
              <Text
                className="text-sm leading-5 font-sans-medium text-center mb-8"
                style={{ color: c.textTertiary }}
              >
                {t('subscription.iapDisclaimer')}
              </Text>
            ) : (
              <View className="mb-8" />
            )}
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(400).delay(150).springify()}
            className="w-full"
          >
            <Button
              variant="secondary"
              size="lg"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (Platform.OS === 'ios') {
                  Linking.openURL('https://apps.apple.com/account/subscriptions');
                } else {
                  Linking.openURL('https://play.google.com/store/account/subscriptions');
                }
              }}
              accessibilityLabel={t('settings.manage')}
            >
              {t('settings.manage')}
            </Button>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
