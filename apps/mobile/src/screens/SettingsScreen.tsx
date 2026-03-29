import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
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

/* ---- Building blocks ---- */

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
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center py-3.5 min-h-[48px]"
    >
      <View
        className="h-9 w-9 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: danger ? `${c.danger}15` : c.cardAlt }}
      >
        <Ionicons name={icon} size={18} color={danger ? c.danger : c.textTertiary} />
      </View>
      <Text
        className="flex-1 text-base leading-6 font-sans-medium"
        style={{ color: danger ? c.danger : c.text }}
      >
        {label}
      </Text>
      {value ? (
        <Text
          className="text-sm leading-5 font-sans-medium mr-1.5"
          style={{ color: c.textTertiary }}
        >
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && !right ? <Ionicons name="chevron-forward" size={16} color={c.muted} /> : null}
    </Pressable>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      {title ? (
        <Text className="text-xs leading-5 font-sans-semibold uppercase tracking-wider ml-1 mb-2 text-text-tertiary">
          {title}
        </Text>
      ) : null}
      <View className="bg-surface-card rounded-2xl px-4 border border-surface-border">
        {children}
      </View>
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-surface-secondary" />;
}

/* ---- Main screen ---- */

export function SettingsScreen() {
  const c = useColors();
  const navigation = useNavigation();
  const signOut = useAuthStore((s) => s.signOut);
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
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
              { text: t('common.ok'), onPress: signOut },
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
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 24) + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* -- Profile card -- */}
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigate('EditProfile');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('settings.editProfile')}
              className="mt-4 mb-6 active:opacity-90"
            >
              <View className="bg-surface-card rounded-3xl px-5 py-5 border border-surface-border flex-row items-center">
                <View
                  className="h-14 w-14 rounded-full items-center justify-center"
                  style={{ backgroundColor: c.primary }}
                >
                  <Text className="text-lg font-sans-bold" style={{ color: c.onPrimary }}>
                    {getInitials(profile?.displayName)}
                  </Text>
                </View>
                <View className="flex-1 ml-4">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-lg leading-7 font-sans-bold text-text">
                      {profile?.displayName ?? t('settings.user')}
                    </Text>
                    {isPro ? (
                      <View
                        className="rounded-full px-2.5 py-0.5"
                        style={{ backgroundColor: c.success }}
                      >
                        <Text className="text-xs font-sans-bold text-white">PRO</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    className="text-sm leading-5 font-sans-medium mt-0.5"
                    style={{ color: c.textTertiary }}
                  >
                    {t('settings.tapToEdit')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </View>
            </Pressable>
          </Animated.View>

          {/* -- General -- */}
          <Animated.View entering={FadeInDown.duration(400).delay(50).springify()}>
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
              <Divider />
              <Row
                icon="color-palette-outline"
                label={t('ringColors.settingsLabel')}
                onPress={() => navigate('RingColorsExplained')}
              />
            </Section>
          </Animated.View>

          {/* -- Integrations -- */}
          <Animated.View entering={FadeInDown.duration(400).delay(100).springify()}>
            <Section title={t('settings.integrations')}>
              <Row
                icon="paper-plane-outline"
                label={t('settings.telegramCoach')}
                right={
                  <View className="flex-row items-center gap-2">
                    <View
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: telegramStatus?.linked ? c.success : c.muted,
                      }}
                    />
                    <Ionicons name="chevron-forward" size={16} color={c.muted} />
                  </View>
                }
                onPress={() => navigate('TelegramConnect')}
              />
            </Section>
          </Animated.View>

          {/* -- Support & Legal -- */}
          <Animated.View entering={FadeInDown.duration(400).delay(150).springify()}>
            <Section title={t('settings.supportLegal')}>
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
          </Animated.View>

          {/* -- Account actions -- */}
          <Animated.View entering={FadeInDown.duration(400).delay(200).springify()}>
            <Section title={t('settings.account')}>
              <Row icon="log-out-outline" label={t('settings.signOut')} onPress={handleSignOut} />
            </Section>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(400).delay(250).springify()}>
            <Section title={t('settings.dangerZone')}>
              <Row
                icon="trash-outline"
                label={t('settings.deleteAccount')}
                danger
                onPress={handleDeleteAccount}
              />
            </Section>
          </Animated.View>

          {/* -- Version -- */}
          <Animated.View entering={FadeInDown.duration(400).delay(300).springify()}>
            <Text
              className="text-center text-xs leading-5 font-sans-medium mt-2 mb-2"
              style={{ color: c.textTertiary, opacity: 0.5 }}
            >
              {t('settings.version')} {appVersion}
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
