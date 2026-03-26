import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Purchases, { PurchasesPackage, PURCHASES_ERROR_CODE } from 'react-native-purchases';
import { BackButton, Button, Badge } from '../components/ui';
import { useSubscriptionStore } from '../stores/subscription.store';
import { useLocale } from '../i18n';

type IoniconName = keyof typeof Ionicons.glyphMap;

const FEATURE_ICONS: IoniconName[] = [
  'camera-outline',
  'mic-outline',
  'paper-plane-outline',
  'analytics-outline',
  'headset-outline',
];

export function SubscriptionScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const { tier, fetchStatus } = useSubscriptionStore();

  const [offerings, setOfferings] = useState<{
    monthly: PurchasesPackage | null;
    annual: PurchasesPackage | null;
  }>({ monthly: null, annual: null });
  const [selectedPkg, setSelectedPkg] = useState<'annual' | 'monthly'>('annual');
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const loadOfferings = useCallback(async () => {
    setLoadingOfferings(true);
    try {
      const result = await Purchases.getOfferings();
      const current = result.current;
      setOfferings({
        monthly: current?.monthly ?? null,
        annual: current?.annual ?? null,
      });
    } catch {
      // Offerings unavailable (simulator / no network) — screen still renders
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const activePkg = selectedPkg === 'annual' ? offerings.annual : offerings.monthly;

  const handlePurchase = async () => {
    if (!activePkg) {
      Alert.alert(t('subscription.unavailableTitle'), t('subscription.unavailableDesc'));
      return;
    }
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(activePkg);
      const isPro = typeof customerInfo.entitlements.active['pro'] !== 'undefined';
      if (isPro) {
        // Sync server-side state so the guard reflects the new entitlement
        await fetchStatus();
        setPurchaseSuccess(true);
      }
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      // PURCHASE_CANCELLED_ERROR — user tapped cancel in the StoreKit sheet; not an error
      if (code !== PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        Alert.alert(t('subscription.purchaseErrorTitle'), t('subscription.purchaseErrorDesc'));
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPro = typeof customerInfo.entitlements.active['pro'] !== 'undefined';
      if (isPro) {
        await fetchStatus();
        Alert.alert(t('subscription.restoreSuccessTitle'), t('subscription.restoreSuccessDesc'));
      } else {
        Alert.alert(t('subscription.noActiveTitle'), t('subscription.noActiveDesc'));
      }
    } catch {
      Alert.alert(t('subscription.restoreErrorTitle'), t('subscription.restoreErrorDesc'));
    } finally {
      setRestoring(false);
    }
  };

  const handleLegalLink = async (kind: 'terms' | 'privacy') => {
    const url =
      kind === 'terms'
        ? process.env.EXPO_PUBLIC_TERMS_URL?.trim()
        : process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // noop
    }
  };

  // ── Already subscribed ──────────────────────────────────────────────────
  if (tier === 'pro' && !purchaseSuccess) {
    return (
      <View className="flex-1 bg-surface-app">
        <SafeAreaView edges={['top']} className="flex-1">
          <View className="flex-row items-center px-4 py-3">
            <BackButton />
            <Text className="flex-1 ml-3 text-xl font-sans-bold text-text">
              {t('subscription.title')}
            </Text>
          </View>
          <View className="flex-1 items-center justify-center px-6">
            <View className="h-20 w-20 rounded-full bg-primary-500/20 items-center justify-center mb-5">
              <Ionicons name="diamond" size={40} color="#059669" />
            </View>
            <Text className="text-2xl font-sans-bold text-text text-center mb-2">
              {t('subscription.alreadyProTitle')}
            </Text>
            <Text className="text-sm text-text-secondary text-center mb-8">
              {t('subscription.alreadyProDesc')}
            </Text>
            <Button variant="primary" size="lg" onPress={() => navigation.goBack()}>
              {t('common.done')}
            </Button>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Purchase success ─────────────────────────────────────────────────────
  if (purchaseSuccess) {
    return (
      <View className="flex-1 bg-surface-app items-center justify-center px-6">
        <SafeAreaView className="items-center">
          <View className="h-24 w-24 rounded-full bg-primary-500/20 items-center justify-center mb-6">
            <Ionicons name="checkmark-circle" size={64} color="#059669" />
          </View>
          <Text className="text-2xl font-sans-bold text-text text-center mb-2">
            {t('subscription.successTitle')}
          </Text>
          <Text className="text-base text-text-secondary text-center mb-8">
            {t('subscription.successDesc')}
          </Text>
          <Button variant="primary" size="lg" onPress={() => navigation.goBack()}>
            {t('subscription.successCta')}
          </Button>
        </SafeAreaView>
      </View>
    );
  }

  // ── Main paywall ─────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="flex-row items-center px-4 py-3">
          <BackButton />
          <Text className="flex-1 ml-3 text-xl font-sans-bold text-text">Coach Pro</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <Animated.View entering={FadeInDown.duration(400)} className="px-4 mt-2">
            <LinearGradient
              colors={['#059669', '#1f2028', '#2a2b35']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="overflow-hidden rounded-3xl p-6 items-center"
            >
              <View className="h-16 w-16 rounded-2xl bg-white/20 items-center justify-center mb-3">
                <Ionicons name="diamond" size={32} color="#ffffff" />
              </View>
              <Text className="text-2xl font-sans-bold text-white">Coach Pro</Text>
              <Text className="mt-1 text-center text-white/70 text-sm">
                {t('subscription.heroSubtitle')}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Features */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="px-4 mt-6">
            <Text className="text-lg font-sans-semibold text-text mb-3">
              {t('subscription.featuresTitle')}
            </Text>
            <View className="rounded-2xl bg-surface-card border border-surface-border p-4">
              {(t('subscription.features') as string[]).map((label: string, i: number) => (
                <View key={label}>
                  <View className="flex-row items-center gap-3 py-3">
                    <View className="h-9 w-9 rounded-xl bg-primary-500/15 items-center justify-center">
                      <Ionicons
                        name={FEATURE_ICONS[i] ?? 'checkmark-outline'}
                        size={18}
                        color="#059669"
                      />
                    </View>
                    <Text className="flex-1 font-sans-medium text-text">{label}</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#059669" />
                  </View>
                  {i < (t('subscription.features') as string[]).length - 1 && (
                    <View className="h-px bg-surface-secondary" />
                  )}
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Plans */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="px-4 mt-6">
            <Text className="text-lg font-sans-semibold text-text mb-3">
              {t('subscription.choosePlan')}
            </Text>

            {loadingOfferings ? (
              <View className="items-center py-8">
                <ActivityIndicator size="large" />
              </View>
            ) : (
              <View className="gap-3">
                {/* Annual */}
                {offerings.annual && (
                  <Pressable
                    onPress={() => setSelectedPkg('annual')}
                    className={`rounded-2xl border p-4 ${
                      selectedPkg === 'annual'
                        ? 'bg-primary-500/10 border-primary-500'
                        : 'bg-surface-card border-surface-border'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View>
                        <View className="flex-row items-center gap-2">
                          <Text className="font-sans-semibold text-text text-base">
                            {t('subscription.annual')}
                          </Text>
                          <Badge variant="success">{t('subscription.annualSavings')}</Badge>
                        </View>
                        <Text className="text-sm text-text-secondary mt-1">
                          {t('subscription.annualPerMonth', {
                            price: offerings.annual.product.priceString,
                          })}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-sans-bold text-text">
                          {offerings.annual.product.priceString}
                        </Text>
                        <Text className="text-xs text-text-secondary">
                          {t('subscription.perYear')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )}

                {/* Monthly */}
                {offerings.monthly && (
                  <Pressable
                    onPress={() => setSelectedPkg('monthly')}
                    className={`rounded-2xl border p-4 ${
                      selectedPkg === 'monthly'
                        ? 'bg-primary-500/10 border-primary-500'
                        : 'bg-surface-card border-surface-border'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="font-sans-semibold text-text text-base">
                          {t('subscription.monthly')}
                        </Text>
                        <Text className="text-sm text-text-secondary mt-1">
                          {t('subscription.billedMonthly')}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-sans-bold text-text">
                          {offerings.monthly.product.priceString}
                        </Text>
                        <Text className="text-xs text-text-secondary">
                          {t('subscription.perMonth')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )}

                {/* Fallback when offerings could not be loaded */}
                {!offerings.annual && !offerings.monthly && (
                  <View className="rounded-2xl bg-surface-card border border-surface-border p-6 items-center">
                    <Text className="text-text-secondary text-sm text-center">
                      {t('subscription.offersUnavailable')}
                    </Text>
                    <Button variant="outline" size="sm" onPress={loadOfferings} className="mt-3">
                      {t('common.retry')}
                    </Button>
                  </View>
                )}
              </View>
            )}
          </Animated.View>

          {/* CTA */}
          <View className="px-4 mt-6 gap-3">
            <Button
              variant="primary"
              size="lg"
              loading={purchasing}
              disabled={!activePkg || loadingOfferings}
              onPress={handlePurchase}
            >
              {t('subscription.subscribe')}
            </Button>

            <Button variant="ghost" size="md" loading={restoring} onPress={handleRestore}>
              {t('subscription.restore')}
            </Button>

            <Text className="text-xs text-text-tertiary text-center px-4">
              {t('subscription.iapDisclaimer')}
            </Text>

            <View className="flex-row flex-wrap justify-center gap-4 mt-2">
              <Pressable onPress={() => handleLegalLink('terms')}>
                <Text className="text-xs text-text-tertiary">{t('auth.termsOfService')}</Text>
              </Pressable>
              <Pressable onPress={() => handleLegalLink('privacy')}>
                <Text className="text-xs text-text-tertiary">{t('auth.privacyPolicy')}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
