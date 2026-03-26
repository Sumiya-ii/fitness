import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import Purchases, { PurchasesPackage, PURCHASES_ERROR_CODE } from 'react-native-purchases';
import { useSubscriptionStore } from '../stores/subscription.store';
import { useLocale } from '../i18n';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Feature {
  icon: IoniconName;
  iconColor: string;
  iconBg: string;
  titleKey: string;
  descKey: string;
}

const FEATURES: Feature[] = [
  {
    icon: 'camera',
    iconColor: '#F472B6',
    iconBg: 'rgba(244,114,182,0.15)',
    titleKey: 'paywall.feature1Title',
    descKey: 'paywall.feature1Desc',
  },
  {
    icon: 'mic',
    iconColor: '#60A5FA',
    iconBg: 'rgba(96,165,250,0.15)',
    titleKey: 'paywall.feature2Title',
    descKey: 'paywall.feature2Desc',
  },
  {
    icon: 'chatbubble-ellipses',
    iconColor: '#34D399',
    iconBg: 'rgba(52,211,153,0.15)',
    titleKey: 'paywall.feature3Title',
    descKey: 'paywall.feature3Desc',
  },
  {
    icon: 'bar-chart',
    iconColor: '#FBBF24',
    iconBg: 'rgba(251,191,36,0.15)',
    titleKey: 'paywall.feature4Title',
    descKey: 'paywall.feature4Desc',
  },
];

export interface PaywallContentProps {
  onClose: () => void;
}

