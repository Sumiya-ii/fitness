import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import {
  Card,
  Button,
  Badge,
} from '../components/ui';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../api';

interface ProfileData {
  displayName: string | null;
  locale: string;
  unitSystem: string;
  id: string;
}

interface NotificationPrefs {
  morningReminder: boolean;
  eveningReminder: boolean;
}

interface TelegramStatus {
  linked: boolean;
  telegramUsername?: string;
}

interface SubscriptionStatus {
  tier: string;
  status: string;
}

export function SettingsScreen() {
  const navigation = useNavigation();
  const signOut = useAuthStore((s) => s.signOut);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    morningReminder: true,
    eveningReminder: true,
  });
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [profileRes, notifRes, telegramRes, subRes] = await Promise.all([
        api.get<{ data: ProfileData }>('/profile'),
        api.get<{ data: NotificationPrefs }>('/notifications/preferences'),
        api.get<TelegramStatus>('/telegram/status'),
        api.get<{ data: SubscriptionStatus }>('/subscriptions/status'),
      ]);
      setProfile(profileRes.data);
      setNotifPrefs(notifRes.data);
      setTelegramStatus(telegramRes);
      setSubscription(subRes.data);
    } catch {
      setProfile(null);
      setNotifPrefs({ morningReminder: true, eveningReminder: true });
      setTelegramStatus(null);
      setSubscription(null);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateNotifPref = async (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    try {
      await api.put('/notifications/preferences', next);
    } catch {
      setNotifPrefs(notifPrefs);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'A data export request will be created. You will receive a link when it is ready.',
      [{ text: 'OK' }]
    );
    api.post('/privacy/export').catch(() => {});
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive' },
      ]
    );
  };

  const appVersion = Constants.expoConfig?.version ?? '0.0.1';

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-4 pt-4">
        <Text className="text-2xl font-sans-bold text-text dark:text-slate-100">
          Settings
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-4 gap-6 px-4">
          <Card>
            <Text className="mb-3 font-sans-semibold text-text dark:text-slate-100">
              Profile
            </Text>
            <View className="flex-row items-center gap-4">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                <Ionicons name="person" size={28} color="#94a3b8" />
              </View>
              <View className="flex-1">
                <Text className="font-sans-semibold text-text dark:text-slate-100">
                  {profile?.displayName ?? 'User'}
                </Text>
                <Text className="text-sm text-text-secondary dark:text-slate-400">
                  user@example.com
                </Text>
              </View>
            </View>
            <Pressable
              className="mt-4 flex-row items-center justify-between py-2"
              onPress={() => {}}
            >
              <Text className="text-text dark:text-slate-200">Edit Profile</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </Pressable>
          </Card>

          <Card>
            <Text className="mb-3 font-sans-semibold text-text dark:text-slate-100">
              Appearance
            </Text>
            <Pressable className="flex-row items-center justify-between py-3">
              <Text className="text-text dark:text-slate-200">Language</Text>
              <Text className="text-text-secondary dark:text-slate-400">
                {profile?.locale === 'mn' ? 'Монгол' : 'English'}
              </Text>
            </Pressable>
            <View className="h-px bg-slate-200 dark:bg-slate-600" />
            <Pressable className="flex-row items-center justify-between py-3">
              <Text className="text-text dark:text-slate-200">Units</Text>
              <Text className="text-text-secondary dark:text-slate-400">
                {profile?.unitSystem === 'metric' ? 'Metric' : 'Imperial'}
              </Text>
            </Pressable>
          </Card>

          <Card>
            <Text className="mb-3 font-sans-semibold text-text dark:text-slate-100">
              Notifications
            </Text>
            <View className="flex-row items-center justify-between py-3">
              <Text className="text-text dark:text-slate-200">Morning reminder</Text>
              <Switch
                value={notifPrefs.morningReminder}
                onValueChange={(v) => updateNotifPref('morningReminder', v)}
                trackColor={{ false: '#e2e8f0', true: '#86efac' }}
                thumbColor="#fff"
              />
            </View>
            <View className="h-px bg-slate-200 dark:bg-slate-600" />
            <View className="flex-row items-center justify-between py-3">
              <Text className="text-text dark:text-slate-200">Evening reminder</Text>
              <Switch
                value={notifPrefs.eveningReminder}
                onValueChange={(v) => updateNotifPref('eveningReminder', v)}
                trackColor={{ false: '#e2e8f0', true: '#86efac' }}
                thumbColor="#fff"
              />
            </View>
          </Card>

          <Card>
            <Text className="mb-3 font-sans-semibold text-text dark:text-slate-100">
              Progress
            </Text>
            <Pressable
              className="flex-row items-center justify-between py-3"
              onPress={() =>
                (navigation.getParent() as { navigate: (s: string) => void } | undefined)
                  ?.navigate('WeeklySummary')
              }
            >
              <Text className="text-text dark:text-slate-200">Weekly Summary</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </Pressable>
          </Card>

          <Card>
            <Text className="mb-3 font-sans-semibold text-text dark:text-slate-100">
              Connected accounts
            </Text>
            <Pressable
              className="flex-row items-center justify-between py-3"
              onPress={() =>
                (navigation.getParent() as { navigate: (s: string) => void } | undefined)
                  ?.navigate('TelegramConnect')
              }
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="paper-plane" size={20} color="#3b82f6" />
                <Text className="text-text dark:text-slate-200">Telegram</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Badge
                  variant={telegramStatus?.linked ? 'success' : 'warning'}
                >
                  {telegramStatus?.linked ? 'Connected' : 'Not connected'}
                </Badge>
                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
              </View>
            </Pressable>
          </Card>

          <Card>
            <Text className="mb-3 font-sans-semibold text-text dark:text-slate-100">
              Subscription
            </Text>
            <Pressable
              className="flex-row items-center justify-between py-3"
              onPress={() =>
                (navigation.getParent() as { navigate: (s: string) => void } | undefined)
                  ?.navigate('Subscription')
              }
            >
              <Text className="text-text dark:text-slate-200">Current plan</Text>
              <View className="flex-row items-center gap-2">
                <Badge
                  variant={subscription?.tier === 'pro' ? 'success' : 'neutral'}
                >
                  {subscription?.tier === 'pro' ? 'Pro' : 'Free'}
                </Badge>
                <Text className="text-sm text-primary-600 dark:text-primary-400">
                  Manage
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
              </View>
            </Pressable>
          </Card>

          <Card>
            <Text className="mb-3 font-sans-semibold text-text dark:text-slate-100">
              Privacy
            </Text>
            <Pressable
              className="flex-row items-center justify-between py-3"
              onPress={handleExportData}
            >
              <Text className="text-text dark:text-slate-200">Export Data</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </Pressable>
            <View className="h-px bg-slate-200 dark:bg-slate-600" />
            <Pressable
              className="flex-row items-center justify-between py-3"
              onPress={handleDeleteAccount}
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-danger">Delete Account</Text>
                <Badge variant="danger">Warning</Badge>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </Pressable>
          </Card>

          <Card>
            <Text className="mb-3 font-sans-semibold text-text dark:text-slate-100">
              Legal
            </Text>
            <Pressable className="flex-row items-center justify-between py-3">
              <Text className="text-text dark:text-slate-200">Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </Pressable>
            <View className="h-px bg-slate-200 dark:bg-slate-600" />
            <Pressable className="flex-row items-center justify-between py-3">
              <Text className="text-text dark:text-slate-200">Terms of Service</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
            </Pressable>
          </Card>

          <Text className="text-center text-sm text-text-tertiary dark:text-slate-500">
            Coach v{appVersion}
          </Text>

          <Button variant="danger" onPress={handleSignOut} className="mt-4">
            Sign Out
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
