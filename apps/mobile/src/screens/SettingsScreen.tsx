import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../stores/auth.store';
import { api } from '../api';
import { useLocale, type Locale } from '../i18n';
import { requestAndRegisterPushToken } from '../hooks/usePushNotifications';

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

/* ─── Reusable building blocks ─── */

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  label: string;
  subtitle?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

function SettingsRow({
  icon,
  iconColor = '#7687a2',
  iconBg = 'bg-surface-secondary',
  label,
  subtitle,
  value,
  right,
  onPress,
  danger,
  isFirst,
  isLast,
}: SettingsRowProps) {
  return (
    <>
      {!isFirst && <View className="h-px bg-surface-secondary ml-14" />}
      <Pressable
        onPress={() => {
          if (onPress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }
        }}
        className={`flex-row items-center px-4 ${isFirst ? 'pt-3' : 'pt-3'} ${isLast ? 'pb-3' : 'pb-3'}`}
      >
        <View className={`h-8 w-8 rounded-lg ${iconBg} items-center justify-center mr-3`}>
          <Ionicons name={icon} size={17} color={iconColor} />
        </View>
        <View className="flex-1 mr-2">
          <Text className={`text-[15px] ${danger ? 'text-red-500' : 'text-text'} font-sans-medium`}>
            {label}
          </Text>
          {subtitle && (
            <Text className="text-xs text-text-tertiary mt-0.5" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {value && (
          <Text className="text-sm text-text-tertiary font-sans-medium mr-1.5">{value}</Text>
        )}
        {right}
        {onPress && !right && <Ionicons name="chevron-forward" size={16} color="#c3cedf" />}
      </Pressable>
    </>
  );
}

function SettingsSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      {title && (
        <Text className="text-xs font-sans-semibold text-text-tertiary uppercase tracking-widest mb-1.5 ml-4">
          {title}
        </Text>
      )}
      <View className="rounded-2xl bg-surface-card border border-surface-border overflow-hidden">
        {children}
      </View>
    </View>
  );
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

/* ─── Main screen ─── */

export function SettingsScreen() {
  const navigation = useNavigation();
  const signOut = useAuthStore((s) => s.signOut);
  const { locale: currentLocale, setLocale, t } = useLocale();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    morningReminder: true,
    eveningReminder: true,
  });
  const [osPermission, setOsPermission] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [profileRes, notifRes, telegramRes, subRes, permResult] = await Promise.all([
        api.get<{ data: ProfileData }>('/profile'),
        api.get<{ data: NotificationPrefs }>('/notifications/preferences'),
        api.get<TelegramStatus>('/telegram/status'),
        api.get<{ data: SubscriptionStatus }>('/subscriptions/status'),
        Notifications.getPermissionsAsync(),
      ]);
      setProfile(profileRes.data);
      setNotifPrefs(notifRes.data);
      setTelegramStatus(telegramRes);
      setSubscription(subRes.data);
      setOsPermission(
        permResult.status === 'granted'
          ? 'granted'
          : permResult.status === 'denied'
            ? 'denied'
            : 'undetermined',
      );
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

  /* ── Handlers ── */

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
    Alert.alert(t('settings.signOut'), t('settings.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.signOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  const handleExportData = () => {
    Alert.alert(t('settings.exportData'), t('settings.exportConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.export'),
        onPress: () => {
          api.post('/privacy/export').catch(() => {});
          Alert.alert(t('common.success'), t('settings.exportSuccess'));
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('settings.deleteAccount'), t('settings.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post('/privacy/delete-account');
            Alert.alert(t('settings.deleteRequested'), t('settings.deleteRequestedDesc'), [
              { text: 'OK', onPress: signOut },
            ]);
          } catch {
            Alert.alert(t('common.error'), t('settings.deleteFailed'));
          }
        },
      },
    ]);
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
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Profile header ── */}
          <View className="items-center pt-6 pb-6">
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="h-[72px] w-[72px] rounded-full items-center justify-center mb-3"
            >
              {editingName ? (
                <Ionicons name="person" size={28} color="#ffffff" />
              ) : (
                <Text className="text-white text-2xl font-sans-bold">
                  {getInitials(profile?.displayName)}
                </Text>
              )}
            </LinearGradient>

            {editingName ? (
              <View className="flex-row items-center gap-2 px-8">
                <TextInput
                  className="flex-1 text-text font-sans-medium text-base text-center border-b border-primary-500 pb-1"
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  onSubmitEditing={handleSaveName}
                  returnKeyType="done"
                  placeholderTextColor="#9a9caa"
                  placeholder={t('settings.yourName')}
                />
                <Pressable onPress={handleSaveName} className="ml-1">
                  <Ionicons name="checkmark-circle" size={26} color="#16a34a" />
                </Pressable>
                <Pressable onPress={() => setEditingName(false)}>
                  <Ionicons name="close-circle" size={26} color="#c3cedf" />
                </Pressable>
              </View>
            ) : (
              <>
                <View className="flex-row items-center gap-2 mb-0.5">
                  <Text className="text-lg font-sans-bold text-text">
                    {profile?.displayName ?? t('settings.user')}
                  </Text>
                  {isPro && (
                    <View className="bg-primary-500 rounded-full px-2 py-0.5">
                      <Text className="text-[10px] font-sans-bold text-cyan-400">PRO</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleEditProfile();
                  }}
                >
                  <Text className="text-sm text-text-tertiary font-sans-medium">
                    {t('common.edit')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {/* ── Upgrade banner (free users only) ── */}
          {!isPro && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigate('Subscription');
              }}
              className="mb-6"
            >
              <LinearGradient
                colors={['#0f172a', '#1e293b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="rounded-2xl px-4 py-4 flex-row items-center"
              >
                <View className="h-10 w-10 rounded-xl bg-white/10 items-center justify-center mr-3">
                  <Ionicons name="diamond" size={20} color="#22d3ee" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-sans-bold text-white">
                    {t('settings.upgradeToPro')}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-0.5">{t('settings.unlockDesc')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#475569" />
              </LinearGradient>
            </Pressable>
          )}

          {/* ── Pro status (pro users) ── */}
          {isPro && (
            <SettingsSection>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigate('Subscription');
                }}
                className="flex-row items-center px-4 py-3"
              >
                <View className="h-8 w-8 rounded-lg bg-cyan-500/15 items-center justify-center mr-3">
                  <Ionicons name="diamond" size={17} color="#06b6d4" />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-sans-medium text-text">
                    {t('settings.proMember')}
                  </Text>
                  <Text className="text-xs text-text-tertiary mt-0.5">
                    {t('settings.allFeaturesUnlocked')}
                  </Text>
                </View>
                <Text className="text-sm text-text-tertiary font-sans-medium mr-1.5">
                  {t('settings.manage')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#c3cedf" />
              </Pressable>
            </SettingsSection>
          )}

          {/* ── Features ── */}
          <SettingsSection title={t('settings.integrations')}>
            <SettingsRow
              icon="sparkles"
              iconColor="#8b5cf6"
              iconBg="bg-violet-500/15"
              label={t('settings.aiCoach')}
              subtitle={t('settings.personalizedGuidance')}
              onPress={() => navigate('CoachChat')}
              isFirst
            />
            <SettingsRow
              icon="paper-plane"
              iconColor="#3b82f6"
              iconBg="bg-blue-500/15"
              label={t('settings.telegramCoach')}
              subtitle={
                telegramStatus?.linked
                  ? `@${telegramStatus.telegramUsername ?? 'connected'}`
                  : t('settings.logMealsViaChat')
              }
              right={
                <View className="flex-row items-center gap-2">
                  <View
                    className={`px-2 py-0.5 rounded-full ${telegramStatus?.linked ? 'bg-green-500/15' : 'bg-amber-500/15'}`}
                  >
                    <Text
                      className={`text-[10px] font-sans-semibold ${telegramStatus?.linked ? 'text-green-600' : 'text-amber-600'}`}
                    >
                      {telegramStatus?.linked ? t('settings.active') : t('settings.connect')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#c3cedf" />
                </View>
              }
              onPress={() => navigate('TelegramConnect')}
              isLast
            />
          </SettingsSection>

          {/* ── Preferences ── */}
          <SettingsSection title={t('settings.preferences')}>
            <View className="flex-row items-center px-4 py-3">
              <View className="h-8 w-8 rounded-lg bg-blue-500/15 items-center justify-center mr-3">
                <Ionicons name="language-outline" size={17} color="#3b82f6" />
              </View>
              <Text className="flex-1 text-[15px] font-sans-medium text-text">
                {t('settings.language')}
              </Text>
              <SegmentedControl
                options={[
                  { label: 'EN', value: 'en' },
                  { label: 'МН', value: 'mn' },
                ]}
                value={currentLang}
                onChange={handleLanguageSelect}
              />
            </View>
            <View className="h-px bg-surface-secondary ml-14" />
            <View className="flex-row items-center px-4 py-3">
              <View className="h-8 w-8 rounded-lg bg-violet-500/15 items-center justify-center mr-3">
                <Ionicons name="resize-outline" size={17} color="#8b5cf6" />
              </View>
              <Text className="flex-1 text-[15px] font-sans-medium text-text">
                {t('settings.units')}
              </Text>
              <SegmentedControl
                options={[
                  { label: t('settings.metric'), value: 'metric' },
                  { label: t('settings.imperial'), value: 'imperial' },
                ]}
                value={currentUnits}
                onChange={handleUnitsSelect}
              />
            </View>
          </SettingsSection>

          {/* ── Notifications ── */}
          <SettingsSection title={t('settings.notifications')}>
            {osPermission === 'denied' ? (
              <View className="px-4 py-4">
                <View className="flex-row items-start mb-3">
                  <View className="h-8 w-8 rounded-lg bg-red-500/15 items-center justify-center mr-3 mt-0.5">
                    <Ionicons name="notifications-off-outline" size={17} color="#ef4444" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-sans-medium text-text">
                      {t('settings.notificationsBlocked')}
                    </Text>
                    <Text className="text-xs text-text-tertiary mt-0.5 leading-4">
                      {t('settings.notificationsBlockedDesc')}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    Linking.openSettings();
                  }}
                  className="rounded-xl bg-primary-500 py-2.5 items-center"
                >
                  <Text className="text-sm font-sans-semibold text-white">
                    {t('settings.openSettings')}
                  </Text>
                </Pressable>
              </View>
            ) : osPermission === 'undetermined' ? (
              <View className="px-4 py-4">
                <View className="flex-row items-start mb-3">
                  <View className="h-8 w-8 rounded-lg bg-amber-500/15 items-center justify-center mr-3 mt-0.5">
                    <Ionicons name="notifications-outline" size={17} color="#f59e0b" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-sans-medium text-text">
                      {t('settings.enableNotifications')}
                    </Text>
                    <Text className="text-xs text-text-tertiary mt-0.5 leading-4">
                      {t('settings.enableNotificationsDesc')}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const granted = await requestAndRegisterPushToken();
                    setOsPermission(granted ? 'granted' : 'denied');
                  }}
                  className="rounded-xl bg-primary-500 py-2.5 items-center"
                >
                  <Text className="text-sm font-sans-semibold text-white">
                    {t('settings.turnOnNotifications')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View className="flex-row items-center px-4 py-3">
                  <View className="h-8 w-8 rounded-lg bg-amber-500/15 items-center justify-center mr-3">
                    <Ionicons name="sunny-outline" size={17} color="#f59e0b" />
                  </View>
                  <View className="flex-1 mr-3">
                    <Text className="text-[15px] font-sans-medium text-text">
                      {t('settings.morningReminder')}
                    </Text>
                    <Text className="text-xs text-text-tertiary mt-0.5">
                      {t('settings.morningReminderDesc')}
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
                <View className="h-px bg-surface-secondary ml-14" />
                <View className="flex-row items-center px-4 py-3">
                  <View className="h-8 w-8 rounded-lg bg-indigo-500/15 items-center justify-center mr-3">
                    <Ionicons name="moon-outline" size={17} color="#818cf8" />
                  </View>
                  <View className="flex-1 mr-3">
                    <Text className="text-[15px] font-sans-medium text-text">
                      {t('settings.eveningReminder')}
                    </Text>
                    <Text className="text-xs text-text-tertiary mt-0.5">
                      {t('settings.eveningReminderDesc')}
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
              </>
            )}
          </SettingsSection>

          {/* ── Support ── */}
          <SettingsSection title={t('settings.privacyLegal')}>
            <SettingsRow
              icon="download-outline"
              iconColor="#06b6d4"
              iconBg="bg-cyan-500/15"
              label={t('settings.exportMyData')}
              subtitle={t('settings.exportMyDataDesc')}
              onPress={handleExportData}
              isFirst
            />
            <SettingsRow
              icon="shield-checkmark-outline"
              iconColor="#7687a2"
              iconBg="bg-surface-secondary"
              label={t('settings.privacyPolicy')}
              onPress={() =>
                Alert.alert(t('settings.privacyPolicy'), t('settings.privacyPolicyNotice'))
              }
            />
            <SettingsRow
              icon="document-text-outline"
              iconColor="#7687a2"
              iconBg="bg-surface-secondary"
              label={t('settings.termsOfService')}
              onPress={() => Alert.alert(t('settings.termsOfService'), t('settings.termsNotice'))}
              isLast
            />
          </SettingsSection>

          {/* ── Account ── */}
          <SettingsSection title={t('settings.account')}>
            <SettingsRow
              icon="log-out-outline"
              iconColor="#f59e0b"
              iconBg="bg-amber-500/10"
              label={t('settings.signOut')}
              onPress={handleSignOut}
              isFirst
            />
            <SettingsRow
              icon="trash-outline"
              iconColor="#ef4444"
              iconBg="bg-red-500/10"
              label={t('settings.deleteAccount')}
              danger
              onPress={handleDeleteAccount}
              isLast
            />
          </SettingsSection>

          {/* ── Footer ── */}
          <Text className="text-center text-xs text-text-tertiary font-sans-medium mt-1 mb-2">
            Coach v{appVersion}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