export function PaywallContent({ onClose }: PaywallContentProps) {
  const { t } = useLocale();
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

  const handlePurchase = async () => {
    if (!activePkg) {
      Alert.alert(t('subscription.unavailableTitle'), t('subscription.unavailableDesc'));
      return;
    }
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
      // Sync with server (source of truth) regardless of client-side entitlement state.
      // In sandbox/dev the entitlement may not appear immediately on the client.
      await fetchStatus();
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
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPro = typeof customerInfo.entitlements.active['pro'] !== 'undefined';
      if (isPro) {
        await fetchStatus();
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
        ? process.env.EXPO_PUBLIC_TERMS_URL?.trim()
        : process.env.EXPO_PUBLIC_PRIVACY_URL?.trim();
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // noop
    }
  };

  // ── Purchase success ──────────────────────────────────────────────────────
  if (purchaseSuccess) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0A0A0A',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <SafeAreaView style={{ alignItems: 'center' }}>
          <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: 'rgba(34,197,94,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
            </View>
            <Text
              style={{
                fontSize: 28,
                fontWeight: '800',
                color: '#FFFFFF',
                textAlign: 'center',
                marginBottom: 10,
              }}
            >
              {t('subscription.successTitle')}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: '#9CA3AF',
                textAlign: 'center',
                lineHeight: 24,
                marginBottom: 36,
              }}
            >
              {t('subscription.successDesc')}
            </Text>
            <Pressable
              onPress={onClose}
              style={{
                backgroundColor: '#22C55E',
                borderRadius: 16,
                paddingVertical: 16,
                paddingHorizontal: 48,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>
                {t('subscription.successCta')}
              </Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  const hasOfferings = offerings.annual !== null || offerings.monthly !== null;
  const ctaDisabled = purchasing || loadingOfferings || !hasOfferings;

  // ── Main paywall ──────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Close button */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={{
            position: 'absolute',
            top: Platform.OS === 'ios' ? 54 : 16,
            right: 16,
            zIndex: 10,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={18} color="#9CA3AF" />
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 160 }}
        >
          {/* ── Hero ── */}
          <Animated.View
            entering={FadeInDown.duration(500)}
            style={{
              alignItems: 'center',
              paddingTop: 72,
              paddingHorizontal: 24,
              paddingBottom: 36,
            }}
          >
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              style={{
                width: 88,
                height: 88,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
                shadowColor: '#22C55E',
                shadowOpacity: 0.4,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
              }}
            >
              <Ionicons name="fitness" size={48} color="#FFFFFF" />
            </LinearGradient>

            <Text
              style={{
                fontSize: 34,
                fontWeight: '800',
                color: '#FFFFFF',
                textAlign: 'center',
                letterSpacing: -0.5,
                marginBottom: 10,
              }}
            >
              {t('paywall.headline')}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: '#9CA3AF',
                textAlign: 'center',
                lineHeight: 24,
                maxWidth: 280,
              }}
            >
              {t('paywall.subheadline')}
            </Text>

            {/* Star rating */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 3 }}>
              {([1, 2, 3, 4, 5] as const).map((i) => (
                <Ionicons key={i} name="star" size={15} color="#F59E0B" />
              ))}
              <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 14, marginLeft: 6 }}>
                4.8
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 14, marginLeft: 4 }}>
                · {t('paywall.reviewCount')}
              </Text>
            </View>
          </Animated.View>

          {/* ── Features ── */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(500)}
            style={{ paddingHorizontal: 20, marginBottom: 28 }}
          >
            <View style={{ backgroundColor: '#141414', borderRadius: 20, overflow: 'hidden' }}>
              {FEATURES.map((feature, i) => (
                <View key={feature.titleKey}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 13,
                        backgroundColor: feature.iconBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Ionicons name={feature.icon} size={22} color={feature.iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontWeight: '600',
                          fontSize: 15,
                          marginBottom: 3,
                        }}
                      >
                        {t(feature.titleKey)}
                      </Text>
                      <Text style={{ color: '#6B7280', fontSize: 13, lineHeight: 18 }}>
                        {t(feature.descKey)}
                      </Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
                  </View>
                  {i < FEATURES.length - 1 && (
                    <View style={{ height: 1, backgroundColor: '#1F1F1F', marginHorizontal: 16 }} />
                  )}
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── Plan selector ── */}
          <Animated.View
            entering={FadeInDown.delay(160).duration(500)}
            style={{ paddingHorizontal: 20 }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 18, marginBottom: 14 }}>
              {t('subscription.choosePlan')}
            </Text>

            {loadingOfferings ? (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <ActivityIndicator size="large" color="#22C55E" />
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {/* Annual */}
                {offerings.annual && (
                  <Pressable
                    onPress={() => setSelectedPkg('annual')}
                    style={{
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: selectedPkg === 'annual' ? '#22C55E' : '#2A2A2A',
                      backgroundColor:
                        selectedPkg === 'annual' ? 'rgba(34,197,94,0.08)' : '#141414',
                      padding: 18,
                      overflow: 'visible',
                    }}
                  >
                    {selectedPkg === 'annual' && (
                      <View
                        style={{
                          position: 'absolute',
                          top: -13,
                          left: 16,
                          backgroundColor: '#22C55E',
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontWeight: '700',
                            fontSize: 11,
                            letterSpacing: 0.5,
                          }}
                        >
                          {t('paywall.mostPopular')}
                        </Text>
                      </View>
                    )}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 5,
                          }}
                        >
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                            {t('subscription.annual')}
                          </Text>
                          <View
                            style={{
                              backgroundColor: '#22C55E',
                              paddingHorizontal: 7,
                              paddingVertical: 3,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}>
                              {t('subscription.annualSavings')}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ color: '#6B7280', fontSize: 13 }}>
                          {`${Math.round(offerings.annual.product.price / 12).toLocaleString()}₮ / ${t('subscription.monthly').toLowerCase()}`}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 22 }}>
                          {offerings.annual.product.priceString}
                        </Text>
                        <Text style={{ color: '#6B7280', fontSize: 13 }}>
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
                    style={{
                      borderRadius: 18,
                      borderWidth: 1.5,
                      borderColor: selectedPkg === 'monthly' ? '#22C55E' : '#2A2A2A',
                      backgroundColor:
                        selectedPkg === 'monthly' ? 'rgba(34,197,94,0.08)' : '#141414',
                      padding: 18,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View>
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontWeight: '700',
                            fontSize: 16,
                            marginBottom: 5,
                          }}
                        >
                          {t('subscription.monthly')}
                        </Text>
                        <Text style={{ color: '#6B7280', fontSize: 13 }}>
                          {t('subscription.billedMonthly')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 22 }}>
                          {offerings.monthly.product.priceString}
                        </Text>
                        <Text style={{ color: '#6B7280', fontSize: 13 }}>
                          {t('subscription.perMonth')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )}

                {/* Fallback when offerings could not be loaded */}
                {!hasOfferings && (
                  <View
                    style={{
                      backgroundColor: '#141414',
                      borderRadius: 18,
                      padding: 28,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#6B7280',
                        fontSize: 14,
                        textAlign: 'center',
                        marginBottom: 16,
                      }}
                    >
                      {t('subscription.offersUnavailable')}
                    </Text>
                    <Pressable
                      onPress={() => void loadOfferings()}
                      style={{
                        paddingHorizontal: 24,
                        paddingVertical: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#3A3A3A',
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                        {t('common.retry')}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </Animated.View>

          {/* ── Testimonial ── */}
          <Animated.View
            entering={FadeInDown.delay(240).duration(500)}
            style={{ paddingHorizontal: 20, marginTop: 24 }}
          >
            <View style={{ backgroundColor: '#141414', borderRadius: 16, padding: 18 }}>
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                {([1, 2, 3, 4, 5] as const).map((i) => (
                  <Ionicons key={i} name="star" size={13} color="#F59E0B" />
                ))}
              </View>
              <Text style={{ color: '#E5E7EB', fontSize: 14, lineHeight: 22, fontStyle: 'italic' }}>
                "{t('paywall.review1Text')}"
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 10, fontWeight: '600' }}>
                — {t('paywall.review1Author')}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>

        {/* ── Sticky bottom CTA ── */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#0A0A0A',
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Platform.OS === 'ios' ? 34 : 20,
            borderTopWidth: 1,
            borderTopColor: '#1A1A1A',
          }}
        >
          <Pressable
            onPress={() => void handlePurchase()}
            disabled={ctaDisabled}
            style={{
              backgroundColor: ctaDisabled ? '#1F2937' : '#22C55E',
              borderRadius: 16,
              paddingVertical: 17,
              alignItems: 'center',
              marginBottom: 14,
              shadowColor: ctaDisabled ? 'transparent' : '#22C55E',
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>
                {activePkg
                  ? `${t('paywall.getProCta')} · ${activePkg.product.priceString}`
                  : t('subscription.subscribe')}
              </Text>
            )}
          </Pressable>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
              marginBottom: 8,
            }}
          >
            <Pressable onPress={() => void handleRestore()} disabled={restoring} hitSlop={8}>
              <Text style={{ color: '#6B7280', fontSize: 13 }}>
                {restoring ? t('common.loading') : t('subscription.restore')}
              </Text>
            </Pressable>
            <Text style={{ color: '#374151', fontSize: 13, marginHorizontal: 6 }}>·</Text>
            <Pressable onPress={() => void handleLegalLink('terms')} hitSlop={8}>
              <Text style={{ color: '#6B7280', fontSize: 13 }}>{t('auth.termsOfService')}</Text>
            </Pressable>
            <Text style={{ color: '#374151', fontSize: 13, marginHorizontal: 6 }}>·</Text>
            <Pressable onPress={() => void handleLegalLink('privacy')} hitSlop={8}>
              <Text style={{ color: '#6B7280', fontSize: 13 }}>{t('auth.privacyPolicy')}</Text>
            </Pressable>
          </View>

          <Text style={{ color: '#4B5563', fontSize: 12, textAlign: 'center' }}>
            {t('subscription.iapDisclaimer')}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
