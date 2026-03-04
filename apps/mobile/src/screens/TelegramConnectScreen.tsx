import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Badge, LoadingScreen } from '../components/ui';
import { api } from '../api';

const TELEGRAM_BOT_USERNAME = 'CoachBot';
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
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => navigation.goBack()}
          className="mr-4 p-2"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#475569" />
        </Pressable>
        <Text className="flex-1 text-xl font-sans-bold text-text dark:text-slate-100">
          Telegram Coach
        </Text>
      </View>

      <View className="flex-1 px-4 pt-8">
        <View className="items-center pb-8">
          <View className="mb-4 rounded-full bg-blue-100 p-8 dark:bg-blue-900/40">
            <Ionicons name="paper-plane" size={64} color="#3b82f6" />
          </View>
          <Text className="text-center text-lg font-sans-semibold text-text dark:text-slate-100">
            Connect with Coach on Telegram
          </Text>
          <Text className="mt-2 text-center text-text-secondary dark:text-slate-400">
            Log meals and get reminders via Telegram
          </Text>
          <View className="mt-4">
            <Badge variant={linked ? 'success' : 'warning'}>
              {linked ? 'Connected' : 'Not Connected'}
            </Badge>
          </View>
        </View>

        {linked ? (
          <Card>
            <Text className="font-sans-semibold text-text dark:text-slate-100">
              Connected as @{username ?? 'user'}
            </Text>
            <Text className="mt-1 text-sm text-text-secondary dark:text-slate-400">
              You can log meals and receive reminders on Telegram.
            </Text>
            <Button
              variant="outline"
              className="mt-4"
              onPress={handleUnlink}
              loading={unlinking}
            >
              Unlink
            </Button>
          </Card>
        ) : (
          <Card>
            <Text className="font-sans-semibold text-text dark:text-slate-100">
              Link your account
            </Text>
            <Text className="mt-2 text-sm text-text-secondary dark:text-slate-400">
              {linkCode
                ? 'Send this code to @CoachBot on Telegram to complete linking:'
                : 'Generate a link code and send it to the Coach bot on Telegram.'}
            </Text>
            {linkCode ? (
              <>
                <View className="mt-4 rounded-xl bg-slate-100 py-4 dark:bg-slate-700">
                  <Text className="text-center text-3xl font-mono font-sans-bold tracking-widest text-text dark:text-slate-100">
                    {linkCode}
                  </Text>
                </View>
                <Text className="mt-4 text-center text-sm text-text-secondary dark:text-slate-400">
                  Step 2: Send this code to @{TELEGRAM_BOT_USERNAME} on Telegram
                </Text>
                <Button
                  variant="primary"
                  className="mt-4"
                  onPress={handleOpenTelegram}
                >
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
                className="mt-4"
                onPress={handleGenerateCode}
                loading={generating}
              >
                Generate Link Code
              </Button>
            )}
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}
