import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Badge, LoadingScreen } from '../components/ui';
import { api } from '../api';

const TELEGRAM_BOT_USERNAME = (
  process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'CoachBot'
).replace(/^@/, '');
const TELEGRAM_DEEP_LINK = `https://t.me/${TELEGRAM_BOT_USERNAME}`;

export function TelegramConnectScreen() {
  const navigation = useNavigation();
  const [linked, setLinked] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ linked: boolean; telegramUsername?: string }>(
        '/telegram/status'
      );
      setLinked(res.linked);
      setUsername(res.telegramUsername ?? null);
      setLinkCode(null);
    } catch {
      setLinked(false);
      setUsername(null);
      setLinkCode(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const res = await api.post<{ code: string }>('/telegram/link-code', {});
      setLinkCode(res.code);
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'Failed to generate link code'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlink = () => {
    Alert.alert(
      'Unlink Telegram',
      'Are you sure you want to unlink your Telegram account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            setUnlinking(true);
            try {
              await api.post('/telegram/unlink', {});
              await fetchStatus();
            } catch (e) {
              Alert.alert(
                'Error',
                e instanceof Error ? e.message : 'Failed to unlink'
              );
            } finally {
              setUnlinking(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenTelegram = () => {
    Linking.openURL(TELEGRAM_DEEP_LINK);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View className="flex-1 bg-slate-950">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-10 w-10 rounded-full bg-slate-900 items-center justify-center mr-3"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          </Pressable>
          <Text className="flex-1 text-xl font-sans-bold text-white">
            Telegram Coach
          </Text>
        </View>

        <View className="flex-1 px-4 pt-6">
          {/* Hero */}
          <View className="items-center pb-8">
            <LinearGradient
              colors={['#1d4ed8', '#3b82f6']}
              className="mb-5 h-24 w-24 rounded-3xl items-center justify-center"
            >
              <Ionicons name="paper-plane" size={44} color="#ffffff" />
            </LinearGradient>
            <Text className="text-center text-xl font-sans-bold text-white">
              Connect with Coach on Telegram
            </Text>
            <Text className="mt-2 text-center text-sm text-slate-400">
              Log meals and get reminders via Telegram
            </Text>
            <View className="mt-4">
              <Badge variant={linked ? 'success' : 'warning'}>
                {linked ? 'Connected' : 'Not Connected'}
              </Badge>
            </View>
          </View>

          {linked ? (
            <View className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="h-10 w-10 rounded-full bg-blue-500/20 items-center justify-center">
                  <Ionicons name="person" size={20} color="#3b82f6" />
                </View>
                <View>
                  <Text className="font-sans-semibold text-white">
                    @{username ?? 'user'}
                  </Text>
                  <Text className="text-xs text-slate-400">Connected account</Text>
                </View>
              </View>
              <Text className="text-sm text-slate-400 mb-4">
                You can log meals and receive reminders on Telegram.
              </Text>
              <Button
                variant="outline"
                onPress={handleUnlink}
                loading={unlinking}
              >
                Unlink Account
              </Button>
            </View>
          ) : (
            <View className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5">
              <Text className="font-sans-semibold text-white mb-2">
                Link your account
              </Text>
              <Text className="text-sm text-slate-400 mb-4">
                {linkCode
                  ? `Send this code to @${TELEGRAM_BOT_USERNAME} on Telegram:`
                  : 'Generate a link code and send it to the Coach bot on Telegram.'}
              </Text>
              {linkCode ? (
                <>
                  <View className="rounded-2xl bg-slate-800 py-5 mb-4">
                    <Text className="text-center text-3xl font-sans-bold tracking-widest text-white">
                      {linkCode}
                    </Text>
                  </View>
                  <Text className="text-center text-xs text-slate-400 mb-4">
                    Send this code to @{TELEGRAM_BOT_USERNAME} on Telegram
                  </Text>
                  <Button variant="primary" onPress={handleOpenTelegram}>
                    Open Telegram
                  </Button>
                  <Button
                    variant="ghost"
                    className="mt-2"
                    onPress={handleGenerateCode}
                    loading={generating}
                  >
                    Generate New Code
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  onPress={handleGenerateCode}
                  loading={generating}
                >
                  Generate Link Code
                </Button>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
