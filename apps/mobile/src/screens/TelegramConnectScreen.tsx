import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Linking, Alert, AppState, type AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Badge, LoadingScreen } from '../components/ui';
import { api } from '../api';

const TELEGRAM_BOT_USERNAME = (process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'CoachBot').replace(
  /^@/,
  '',
);

export function TelegramConnectScreen() {
  const navigation = useNavigation();
  const [linked, setLinked] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  // Track whether we've opened Telegram and are waiting for the user to come back
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
      // Network error — keep previous state, don't clear it
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
      // Embed the code directly in the deep link — user just taps START in Telegram
      const deepLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${res.code}`;
      setPendingLink(true);
      await Linking.openURL(deepLink);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not connect to the server');
    } finally {
      setConnecting(false);
    }
  };

  const handleUnlink = () => {
    Alert.alert('Unlink Telegram', 'Are you sure you want to unlink your Telegram account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: async () => {
          setUnlinking(true);
          try {
            await api.post('/telegram/unlink', {});
            setLinked(false);
            setUsername(null);
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Failed to unlink');
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
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-10 w-10 rounded-full bg-surface-card items-center justify-center mr-3"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#9a9caa" />
          </Pressable>
          <Text className="flex-1 text-xl font-sans-bold text-text">Telegram Coach</Text>
        </View>

        <View className="flex-1 px-4 pt-6">
          {/* Hero */}
          <View className="items-center pb-8">
            <LinearGradient
              colors={['#1d4ed8', '#8b8fa0']}
              className="mb-5 h-24 w-24 rounded-3xl items-center justify-center"
            >
              <Ionicons name="paper-plane" size={44} color="#ffffff" />
            </LinearGradient>
            <Text className="text-center text-xl font-sans-bold text-text">
              Connect with Coach on Telegram
            </Text>
            <Text className="mt-2 text-center text-sm text-text-secondary">
              Log meals and get reminders via Telegram
            </Text>
            <View className="mt-4">
              <Badge variant={linked ? 'success' : 'warning'}>
                {linked ? 'Connected' : 'Not Connected'}
              </Badge>
            </View>
          </View>

          {linked ? (
            <View className="rounded-2xl bg-surface-card border border-surface-border p-5">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="h-10 w-10 rounded-full bg-blue-500/20 items-center justify-center">
                  <Ionicons name="person" size={20} color="#8b8fa0" />
                </View>
                <View>
                  <Text className="font-sans-semibold text-text">@{username ?? 'user'}</Text>
                  <Text className="text-xs text-text-secondary">Connected account</Text>
                </View>
              </View>
              <Text className="text-sm text-text-secondary mb-4">
                You can log meals and receive reminders on Telegram.
              </Text>
              <Button variant="outline" onPress={handleUnlink} loading={unlinking}>
                Unlink Account
              </Button>
            </View>
          ) : (
            <View className="rounded-2xl bg-surface-card border border-surface-border p-5">
              {pendingLink ? (
                <>
                  <View className="items-center py-4 mb-4">
                    <Ionicons name="time-outline" size={32} color="#9a9caa" className="mb-3" />
                    <Text className="font-sans-semibold text-text text-center mb-2">
                      Waiting for confirmation…
                    </Text>
                    <Text className="text-sm text-text-secondary text-center">
                      Tap START in Telegram to link your account. Come back here once done.
                    </Text>
                  </View>
                  <Button variant="primary" onPress={fetchStatus}>
                    I've connected — check status
                  </Button>
                  <Button
                    variant="ghost"
                    className="mt-2"
                    onPress={handleConnect}
                    loading={connecting}
                  >
                    Open Telegram again
                  </Button>
                </>
              ) : (
                <>
                  <Text className="font-sans-semibold text-text mb-2">Link your account</Text>
                  <Text className="text-sm text-text-secondary mb-4">
                    Tap below to open Telegram. Just tap START and your account will be linked
                    automatically.
                  </Text>
                  <Button variant="primary" onPress={handleConnect} loading={connecting}>
                    Connect with Telegram
                  </Button>
                </>
              )}
            </View>
          )}

          {/* How it works */}
          {!linked && !pendingLink && (
            <View className="mt-6">
              <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-3 px-1">
                How it works
              </Text>
              {[
                {
                  icon: 'phone-portrait-outline' as const,
                  text: 'Tap "Connect with Telegram" above',
                },
                { icon: 'paper-plane-outline' as const, text: 'Tap START in the Telegram app' },
                {
                  icon: 'checkmark-circle-outline' as const,
                  text: 'Come back — your account is linked',
                },
              ].map((step, i) => (
                <View key={i} className="flex-row items-center gap-3 mb-3">
                  <View className="h-8 w-8 rounded-full bg-blue-500/15 items-center justify-center">
                    <Ionicons name={step.icon} size={16} color="#8b8fa0" />
                  </View>
                  <Text className="flex-1 text-sm text-text-secondary">{step.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
