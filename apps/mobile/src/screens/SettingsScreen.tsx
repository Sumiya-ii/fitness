import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Badge } from '../components/ui';
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

function getInitials(name: string | null | undefined): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  label: string;
  description?: string;
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
  description,
  value,
  right,
  onPress,
  danger,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={() => {
        if (onPress) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }
      }}
      className="flex-row items-center py-3.5"
    >
      <View className={`h-9 w-9 rounded-xl ${iconBg} items-center justify-center mr-3`}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className={`font-sans-medium ${danger ? 'text-red-400' : 'text-text'}`}>{label}</Text>
        {description && <Text className="text-xs text-text-tertiary mt-0.5">{description}</Text>}
      </View>
      {value && <Text className="text-sm text-text-secondary font-sans-medium mr-2">{value}</Text>}
      {right}
      {onPress && !right && <Ionicons name="chevron-forward" size={16} color="#c3cedf" />}
    </Pressable>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-widest mb-2 px-1">
        {title}
      </Text>
      <View className="rounded-2xl bg-surface-card border border-surface-border px-4">
        {children}
      </View>
    </View>
  );
}

function SettingsDivider() {
  return <View className="h-px bg-surface-secondary ml-12" />;
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row bg-surface-secondary rounded-lg p-0.5">
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(opt.value);
          }}
          className={`px-3 py-1.5 rounded-md ${value === opt.value ? 'bg-surface-card' : ''}`}
        >
          <Text
            className={`text-xs font-sans-semibold ${value === opt.value ? 'text-text' : 'text-text-tertiary'}`}
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
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
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
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

  const updateNotifPref = async (key: keyof NotificationPrefs, value: boolean) => {
    const prev = { ...notifPrefs };
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    try {
      await api.put('/notifications/preferences', next);
    } catch {
      setNotifPrefs(prev);
    }
  };

  const handleLanguageSelect = async (locale: string) => {
    await setLocale(locale as Locale);
    try {
      await api.put('/profile', { locale });
      setProfile((p) => (p ? { ...p, locale } : p));
    } catch {
      /* keep local */
    }
  };

  const handleUnitsSelect = async (unitSystem: string) => {
    try {
      await api.put('/profile', { unitSystem });
      setProfile((p) => (p ? { ...p, unitSystem } : p));
    } catch {
      /* ignore */
    }
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

  const navigate = (screen: string) =>
    (navigation.getParent() as { navigate: (s: string) => void } | undefined)?.navigate(screen);

  const appVersion = Constants.expoConfig?.version ?? '0.0.1';
  const currentLang = profile?.locale ?? currentLocale;
  const currentUnits = profile?.unitSystem ?? 'metric';
  const isPro = subscription?.tier === 'pro';

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <View className="px-5 pt-3 pb-4">
          <Text className="text-2xl font-sans-bold text-text">Settings</Text>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Profile Card ── */}
          <View className="rounded-2xl bg-surface-card border border-surface-border p-4 mb-5">
            <View className="flex-row items-center">
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  height: 60,
                  width: 60,
                  borderRadius: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 14,
                }}
              >
                {editingName ? (
                  <Ionicons name="person" size={26} color="#ffffff" />
                ) : (
                  <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '700' }}>
                    {getInitials(profile?.displayName)}
                  </Text>
                )}
              </LinearGradient>

              <View className="flex-1">
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
                      <Ionicons name="checkmark-circle" size={26} color="#0f172a" />
                    </Pressable>
                    <Pressable onPress={() => setEditingName(false)}>
                      <Ionicons name="close-circle" size={26} color="#c3cedf" />
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View className="flex-row items-center gap-2">
                      <Text className="font-sans-bold text-text text-lg leading-snug">
                        {profile?.displayName ?? 'User'}
                      </Text>
                      {isPro && (
                        <View
                          style={{
                            backgroundColor: '#0f172a',
                            borderRadius: 99,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ color: '#22d3ee', fontSize: 10, fontWeight: '700' }}>
                            PRO
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-sm text-text-secondary mt-0.5">
                      {isPro ? 'Pro Member' : 'Free Plan'}
                    </Text>
                  </>
                )}
              </View>

              {!editingName && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleEditProfile();
                  }}
                  className="rounded-xl bg-surface-secondary px-3 py-2"
                >
                  <Text className="text-xs font-sans-semibold text-text-secondary">Edit</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* ── Subscription Banner ── */}
          {!isPro ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigate('Subscription');
              }}
              className="rounded-2xl overflow-hidden mb-5"
            >
              <LinearGradient
                colors={['#0f172a', '#1a2744']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 20 }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Ionicons name="diamond" size={13} color="#22d3ee" />
                  <Text
                    style={{
                      color: '#22d3ee',
                      fontSize: 10,
                      fontWeight: '700',
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                    }}
                  >
                    Coach Pro
                  </Text>
                </View>
                <Text
                  style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 4 }}
                >
                  Unlock the full experience
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>
                  AI nutrition coaching, Telegram logging, and weekly insights.
                </Text>
                <View className="flex-row gap-5 mb-5">
                  {[
                    { icon: 'sparkles' as const, text: 'AI Coach' },
                    { icon: 'paper-plane-outline' as const, text: 'Telegram' },
                    { icon: 'bar-chart-outline' as const, text: 'Insights' },
                  ].map((f) => (
                    <View key={f.text} className="flex-row items-center gap-1.5">
                      <Ionicons name={f.icon} size={13} color="#22d3ee" />
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>{f.text}</Text>
                    </View>
                  ))}
                </View>
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    paddingVertical: 13,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                    Upgrade to Pro →
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          ) : (
            <View className="rounded-2xl bg-primary-500 p-4 mb-5">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View
                    style={{
                      height: 40,
                      width: 40,
                      borderRadius: 10,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="diamond" size={20} color="#22d3ee" />
                  </View>
                  <View>
                    <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>
                      Pro Member
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>All features unlocked</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigate('Subscription');
                  }}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>Manage</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Preferences ── */}
          <SettingsSection title="Preferences">
            <View className="py-3.5 flex-row items-center">
              <View className="h-9 w-9 rounded-xl bg-blue-500/15 items-center justify-center mr-3">
                <Ionicons name="language-outline" size={18} color="#3b82f6" />
              </View>
              <Text className="flex-1 font-sans-medium text-text">Language</Text>
              <SegmentedControl
                options={[
                  { label: 'EN', value: 'en' },
                  { label: 'МН', value: 'mn' },
                ]}
                value={currentLang}
                onChange={handleLanguageSelect}
              />
            </View>
            <SettingsDivider />
            <View className="py-3.5 flex-row items-center">
              <View className="h-9 w-9 rounded-xl bg-violet-500/15 items-center justify-center mr-3">
                <Ionicons name="resize-outline" size={18} color="#8b5cf6" />
              </View>
              <Text className="flex-1 font-sans-medium text-text">Units</Text>
              <SegmentedControl
                options={[
                  { label: 'Metric', value: 'metric' },
                  { label: 'Imperial', value: 'imperial' },
                ]}
                value={currentUnits}
                onChange={handleUnitsSelect}
              />
            </View>
          </SettingsSection>

          {/* ── Notifications ── */}
          <SettingsSection title="Notifications">
            <View className="flex-row items-center py-4">
              <View className="h-9 w-9 rounded-xl bg-amber-500/15 items-center justify-center mr-3">
                <Ionicons name="sunny-outline" size={18} color="#f59e0b" />
              </View>
              <View className="flex-1 mr-3">
                <Text className="font-sans-medium text-text">Morning reminder</Text>
                <Text className="text-xs text-text-tertiary mt-0.5">
                  Start the day with a nutrition check-in
                </Text>
              </View>
              <Switch
                value={notifPrefs.morningReminder}
                onValueChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateNotifPref('morningReminder', v);
                }}
                trackColor={{ false: '#dde5f0', true: '#0f172a' }}
                thumbColor="#ffffff"
              />
            </View>
            <SettingsDivider />
            <View className="flex-row items-center py-4">
              <View className="h-9 w-9 rounded-xl bg-indigo-500/15 items-center justify-center mr-3">
                <Ionicons name="moon-outline" size={18} color="#818cf8" />
              </View>
              <View className="flex-1 mr-3">
                <Text className="font-sans-medium text-text">Evening reminder</Text>
                <Text className="text-xs text-text-tertiary mt-0.5">
                  Review your day and log dinner
                </Text>
              </View>
              <Switch
                value={notifPrefs.eveningReminder}
                onValueChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateNotifPref('eveningReminder', v);
                }}
                trackColor={{ false: '#dde5f0', true: '#0f172a' }}
                thumbColor="#ffffff"
              />
            </View>
          </SettingsSection>

          {/* ── Integrations ── */}
          <View className="mb-5">
            <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-widest mb-2 px-1">
              Integrations
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigate('TelegramConnect');
              }}
              className="rounded-2xl bg-surface-card border border-surface-border overflow-hidden"
            >
              <LinearGradient
                colors={['#1d4ed8', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingHorizontal: 16, paddingVertical: 16 }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View
                      style={{
                        height: 40,
                        width: 40,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="paper-plane" size={20} color="#ffffff" />
                    </View>
                    <View>
                      <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700' }}>
                        Telegram Coach
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                        {telegramStatus?.linked
                          ? `@${telegramStatus.telegramUsername ?? 'connected'}`
                          : 'Log meals via chat'}
                      </Text>
                    </View>
                  </View>
                  <Badge variant={telegramStatus?.linked ? 'success' : 'warning'}>
                    {telegramStatus?.linked ? 'Active' : 'Connect'}
                  </Badge>
                </View>
              </LinearGradient>

              <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                <View className="flex-row justify-between items-center">
                  <View className="flex-row gap-4">
                    {telegramStatus?.linked
                      ? [
                          {
                            icon: 'checkmark-circle' as const,
                            text: 'Photo logging',
                            active: true,
                          },
                          { icon: 'checkmark-circle' as const, text: 'Reminders', active: true },
                          { icon: 'checkmark-circle' as const, text: 'AI replies', active: true },
                        ].map((f) => (
                          <View key={f.text} className="flex-row items-center gap-1">
                            <Ionicons name={f.icon} size={13} color="#16a34a" />
                            <Text style={{ fontSize: 12, color: '#51617a', fontWeight: '500' }}>
                              {f.text}
                            </Text>
                          </View>
                        ))
                      : [
                          { icon: 'camera-outline' as const, text: 'Photos' },
                          { icon: 'mic-outline' as const, text: 'Voice' },
                          { icon: 'notifications-outline' as const, text: 'Reminders' },
                        ].map((f) => (
                          <View key={f.text} className="flex-row items-center gap-1">
                            <Ionicons name={f.icon} size={13} color="#7687a2" />
                            <Text style={{ fontSize: 12, color: '#7687a2' }}>{f.text}</Text>
                          </View>
                        ))}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#c3cedf" />
                </View>
              </View>
            </Pressable>
          </View>

          {/* ── AI Coach ── */}
          <SettingsSection title="AI Coach">
            <SettingsRow
              icon="sparkles"
              iconColor="#8b5cf6"
              iconBg="bg-violet-500/15"
              label="Chat with Coach"
              description="Personalized nutrition guidance"
              right={
                <View className="flex-row items-center gap-2">
                  <View className="px-2 py-0.5 rounded-full bg-surface-secondary">
                    <Text className="text-xs font-sans-medium text-text-tertiary">GPT-4o</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#c3cedf" />
                </View>
              }
              onPress={() => navigate('CoachChat')}
            />
          </SettingsSection>

          {/* ── Privacy & Legal ── */}
          <SettingsSection title="Privacy & Legal">
            <SettingsRow
              icon="download-outline"
              iconColor="#06b6d4"
              iconBg="bg-cyan-500/15"
              label="Export My Data"
              description="Download a copy of all your data"
              onPress={handleExportData}
            />
            <SettingsDivider />
            <SettingsRow
              icon="shield-checkmark-outline"
              iconColor="#8b8fa0"
              iconBg="bg-surface-secondary"
              label="Privacy Policy"
              onPress={() =>
                Alert.alert('Privacy Policy', 'Privacy policy will be available at launch.')
              }
            />
            <SettingsDivider />
            <SettingsRow
              icon="document-text-outline"
              iconColor="#8b8fa0"
              iconBg="bg-surface-secondary"
              label="Terms of Service"
              onPress={() =>
                Alert.alert('Terms of Service', 'Terms of service will be available at launch.')
              }
            />
          </SettingsSection>

          {/* ── Account ── */}
          <SettingsSection title="Account">
            <SettingsRow
              icon="log-out-outline"
              iconColor="#f59e0b"
              iconBg="bg-amber-500/10"
              label="Sign Out"
              onPress={handleSignOut}
            />
            <SettingsDivider />
            <SettingsRow
              icon="trash-outline"
              iconColor="#ef4444"
              iconBg="bg-red-500/10"
              label="Delete Account"
              description="Permanently remove your account and all data"
              danger
              onPress={handleDeleteAccount}
            />
          </SettingsSection>

          <Text className="text-center text-xs text-text-tertiary font-sans-medium mt-1 mb-2">
            Coach v{appVersion}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
