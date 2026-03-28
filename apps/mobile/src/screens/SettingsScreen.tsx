import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../stores/auth.store';
import { useSubscriptionStore } from '../stores/subscription.store';
import { api } from '../api';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

interface ProfileData {
  displayName: string | null;
  id: string;
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
  const c = useColors();
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
      <View
        className="h-8 w-8 rounded-lg items-center justify-center mr-3"
        style={{ backgroundColor: danger ? '#fee2e2' : c.cardAlt }}
      >
        <Ionicons name={icon} size={18} color={danger ? c.danger : c.textTertiary} />
      </View>
      <Text
        className={`flex-1 text-[15px] font-sans-medium ${danger ? 'text-red-500' : 'text-text'}`}
      >
        {label}
      </Text>
      {value && (
        <Text className="text-[13px] text-text-tertiary font-sans-medium mr-1">{value}</Text>
      )}
      {right}
      {onPress && !right && <Ionicons name="chevron-forward" size={16} color={c.muted} />}
    </Pressable>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      {title && (
        <Text className="text-xs text-text-tertiary font-sans-semibold uppercase tracking-wider ml-1 mb-2">
          {title}
        </Text>
      )}
      <View className="bg-surface-card rounded-2xl px-4 border border-surface-border">
        {children}
      </View>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-surface-secondary" />;
}

/* ─── Main screen ─── */

export function SettingsScreen() {
  const c = useColors();
  const navigation = useNavigation();
  const signOut = useAuthStore((s) => s.signOut);
  const { t } = useLocale();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatus | null>(null);
  const isPro = useSubscriptionStore((s) => s.tier === 'pro');

  const loadData = useCallback(async () => {
    try {
      const [profileRes, telegramRes] = await Promise.all([
        api.get<{ data: ProfileData }>('/profile'),
        api.get<TelegramStatus>('/telegram/status'),
      ]);
      setProfile(profileRes.data);
      setTelegramStatus(telegramRes);
    } catch {
      /* keep previous state */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const navigate = (screen: string) =>
    (navigation.getParent() as { navigate: (s: string) => void } | undefined)?.navigate(screen);

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

  const appVersion = Constants.expoConfig?.version ?? '0.0.1';

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Profile card ── */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigate('EditProfile');
            }}
            className="mt-4 mb-6"
          >
            <View className="bg-surface-card rounded-2xl px-5 py-5 border border-surface-border flex-row items-center">
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="h-14 w-14 rounded-full items-center justify-center"
              >
                <Text className="text-white text-lg font-sans-bold">
                  {getInitials(profile?.displayName)}
                </Text>
              </LinearGradient>
              <View className="flex-1 ml-4">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[17px] font-sans-bold text-text">
                    {profile?.displayName ?? t('settings.user')}
                  </Text>
                  {isPro && (
                    <LinearGradient
                      colors={['#667eea', '#764ba2']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      className="rounded-full px-2.5 py-0.5"
                    >
                      <Text className="text-[10px] font-sans-bold text-white">PRO</Text>
                    </LinearGradient>
                  )}
                </View>
                <Text className="text-[13px] text-text-tertiary font-sans-medium mt-0.5">
                  {t('settings.tapToEdit')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.muted} />
            </View>
          </Pressable>

          {/* ── General ── */}
          <Section title={t('settings.general')}>
            <Row
              icon="person-outline"
              label={t('personalDetails.title')}
              onPress={() => navigate('PersonalDetails')}
            />
            <Divider />
            <Row
              icon="settings-outline"
              label={t('settings.preferences')}
              onPress={() => navigate('AppSettings')}
            />
            <Divider />
            <Row
              icon="notifications-outline"
              label={t('settings.reminders')}
              onPress={() => navigate('Reminders')}
            />
          </Section>

          {/* ── Integrations ── */}
          <Section title={t('settings.integrations')}>
            <Row
              icon="paper-plane-outline"
              label={t('settings.telegramCoach')}
              right={
                <View className="flex-row items-center gap-2">
                  <View
                    className={`h-2 w-2 rounded-full ${telegramStatus?.linked ? 'bg-green-500' : 'bg-surface-muted'}`}
                  />
                  <Ionicons name="chevron-forward" size={16} color={c.muted} />
                </View>
              }
              onPress={() => navigate('TelegramConnect')}
            />
          </Section>

          {/* ── Support & Legal ── */}
          <Section title={t('settings.privacyLegal')}>
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

          {/* ── Account actions ── */}
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
          <Text className="text-center text-xs text-text-tertiary/50 font-sans-medium mt-2 mb-2">
            v{appVersion}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
