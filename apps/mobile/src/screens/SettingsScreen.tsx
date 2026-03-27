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
import { useSubscriptionStore } from '../stores/subscription.store';
import { useSettingsStore } from '../stores/settings.store';
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

function getInitials(name: string | null | undefined): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ─── Building blocks ─── */

function Pill({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row bg-surface-tertiary rounded-xl p-[3px]">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(opt.value);
            }}
            className={`px-4 py-1.5 rounded-[10px] ${active ? 'bg-surface-card shadow-sm' : ''}`}
          >
            <Text
              className={`text-[13px] font-sans-semibold ${active ? 'text-text' : 'text-text-tertiary'}`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  right,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        if (onPress) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }
      }}
      className="flex-row items-center py-[14px]"
    >
      <Ionicons
        name={icon}
        size={20}
        color={danger ? '#ef4444' : '#7687a2'}
        style={{ width: 28 }}
      />
      <Text
        className={`flex-1 text-[15px] font-sans-medium ${danger ? 'text-red-500' : 'text-text'}`}
      >
        {label}
      </Text>
      {value && (
        <Text className="text-[13px] text-text-tertiary font-sans-medium mr-1">{value}</Text>
      )}
      {right}
      {onPress && !right && <Ionicons name="chevron-forward" size={16} color="#c3cedf" />}
    </Pressable>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-surface-card rounded-2xl px-4 mb-3 border border-surface-border">
      {children}
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-surface-secondary" />;
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
  const isPro = useSubscriptionStore((s) => s.tier === 'pro');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [profileRes, notifRes, telegramRes, permResult] = await Promise.all([
        api.get<{ data: ProfileData }>('/profile'),
        api.get<{ data: NotificationPrefs }>('/notifications/preferences'),
        api.get<TelegramStatus>('/telegram/status'),
        Notifications.getPermissionsAsync(),
      ]);
      setProfile(profileRes.data);
      setNotifPrefs(notifRes.data);
      setTelegramStatus(telegramRes);
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

  const setUnitSystem = useSettingsStore((s) => s.setUnitSystem);
  const currentUnitsFromStore = useSettingsStore((s) => s.unitSystem);

  const handleUnitsSelect = async (unitSystem: string) => {
    if (unitSystem === 'metric' || unitSystem === 'imperial') {
      await setUnitSystem(unitSystem);
      setProfile((p) => (p ? { ...p, unitSystem } : p));
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
  const currentUnits = currentUnitsFromStore;

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Profile ── */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              handleEditProfile();
            }}
            className="flex-row items-center py-8"
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="h-14 w-14 rounded-full items-center justify-center mr-4"
            >
              <Text className="text-white text-lg font-sans-bold">
                {getInitials(profile?.displayName)}
              </Text>
            </LinearGradient>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-sans-bold text-text">
                  {profile?.displayName ?? t('settings.user')}
                </Text>
                {isPro && (
                  <View className="bg-primary-500 rounded-full px-2 py-0.5">
                    <Text className="text-[10px] font-sans-bold text-cyan-400">PRO</Text>
                  </View>
                )}
              </View>
              <Text className="text-[13px] text-text-tertiary font-sans-medium mt-0.5">
                {t('settings.account')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#c3cedf" />
          </Pressable>

          {/* ── Name edit overlay ── */}
          {editingName && (
            <Section>
              <View className="flex-row items-center py-3 gap-2">
                <TextInput
                  className="flex-1 text-text font-sans-medium text-[15px] border-b border-primary-500 pb-1"
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  onSubmitEditing={handleSaveName}
                  returnKeyType="done"
                  placeholderTextColor="#9a9caa"
                  placeholder={t('settings.yourName')}
                />
                <Pressable onPress={handleSaveName}>
                  <Ionicons name="checkmark-circle" size={26} color="#16a34a" />
                </Pressable>
                <Pressable onPress={() => setEditingName(false)}>
                  <Ionicons name="close-circle" size={26} color="#c3cedf" />
                </Pressable>
              </View>
            </Section>
          )}

          {/* ── Upgrade banner ── */}
          {!isPro && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigate('Subscription');
              }}
              className="mb-3"
            >
              <LinearGradient
                colors={['#0f172a', '#1e293b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="rounded-2xl px-4 py-4 flex-row items-center"
              >
                <Ionicons name="diamond" size={20} color="#22d3ee" style={{ marginRight: 12 }} />
                <View className="flex-1">
                  <Text className="text-[15px] font-sans-bold text-white">
                    {t('settings.upgradeToPro')}
                  </Text>
                  <Text className="text-xs text-slate-400 mt-0.5">{t('settings.unlockDesc')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#475569" />
              </LinearGradient>
            </Pressable>
          )}

          {/* ── Preferences ── */}
          <Section>
            <View className="flex-row items-center py-[14px]">
              <Ionicons name="language-outline" size={20} color="#7687a2" style={{ width: 28 }} />
              <Text className="flex-1 text-[15px] font-sans-medium text-text">
                {t('settings.language')}
              </Text>
              <Pill
                options={[
                  { label: 'EN', value: 'en' },
                  { label: 'МН', value: 'mn' },
                ]}
                value={currentLang}
                onChange={handleLanguageSelect}
              />
            </View>
            <Divider />
            <View className="flex-row items-center py-[14px]">
              <Ionicons name="resize-outline" size={20} color="#7687a2" style={{ width: 28 }} />
              <Text className="flex-1 text-[15px] font-sans-medium text-text">
                {t('settings.units')}
              </Text>
              <Pill
                options={[
                  { label: t('settings.metric'), value: 'metric' },
                  { label: t('settings.imperial'), value: 'imperial' },
                ]}
                value={currentUnits}
                onChange={handleUnitsSelect}
              />
            </View>
          </Section>

          {/* ── Integrations ── */}
          <Section>
            <Row
              icon="sparkles-outline"
              label={t('settings.aiCoach')}
              onPress={() => navigate('CoachChat')}
            />
            <Divider />
            <Row
              icon="paper-plane-outline"
              label={t('settings.telegramCoach')}
              right={
                <View className="flex-row items-center gap-2">
                  <View
                    className={`h-2 w-2 rounded-full ${telegramStatus?.linked ? 'bg-green-500' : 'bg-surface-muted'}`}
                  />
                  <Ionicons name="chevron-forward" size={16} color="#c3cedf" />
                </View>
              }
              onPress={() => navigate('TelegramConnect')}
            />
            {isPro && (
              <>
                <Divider />
                <Row
                  icon="diamond-outline"
                  label={t('settings.proMember')}
                  value={t('settings.manage')}
                  onPress={() => navigate('Subscription')}
                />
              </>
            )}
          </Section>

          {/* ── Notifications ── */}
          <Section>
            {osPermission === 'denied' ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Linking.openSettings();
                }}
                className="flex-row items-center py-[14px]"
              >
                <Ionicons
                  name="notifications-off-outline"
                  size={20}
                  color="#ef4444"
                  style={{ width: 28 }}
                />
                <Text className="flex-1 text-[15px] font-sans-medium text-text">
                  {t('settings.notifications')}
                </Text>
                <Text className="text-[13px] text-red-400 font-sans-medium mr-1">
                  {t('settings.openSettings')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#c3cedf" />
              </Pressable>
            ) : osPermission === 'undetermined' ? (
              <Pressable
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const granted = await requestAndRegisterPushToken();
                  setOsPermission(granted ? 'granted' : 'denied');
                }}
                className="flex-row items-center py-[14px]"
              >
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color="#f59e0b"
                  style={{ width: 28 }}
                />
                <Text className="flex-1 text-[15px] font-sans-medium text-text">
                  {t('settings.notifications')}
                </Text>
                <Text className="text-[13px] text-primary-500 font-sans-medium mr-1">
                  {t('settings.turnOnNotifications')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#c3cedf" />
              </Pressable>
            ) : (
              <>
                <View className="flex-row items-center py-[14px]">
                  <Ionicons name="sunny-outline" size={20} color="#7687a2" style={{ width: 28 }} />
                  <Text className="flex-1 text-[15px] font-sans-medium text-text">
                    {t('settings.morningReminder')}
                  </Text>
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
                <Divider />
                <View className="flex-row items-center py-[14px]">
                  <Ionicons name="moon-outline" size={20} color="#7687a2" style={{ width: 28 }} />
                  <Text className="flex-1 text-[15px] font-sans-medium text-text">
                    {t('settings.eveningReminder')}
                  </Text>
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
          </Section>

          {/* ── Support & Legal ── */}
          <Section>
            <Row
              icon="download-outline"
              label={t('settings.exportMyData')}
              onPress={handleExportData}
            />
            <Divider />
            <Row
              icon="shield-checkmark-outline"
              label={t('settings.privacyPolicy')}
              onPress={() => Linking.openURL('https://www.nexuskairos.com/coach/privacy')}
            />
            <Divider />
            <Row
              icon="document-text-outline"
              label={t('settings.termsOfService')}
              onPress={() => Linking.openURL('https://www.nexuskairos.com/coach/terms')}
            />
            <Divider />
            <Row
              icon="help-circle-outline"
              label={t('settings.support')}
              onPress={() => Linking.openURL('https://www.nexuskairos.com/coach/support')}
            />
          </Section>

          {/* ── Danger zone ── */}
          <Section>
            <Row icon="log-out-outline" label={t('settings.signOut')} onPress={handleSignOut} />
            <Divider />
            <Row
              icon="trash-outline"
              label={t('settings.deleteAccount')}
              danger
              onPress={handleDeleteAccount}
            />
          </Section>

          {/* ── Version ── */}
          <Text className="text-center text-xs text-text-tertiary/50 font-sans-medium mt-4 mb-2">
            v{appVersion}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
