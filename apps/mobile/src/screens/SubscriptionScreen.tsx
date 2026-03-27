import { useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscriptionStore } from '../stores/subscription.store';
import { PaywallContent } from '../components/PaywallContent';
import { useLocale } from '../i18n';

export function SubscriptionScreen() {
  const navigation = useNavigation();
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
      <View
        style={{
          flex: 1,
          backgroundColor: '#0A0A0A',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  if (tier !== 'pro') {
    return <PaywallContent onClose={() => navigation.goBack()} />;
  }

  const formattedEnd = currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Back button */}
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={{
            position: 'absolute',
            top: Platform.OS === 'ios' ? 54 : 16,
            left: 16,
            zIndex: 10,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={18} color="#9CA3AF" />
        </Pressable>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <LinearGradient
            colors={['#22C55E', '#16A34A']}
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            <Ionicons name="checkmark-circle" size={48} color="#FFFFFF" />
          </LinearGradient>

          <Text
            style={{
              fontSize: 28,
              fontWeight: '800',
              color: '#FFFFFF',
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            {t('subscription.alreadyProTitle')}
          </Text>
          <Text
            style={{
              fontSize: 16,
              color: '#9CA3AF',
              textAlign: 'center',
              lineHeight: 24,
              marginBottom: 8,
            }}
          >
            {t('subscription.alreadyProDesc')}
          </Text>

          {formattedEnd && (
            <Text
              style={{
                fontSize: 14,
                color: '#6B7280',
                textAlign: 'center',
                marginBottom: 32,
              }}
            >
              {t('subscription.iapDisclaimer')}
            </Text>
          )}

          <Pressable
            onPress={() => {
              if (Platform.OS === 'ios') {
                Linking.openURL('https://apps.apple.com/account/subscriptions');
              } else {
                Linking.openURL('https://play.google.com/store/account/subscriptions');
              }
            }}
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 16,
              paddingVertical: 16,
              paddingHorizontal: 32,
              marginBottom: 12,
            }}
          >
            <Text
              style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}
            >
              {t('settings.manage')}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
