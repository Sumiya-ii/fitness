import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Purchases, { PurchasesPackage, PURCHASES_ERROR_CODE } from 'react-native-purchases';
import { useSubscriptionStore } from '../stores/subscription.store';
import { subscriptionsApi } from '../api/subscriptions';
import { useLocale } from '../i18n';
import { useColors } from '../theme';
import { PrimaryPillButton } from './ui';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Feature {
  icon: IoniconName;
  titleKey: string;
  descKey: string;
}

const FEATURES: Feature[] = [
  { icon: 'camera', titleKey: 'paywall.feature1Title', descKey: 'paywall.feature1Desc' },
  { icon: 'mic', titleKey: 'paywall.feature2Title', descKey: 'paywall.feature2Desc' },
  {
    icon: 'chatbubble-ellipses',
    titleKey: 'paywall.feature3Title',
    descKey: 'paywall.feature3Desc',
  },
  { icon: 'bar-chart', titleKey: 'paywall.feature4Title', descKey: 'paywall.feature4Desc' },
];

export interface PaywallContentProps {
  onClose: () => void;
  /** Called after a successful purchase has been verified. Defaults to `onClose`. */
  onPurchaseSuccess?: () => void;
  /** Called when the user dismisses without purchasing. Defaults to `onClose`. */
  onSkip?: () => void;
}

