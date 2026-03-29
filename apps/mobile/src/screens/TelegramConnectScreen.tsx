import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Linking, Alert, AppState, type AppStateStatus } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Button, Badge, LoadingScreen } from '../components/ui';
import { api } from '../api';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

const TELEGRAM_BOT_USERNAME = (process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'CoachBot').replace(
  /^@/,
  '',
);

export function TelegramConnectScreen() {
  const c = useColors();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [linked, setLinked] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [pendingLink, setPendingLink] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<{ linked: boolean; telegramUsername?: string }>('/telegram/status');
      setLinked(res.linked);
      setUsername(res.telegramUsername ?? null);
      if (res.linked) {
        setPendingLink(false);
      }
    } catch {
      // Network error -- keep previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // When the user comes back from Telegram, re-check link status
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active' && pendingLink) {
        fetchStatus();
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

  const handleUnlink = () => {
    Alert.alert(t('telegram.unlinkTitle'), t('telegram.unlinkConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('telegram.unlink'),
        style: 'destructive',
        onPress: async () => {
          setUnlinking(true);
          try {
            await api.post('/telegram/unlink', {});
            setLinked(false);
            setUsername(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {
            Alert.alert(
              t('common.error'),
              e instanceof Error ? e.message : t('telegram.unlinkError'),
            );
          } finally {
            setUnlinking(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
            {t('telegram.title')}
          </Text>
        </View>

        <View className="flex-1 px-5 pt-6" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
          {/* Hero */}
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            className="items-center pb-6"
          >
            <View
              className="mb-5 h-20 w-20 rounded-3xl items-center justify-center"
              style={{ backgroundColor: c.primary }}
            >
              <Ionicons name="paper-plane" size={36} color={c.onPrimary} />
            </View>
            <Text className="text-center text-xl leading-7 font-sans-bold text-text">
              {t('telegram.heroTitle')}
            </Text>
            <Text
              className="mt-2 text-center text-sm leading-5 font-sans-medium"
              style={{ color: c.textSecondary }}
            >
              {t('telegram.heroSubtitle')}
            </Text>
            <View className="mt-4">
              <Badge variant={linked ? 'success' : 'warning'}>
                {linked ? t('telegram.connected') : t('telegram.notConnected')}
              </Badge>
            </View>
          </Animated.View>

          {linked ? (
            <Animated.View entering={FadeInDown.duration(400).delay(100).springify()}>
              <View className="rounded-2xl bg-surface-card border border-surface-border p-5">
                <View className="flex-row items-center gap-3 mb-3">
                  <View
                    className="h-11 w-11 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${c.primary}15` }}
                  >
                    <Ionicons name="person" size={20} color={c.textSecondary} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-sans-semibold text-base leading-6 text-text">
                      @{username ?? 'user'}
                    </Text>
                    <Text
                      className="text-xs leading-5 font-sans-medium"
                      style={{ color: c.textSecondary }}
                    >
                      {t('telegram.connectedAccount')}
                    </Text>
                  </View>
                </View>
                <Text
                  className="text-sm leading-5 font-sans-medium mb-4"
                  style={{ color: c.textSecondary }}
                >
                  {t('telegram.connectedDesc')}
                </Text>
                <Button
                  variant="outline"
                  size="md"
                  onPress={handleUnlink}
                  loading={unlinking}
                  accessibilityLabel={t('telegram.unlinkAccount')}
                >
                  {t('telegram.unlinkAccount')}
                </Button>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(400).delay(100).springify()}>
              <View className="rounded-2xl bg-surface-card border border-surface-border p-5">
                {pendingLink ? (
                  <>
                    <View className="items-center py-4 mb-4">
                      <View
                        className="h-12 w-12 rounded-2xl items-center justify-center mb-3"
                        style={{ backgroundColor: c.cardAlt }}
                      >
                        <Ionicons name="time-outline" size={24} color={c.textSecondary} />
                      </View>
                      <Text className="font-sans-semibold text-base leading-6 text-text text-center mb-2">
                        {t('telegram.waitingTitle')}
                      </Text>
                      <Text
                        className="text-sm leading-5 font-sans-medium text-center"
                        style={{ color: c.textSecondary }}
                      >
                        {t('telegram.waitingDesc')}
                      </Text>
                    </View>
                    <Button
                      variant="primary"
                      size="md"
                      onPress={fetchStatus}
                      accessibilityLabel={t('telegram.checkStatus')}
                    >
                      {t('telegram.checkStatus')}
                    </Button>
                    <View className="mt-3">
                      <Button
                        variant="ghost"
                        size="md"
                        onPress={handleConnect}
                        loading={connecting}
                        accessibilityLabel={t('telegram.openAgain')}
                      >
                        {t('telegram.openAgain')}
                      </Button>
                    </View>
                  </>
                ) : (
                  <>
                    <Text className="font-sans-semibold text-base leading-6 text-text mb-2">
                      {t('telegram.linkTitle')}
                    </Text>
                    <Text
                      className="text-sm leading-5 font-sans-medium mb-4"
                      style={{ color: c.textSecondary }}
                    >
                      {t('telegram.linkDesc')}
                    </Text>
                    <Button
                      variant="primary"
                      size="md"
                      onPress={handleConnect}
                      loading={connecting}
                      accessibilityLabel={t('telegram.connectButton')}
                    >
                      {t('telegram.connectButton')}
                    </Button>
                  </>
                )}
              </View>
            </Animated.View>
          )}

          {/* How it works */}
          {!linked && !pendingLink ? (
            <Animated.View entering={FadeInDown.duration(400).delay(200).springify()}>
              <View className="mt-6">
                <Text
                  className="text-xs leading-5 font-sans-semibold uppercase tracking-wider mb-3 ml-1"
                  style={{ color: c.textTertiary }}
                >
                  {t('telegram.howItWorks')}
                </Text>
                {(
                  [
                    { icon: 'phone-portrait-outline' as const, text: t('telegram.step1') },
                    { icon: 'paper-plane-outline' as const, text: t('telegram.step2') },
                    { icon: 'checkmark-circle-outline' as const, text: t('telegram.step3') },
                  ] as const
                ).map((step, i) => (
                  <View key={i} className="flex-row items-center gap-3 mb-3">
                    <View
                      className="h-9 w-9 rounded-xl items-center justify-center"
                      style={{ backgroundColor: `${c.primary}15` }}
                    >
                      <Ionicons name={step.icon} size={16} color={c.textSecondary} />
                    </View>
                    <Text
                      className="flex-1 text-sm leading-5 font-sans-medium"
                      style={{ color: c.textSecondary }}
                    >
                      {step.text}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
