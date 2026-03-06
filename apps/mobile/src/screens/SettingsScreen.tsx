import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Badge, Button } from '../components/ui';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../api';
import { useLocale, type Locale } from '../i18n';

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

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  label: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}

function SettingsRow({
  icon,
  iconColor = '#9a9caa',
  iconBg = 'bg-surface-secondary',
  label,
  value,
  right,
  onPress,
  danger,
}: SettingsRowProps) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center py-3.5">
      <View
        className={`h-9 w-9 rounded-xl ${iconBg} items-center justify-center mr-3`}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text
          className={`font-sans-medium ${danger ? 'text-red-400' : 'text-text'}`}
        >
          {label}
        </Text>
      </View>
      {value && (
        <Text className="text-sm text-text-secondary font-sans-medium mr-2">
          {value}
        </Text>
      )}
      {right}
      {onPress && !right && (
        <Ionicons name="chevron-forward" size={18} color="#777985" />
      )}
    </Pressable>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-wider mb-2 px-1">
        {title}
      </Text>
      <View className="rounded-2xl bg-surface-card border border-surface-border px-4">
        {children}
      </View>
    </View>
  );
}

function SettingsDivider() {
  return <View className="h-px bg-surface-secondary" />;
}

export function SettingsScreen() {
  const navigation = useNavigation();
  const signOut = useAuthStore((s) => s.signOut);
  const { locale: currentLocale, setLocale } = useLocale();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    morningReminder: true,
    eveningReminder: true,
  });
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(
    null,
  );
  const [subscription, setSubscription] =
    useState<SubscriptionStatus | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

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

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const updateNotifPref = async (
    key: keyof NotificationPrefs,
    value: boolean,
  ) => {
    const prev = { ...notifPrefs };
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    try {
      await api.put('/notifications/preferences', next);
    } catch {
      setNotifPrefs(prev);
    }
  };

  const handleLanguageChange = () => {
    Alert.alert('Language / Хэл', 'Select your preferred language', [
      {
        text: 'English',
        onPress: async () => {
          await setLocale('en' as Locale);
          try {
            await api.put('/profile', { locale: 'en' });
            setProfile((p) => (p ? { ...p, locale: 'en' } : p));
          } catch {
            /* keep local */
          }
        },
      },
      {
        text: 'Монгол',
        onPress: async () => {
          await setLocale('mn' as Locale);
          try {
            await api.put('/profile', { locale: 'mn' });
            setProfile((p) => (p ? { ...p, locale: 'mn' } : p));
          } catch {
            /* keep local */
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleUnitsChange = () => {
    Alert.alert('Units', 'Select your preferred unit system', [
      {
        text: 'Metric (kg, cm)',
        onPress: async () => {
          try {
            await api.put('/profile', { unitSystem: 'metric' });
            setProfile((p) => (p ? { ...p, unitSystem: 'metric' } : p));
          } catch {
            /* ignore */
          }
        },
      },
      {
        text: 'Imperial (lb, in)',
        onPress: async () => {
          try {
            await api.put('/profile', { unitSystem: 'imperial' });
            setProfile((p) => (p ? { ...p, unitSystem: 'imperial' } : p));
          } catch {
            /* ignore */
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleEditProfile = () => {
    setNameInput(profile?.displayName ?? '');
    setEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try {
      await api.put('/profile', { displayName: trimmed });
      setProfile((p) => (p ? { ...p, displayName: trimmed } : p));
    } catch {
      /* ignore */
    }
    setEditingName(false);
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
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: () => {
            api.post('/privacy/export').catch(() => {});
            Alert.alert('Success', 'Export request submitted.');
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/privacy/delete-account');
              Alert.alert(
                'Account Deletion Requested',
                'Your account deletion request has been submitted. Your data will be removed within 30 days.',
                [{ text: 'OK', onPress: signOut }],
              );
            } catch {
              Alert.alert('Error', 'Failed to submit deletion request.');
            }
          },
        },
      ],
    );
  };

  const appVersion = Constants.expoConfig?.version ?? '0.0.1';
  const languageLabel =
    (profile?.locale ?? currentLocale) === 'mn' ? 'Монгол' : 'English';
  const unitsLabel =
    profile?.unitSystem === 'imperial' ? 'Imperial' : 'Metric';

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pt-2 pb-4">
          <Text className="text-2xl font-sans-bold text-text">Settings</Text>
        </View>

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View className="rounded-2xl bg-surface-card border border-surface-border p-4 mb-6">
            <View className="flex-row items-center">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-500/20">
                <Ionicons name="person" size={24} color="#1f2028" />
              </View>
              <View className="flex-1 ml-3">
                {editingName ? (
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      className="flex-1 text-text font-sans-medium text-base border-b border-primary-500 pb-1"
                      value={nameInput}
                      onChangeText={setNameInput}
                      autoFocus
                      onSubmitEditing={handleSaveName}
                      returnKeyType="done"
                      placeholderTextColor="#9a9caa"
                      placeholder="Your name"
                    />
                    <Pressable onPress={handleSaveName}>
                      <Ionicons name="checkmark-circle" size={24} color="#1f2028" />
                    </Pressable>
                    <Pressable onPress={() => setEditingName(false)}>
                      <Ionicons name="close-circle" size={24} color="#9a9caa" />
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text className="font-sans-semibold text-text text-base">
                      {profile?.displayName ?? 'User'}
                    </Text>
                    <Text className="text-sm text-text-secondary">
                      {profile?.id ? `ID: ${profile.id.slice(0, 8)}...` : ''}
                    </Text>
                  </>
                )}
              </View>
              {!editingName && (
                <Pressable
                  onPress={handleEditProfile}
                  className="rounded-full bg-surface-secondary px-3 py-1.5"
                >
                  <Text className="text-xs font-sans-medium text-primary-400">
                    Edit
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          <SettingsSection title="Preferences">
            <SettingsRow
              icon="language-outline"
              iconColor="#8b8fa0"
              iconBg="bg-blue-500/15"
              label="Language"
              value={languageLabel}
              onPress={handleLanguageChange}
            />
            <SettingsDivider />
            <SettingsRow
              icon="resize-outline"
              iconColor="#a78bfa"
              iconBg="bg-violet-500/15"
              label="Units"
              value={unitsLabel}
              onPress={handleUnitsChange}
            />
          </SettingsSection>

          <SettingsSection title="Notifications">
            <View className="flex-row items-center py-3.5">
              <View className="h-9 w-9 rounded-xl bg-amber-500/15 items-center justify-center mr-3">
                <Ionicons name="sunny-outline" size={18} color="#8f93a4" />
              </View>
              <Text className="flex-1 font-sans-medium text-text">
                Morning reminder
              </Text>
              <Switch
                value={notifPrefs.morningReminder}
                onValueChange={(v) => updateNotifPref('morningReminder', v)}
                trackColor={{ false: '#d2d2db', true: '#15161d' }}
                thumbColor="#ffffff"
              />
            </View>
            <SettingsDivider />
            <View className="flex-row items-center py-3.5">
              <View className="h-9 w-9 rounded-xl bg-indigo-500/15 items-center justify-center mr-3">
                <Ionicons name="moon-outline" size={18} color="#818cf8" />
              </View>
              <Text className="flex-1 font-sans-medium text-text">
                Evening reminder
              </Text>
              <Switch
                value={notifPrefs.eveningReminder}
                onValueChange={(v) => updateNotifPref('eveningReminder', v)}
                trackColor={{ false: '#d2d2db', true: '#15161d' }}
                thumbColor="#ffffff"
              />
            </View>
          </SettingsSection>

          <SettingsSection title="Connected Accounts">
            <SettingsRow
              icon="paper-plane"
              iconColor="#8b8fa0"
              iconBg="bg-blue-500/15"
              label="Telegram"
              right={
                <View className="flex-row items-center gap-2">
                  <Badge
                    variant={telegramStatus?.linked ? 'success' : 'warning'}
                  >
                    {telegramStatus?.linked ? 'Connected' : 'Not linked'}
                  </Badge>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#777985"
                  />
                </View>
              }
              onPress={() =>
                (
                  navigation.getParent() as
                    | { navigate: (s: string) => void }
                    | undefined
                )?.navigate('TelegramConnect')
              }
            />
          </SettingsSection>

          <SettingsSection title="Subscription">
            <SettingsRow
              icon="diamond-outline"
              iconColor="#1f2028"
              iconBg="bg-primary-500/15"
              label="Current plan"
              right={
                <View className="flex-row items-center gap-2">
                  <Badge
                    variant={
                      subscription?.tier === 'pro' ? 'success' : 'neutral'
                    }
                  >
                    {subscription?.tier === 'pro' ? 'Pro' : 'Free'}
                  </Badge>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#777985"
                  />
                </View>
              }
              onPress={() =>
                (
                  navigation.getParent() as
                    | { navigate: (s: string) => void }
                    | undefined
                )?.navigate('Subscription')
              }
            />
          </SettingsSection>

          <SettingsSection title="Privacy & Legal">
            <SettingsRow
              icon="download-outline"
              iconColor="#22d3ee"
              iconBg="bg-cyan-500/15"
              label="Export Data"
              onPress={handleExportData}
            />
            <SettingsDivider />
            <SettingsRow
              icon="shield-checkmark-outline"
              iconColor="#9a9caa"
              iconBg="bg-surface-secondary"
              label="Privacy Policy"
              onPress={() =>
                Alert.alert(
                  'Privacy Policy',
                  'Privacy policy will be available at launch.',
                )
              }
            />
            <SettingsDivider />
            <SettingsRow
              icon="document-text-outline"
              iconColor="#9a9caa"
              iconBg="bg-surface-secondary"
              label="Terms of Service"
              onPress={() =>
                Alert.alert(
                  'Terms of Service',
                  'Terms of service will be available at launch.',
                )
              }
            />
            <SettingsDivider />
            <SettingsRow
              icon="trash-outline"
              iconColor="#ef4444"
              iconBg="bg-red-500/15"
              label="Delete Account"
              danger
              onPress={handleDeleteAccount}
            />
          </SettingsSection>

          <Text className="text-center text-xs text-text-tertiary mb-4 font-sans-medium">
            Coach v{appVersion}
          </Text>

          <Button variant="danger" onPress={handleSignOut} className="mb-8">
            Sign Out
          </Button>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