export function PaywallContent({ onClose, onPurchaseSuccess, onSkip }: PaywallContentProps) {
  const { t } = useLocale();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { fetchStatus } = useSubscriptionStore();

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
      if (__DEV__) {
        console.log('[Paywall] Offerings loaded:', {
          hasCurrentOffering: !!current,
          monthly: current?.monthly?.identifier ?? null,
          annual: current?.annual?.identifier ?? null,
          allPackages: current?.availablePackages?.map((p) => p.identifier) ?? [],
        });
      }
      setOfferings({
        monthly: current?.monthly ?? null,
        annual: current?.annual ?? null,
      });
    } catch (err) {
      if (__DEV__) console.warn('[Paywall] Failed to load offerings:', err);
    } finally {
      setLoadingOfferings(false);
    }
  }, []);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  const activePkg = selectedPkg === 'annual' ? offerings.annual : offerings.monthly;

  const handleSelect = (pkg: 'annual' | 'monthly') => {
    void Haptics.selectionAsync();
    setSelectedPkg(pkg);
  };

  const handlePurchase = async () => {
    if (!activePkg) {
      Alert.alert(t('subscription.unavailableTitle'), t('subscription.unavailableDesc'));
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPurchasing(true);
    try {
      if (__DEV__) console.log('[Paywall] Starting purchase for:', activePkg.identifier);
      const { customerInfo } = await Purchases.purchasePackage(activePkg);
      if (__DEV__) {
        console.log('[Paywall] Purchase completed. Entitlements:', {
          active: Object.keys(customerInfo.entitlements.active),
          all: Object.keys(customerInfo.entitlements.all),
        });
      }
      // Update in-memory state immediately so UI responds before server sync.
      useSubscriptionStore.getState().handleCustomerInfoUpdate(customerInfo);
      // Immediately verify with RevenueCat REST API to sync the DB before the webhook arrives.
      // This ensures subsequent premium API calls won't get 403'd.
      try {
        await subscriptionsApi.verify();
      } catch {
        // Non-fatal — fetchStatus will retry via RC fallback
      }
      await fetchStatus();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPurchaseSuccess(true);
    } catch (err: unknown) {
      const code = (err as { code?: PURCHASES_ERROR_CODE }).code;
      if (__DEV__) console.warn('[Paywall] Purchase error:', { code, err });
      if (code !== PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        Alert.alert(t('subscription.purchaseErrorTitle'), t('subscription.purchaseErrorDesc'));
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    void Haptics.selectionAsync();
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPro = typeof customerInfo.entitlements.active['Coach Pro'] !== 'undefined';
      if (isPro) {
        // Update in-memory state immediately before async server sync.
        useSubscriptionStore.getState().handleCustomerInfoUpdate(customerInfo);
        void fetchStatus();
        Alert.alert(t('subscription.restoreSuccessTitle'), t('subscription.restoreSuccessDesc'));
        onClose();
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
        ? 'https://www.nexuskairos.com/coach/terms'
        : 'https://www.nexuskairos.com/coach/privacy';
    try {
      await Linking.openURL(url);
    } catch {
      // noop
    }
  };

  const handleClose = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (onSkip ?? onClose)();
  };

  const handleSuccessContinue = () => {
    (onPurchaseSuccess ?? onClose)();
  };

  // ── Purchase success ──────────────────────────────────────────────────────
  if (purchaseSuccess) {
    return (
      <View className="flex-1 bg-surface-app">
        <SafeAreaView className="flex-1 items-center justify-center px-8">
          <Animated.View entering={FadeIn.duration(400)} className="items-center">
            <View
              className="h-24 w-24 rounded-full items-center justify-center mb-6"
              style={{ backgroundColor: `${c.accent}1F` }}
            >
              <Ionicons name="checkmark" size={56} color={c.accent} />
            </View>
            <Text
              className="text-3xl font-sans-bold text-center mb-3"
              style={{ color: c.text, letterSpacing: -0.5 }}
            >
              {t('subscription.successTitle')}
            </Text>
            <Text
              className="text-base font-sans text-center leading-6 mb-10"
              style={{ color: c.textSecondary, maxWidth: 300 }}
            >
              {t('subscription.successDesc')}
            </Text>
            <View className="w-full max-w-[280px]">
              <PrimaryPillButton
                label={t('subscription.successCta')}
                onPress={handleSuccessContinue}
                accessibilityLabel={t('subscription.successCta')}
              />
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  const hasOfferings = offerings.annual !== null || offerings.monthly !== null;
  const ctaDisabled = purchasing || loadingOfferings || !hasOfferings;

  // ── Main paywall ──────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        {/* Close button — top-right, 44x44 hit area */}
        <View className="px-5 pt-2 flex-row justify-end">
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            className="h-10 w-10 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: c.cardAlt }}
          >
            <Ionicons name="close" size={20} color={c.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 240 }}
        >
          {/* ── Hero ── */}
          <Animated.View
            entering={FadeInDown.duration(500)}
            className="px-6 pt-8 pb-8 items-center"
          >
            {/* Pro badge — subtle, monochrome with green dot */}
            <View
              className="flex-row items-center px-3 py-1.5 rounded-full mb-6"
              style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}
            >
              <View
                className="h-1.5 w-1.5 rounded-full mr-2"
                style={{ backgroundColor: c.accent }}
              />
              <Text
                className="text-xs font-sans-semibold"
                style={{ color: c.textSecondary, letterSpacing: 0.8 }}
              >
                {t('paywall.proBadge')}
              </Text>
            </View>

            <Text
              className="text-4xl font-sans-bold text-center mb-3"
              style={{ color: c.text, letterSpacing: -1, lineHeight: 44 }}
            >
              {t('paywall.headline')}
            </Text>
            <Text
              className="text-base font-sans text-center leading-6"
              style={{ color: c.textSecondary, maxWidth: 320 }}
            >
              {t('paywall.subheadline')}
            </Text>
          </Animated.View>

          {/* ── Features ── */}
          <Animated.View entering={FadeInDown.delay(80).duration(500)} className="px-5 mb-6">
            <View className="rounded-3xl overflow-hidden" style={{ backgroundColor: c.card }}>
              {FEATURES.map((feature, i) => (
                <View key={feature.titleKey}>
                  <View className="flex-row items-center px-4 py-4" style={{ gap: 14 }}>
                    <View
                      className="h-11 w-11 rounded-2xl items-center justify-center"
                      style={{ backgroundColor: c.cardAlt }}
                    >
                      <Ionicons name={feature.icon} size={20} color={c.text} />
                    </View>
                    <View className="flex-1">
                      <Text
                        className="text-[15px] font-sans-semibold mb-0.5"
                        style={{ color: c.text }}
                      >
                        {t(feature.titleKey)}
                      </Text>
                      <Text
                        className="text-[13px] font-sans leading-[18px]"
                        style={{ color: c.textSecondary }}
                      >
                        {t(feature.descKey)}
                      </Text>
                    </View>
                    <Ionicons name="checkmark" size={20} color={c.accent} />
                  </View>
                  {i < FEATURES.length - 1 && (
                    <View
                      className="ml-[74px] mr-4"
                      style={{ height: 1, backgroundColor: c.border }}
                    />
                  )}
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── Plan selector ── */}
          <Animated.View entering={FadeInDown.delay(160).duration(500)} className="px-5">
            <Text
              className="text-lg font-sans-bold mb-3"
              style={{ color: c.text, letterSpacing: -0.3 }}
            >
              {t('subscription.choosePlan')}
            </Text>

            {loadingOfferings ? (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color={c.primary} />
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {/* Annual */}
                {offerings.annual && (
                  <Pressable
                    onPress={() => handleSelect('annual')}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedPkg === 'annual' }}
                    accessibilityLabel={`${t('subscription.annual')} ${offerings.annual.product.priceString}`}
                    className="rounded-3xl p-4 active:opacity-90"
                    style={{
                      backgroundColor: c.card,
                      borderWidth: 2,
                      borderColor: selectedPkg === 'annual' ? c.primary : c.border,
                    }}
                  >
                    {/* Most-popular badge */}
                    <View
                      className="absolute -top-3 left-4 px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: c.accent }}
                    >
                      <Text
                        className="text-[10px] font-sans-bold"
                        style={{ color: c.onAccent, letterSpacing: 0.8 }}
                      >
                        {t('paywall.mostPopular')}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between mt-1">
                      {/* Selection indicator + plan info */}
                      <View className="flex-row items-center flex-1" style={{ gap: 12 }}>
                        <View
                          className="h-5 w-5 rounded-full items-center justify-center"
                          style={{
                            borderWidth: 2,
                            borderColor: selectedPkg === 'annual' ? c.primary : c.muted,
                            backgroundColor: selectedPkg === 'annual' ? c.primary : 'transparent',
                          }}
                        >
                          {selectedPkg === 'annual' && (
                            <Ionicons name="checkmark" size={12} color={c.onPrimary} />
                          )}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center mb-0.5" style={{ gap: 8 }}>
                            <Text className="text-base font-sans-bold" style={{ color: c.text }}>
                              {t('subscription.annual')}
                            </Text>
                            <View
                              className="px-2 py-0.5 rounded-md"
                              style={{ backgroundColor: `${c.accent}1F` }}
                            >
                              <Text
                                className="text-[11px] font-sans-bold"
                                style={{ color: c.accent, letterSpacing: 0.3 }}
                              >
                                {t('subscription.annualSavings')}
                              </Text>
                            </View>
                          </View>
                          <Text
                            className="text-[13px] font-sans"
                            style={{ color: c.textSecondary }}
                          >
                            {`${Math.round(offerings.annual.product.price / 12).toLocaleString()}₮ / ${t('subscription.monthly').toLowerCase()}`}
                          </Text>
                        </View>
                      </View>

                      <View className="items-end ml-3">
                        <Text
                          className="text-xl font-sans-bold"
                          style={{ color: c.text, letterSpacing: -0.3 }}
                        >
                          {offerings.annual.product.priceString}
                        </Text>
                        <Text className="text-[12px] font-sans" style={{ color: c.textTertiary }}>
                          {t('subscription.perYear')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )}

                {/* Monthly */}
                {offerings.monthly && (
                  <Pressable
                    onPress={() => handleSelect('monthly')}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedPkg === 'monthly' }}
                    accessibilityLabel={`${t('subscription.monthly')} ${offerings.monthly.product.priceString}`}
                    className="rounded-3xl p-4 active:opacity-90"
                    style={{
                      backgroundColor: c.card,
                      borderWidth: 2,
                      borderColor: selectedPkg === 'monthly' ? c.primary : c.border,
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1" style={{ gap: 12 }}>
                        <View
                          className="h-5 w-5 rounded-full items-center justify-center"
                          style={{
                            borderWidth: 2,
                            borderColor: selectedPkg === 'monthly' ? c.primary : c.muted,
                            backgroundColor: selectedPkg === 'monthly' ? c.primary : 'transparent',
                          }}
                        >
                          {selectedPkg === 'monthly' && (
                            <Ionicons name="checkmark" size={12} color={c.onPrimary} />
                          )}
                        </View>
                        <View className="flex-1">
                          <Text
                            className="text-base font-sans-bold mb-0.5"
                            style={{ color: c.text }}
                          >
                            {t('subscription.monthly')}
                          </Text>
                          <Text
                            className="text-[13px] font-sans"
                            style={{ color: c.textSecondary }}
                          >
                            {t('subscription.billedMonthly')}
                          </Text>
                        </View>
                      </View>

                      <View className="items-end ml-3">
                        <Text
                          className="text-xl font-sans-bold"
                          style={{ color: c.text, letterSpacing: -0.3 }}
                        >
                          {offerings.monthly.product.priceString}
                        </Text>
                        <Text className="text-[12px] font-sans" style={{ color: c.textTertiary }}>
                          {t('subscription.perMonth')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )}

                {/* Fallback when offerings could not be loaded */}
                {!hasOfferings && (
                  <View
                    className="rounded-3xl p-7 items-center"
                    style={{ backgroundColor: c.card }}
                  >
                    <Text
                      className="text-sm font-sans text-center mb-4 leading-5"
                      style={{ color: c.textSecondary }}
                    >
                      {t('subscription.offersUnavailable')}
                    </Text>
                    <Pressable
                      onPress={() => void loadOfferings()}
                      accessibilityRole="button"
                      accessibilityLabel={t('common.retry')}
                      className="px-6 py-2.5 rounded-full active:opacity-80"
                      style={{ borderWidth: 1, borderColor: c.border }}
                    >
                      <Text className="text-sm font-sans-semibold" style={{ color: c.text }}>
                        {t('common.retry')}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* ── Sticky bottom CTA ── */}
        <View
          className="absolute left-0 right-0 bottom-0 px-5 pt-4"
          style={{
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: c.bg,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          {/* Trust signal above CTA */}
          <Text
            className="text-[12px] font-sans-medium text-center mb-3"
            style={{ color: c.textSecondary }}
          >
            {t('paywall.cancelAnytime')}
          </Text>

          <PrimaryPillButton
            label={
              activePkg
                ? `${t('paywall.getProCta')} · ${activePkg.product.priceString}`
                : t('subscription.subscribe')
            }
            onPress={() => void handlePurchase()}
            disabled={ctaDisabled}
            loading={purchasing}
            accessibilityLabel={
              activePkg
                ? `${t('paywall.getProCta')} ${activePkg.product.priceString}`
                : t('subscription.subscribe')
            }
          />

          <View className="flex-row justify-center items-center flex-wrap mt-3" style={{ gap: 2 }}>
            <Pressable
              onPress={() => void handleRestore()}
              disabled={restoring}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('subscription.restore')}
            >
              <Text className="text-[12px] font-sans" style={{ color: c.textTertiary }}>
                {restoring ? t('common.loading') : t('subscription.restore')}
              </Text>
            </Pressable>
            <Text className="text-[12px] mx-1.5" style={{ color: c.textTertiary }}>
              ·
            </Text>
            <Pressable
              onPress={() => void handleLegalLink('terms')}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={t('auth.termsOfService')}
            >
              <Text className="text-[12px] font-sans" style={{ color: c.textTertiary }}>
                {t('auth.termsOfService')}
              </Text>
            </Pressable>
            <Text className="text-[12px] mx-1.5" style={{ color: c.textTertiary }}>
              ·
            </Text>
            <Pressable
              onPress={() => void handleLegalLink('privacy')}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={t('auth.privacyPolicy')}
            >
              <Text className="text-[12px] font-sans" style={{ color: c.textTertiary }}>
                {t('auth.privacyPolicy')}
              </Text>
            </Pressable>
          </View>

          <Text
            className="text-[11px] font-sans text-center mt-2 leading-[15px]"
            style={{ color: c.textTertiary }}
          >
            {t('subscription.iapDisclaimer')}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
