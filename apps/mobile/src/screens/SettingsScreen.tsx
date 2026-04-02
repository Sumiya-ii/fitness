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

interface PrivacyRequest {
  id: string;
  requestType: string;
  status: string;
  completedAt: string | null;
  resultUrl: string | null;
  createdAt: string;
  updatedAt: string;
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

type RequestStatus = 'pending' | 'processing' | 'completed' | 'failed';

function privacyStatusColor(status: string, c: ReturnType<typeof useColors>): string {
  switch (status as RequestStatus) {
    case 'pending':
      return c.warning;
    case 'processing':
      return c.primary;
    case 'completed':
      return c.success;
    case 'failed':
      return c.danger;
    default:
      return c.muted;
  }
}

function PrivacyRequestBadge({
  request,
  type,
}: {
  request: PrivacyRequest | null;
  type: 'export' | 'deletion';
}) {
  const c = useColors();
  const { t } = useLocale();

  if (!request) return null;

  const isActiveRequest = request.status === 'pending' || request.status === 'processing';
  const statusColor = privacyStatusColor(request.status, c);

  const statusLabel = (() => {
    if (type === 'export') {
      switch (request.status as RequestStatus) {
        case 'pending':
          return t('settings.exportStatusPending');
        case 'processing':
          return t('settings.exportStatusProcessing');
        case 'completed':
          return t('settings.exportStatusCompleted');
        case 'failed':
          return t('settings.exportStatusFailed');
      }
    } else {
      switch (request.status as RequestStatus) {
        case 'pending':
          return t('settings.deleteStatusPending');
        case 'processing':
          return t('settings.deleteStatusProcessing');
        case 'completed':
          return t('settings.deleteStatusCompleted');
        case 'failed':
          return t('settings.deleteStatusFailed');
      }
    }
    return request.status;
  })();

  return (
    <View className="pb-3">
      <View
        className="flex-row items-center gap-2 px-3 py-2 rounded-xl"
        style={{ backgroundColor: `${statusColor}15` }}
      >
        <View className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} />
        <Text className="flex-1 text-xs font-sans-medium" style={{ color: statusColor }}>
          {statusLabel}
        </Text>
        {!isActiveRequest && type === 'export' && request.resultUrl ? (
          <Pressable
            onPress={() => {
              if (request.resultUrl) Linking.openURL(request.resultUrl);
            }}
            accessibilityRole="link"
            accessibilityLabel={t('settings.exportDownload')}
          >
            <Text className="text-xs font-sans-bold" style={{ color: c.primary }}>
              {t('settings.exportDownload')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
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
  const [latestExportRequest, setLatestExportRequest] = useState<PrivacyRequest | null>(null);
  const [latestDeletionRequest, setLatestDeletionRequest] = useState<PrivacyRequest | null>(null);
  const isPro = useSubscriptionStore((s) => s.tier === 'pro');

  const loadData = useCallback(async () => {
    try {
      const [profileRes, telegramRes, privacyRes] = await Promise.all([
        api.get<{ data: ProfileData }>('/profile'),
        api.get<TelegramStatus>('/telegram/status'),
        api.get<{ data: PrivacyRequest[]; meta: { total: number; page: number; limit: number } }>(
          '/privacy/requests?limit=20',
        ),
      ]);
      setProfile(profileRes.data);
      setTelegramStatus(telegramRes);

      // Find the most recent request of each type
      const requests = privacyRes.data ?? [];
      const exportReq = requests.find((r) => r.requestType === 'export') ?? null;
      const deletionReq = requests.find((r) => r.requestType === 'deletion') ?? null;
      setLatestExportRequest(exportReq);
      setLatestDeletionRequest(deletionReq);
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
    // If there is an active pending/processing request, don't allow a new one
    const hasActiveExport =
      latestExportRequest?.status === 'pending' || latestExportRequest?.status === 'processing';
    if (hasActiveExport) return;

    Alert.alert(t('settings.exportData'), t('settings.exportConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.export'),
        onPress: async () => {
          try {
            const res = await api.post<{ data: PrivacyRequest }>('/privacy/export');
            setLatestExportRequest(res.data);
            Alert.alert(t('common.success'), t('settings.exportSuccess'));
          } catch {
            Alert.alert(t('common.error'), t('settings.exportStatusFailed'));
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    // If there is an active deletion request, don't allow another
    const hasActiveDeletion =
      latestDeletionRequest?.status === 'pending' || latestDeletionRequest?.status === 'processing';
    if (hasActiveDeletion) return;

    Alert.alert(t('settings.deleteAccount'), t('settings.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await api.post<{ data: PrivacyRequest }>('/privacy/delete-account');
            setLatestDeletionRequest(res.data);
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

  const hasActiveExport =
    latestExportRequest?.status === 'pending' || latestExportRequest?.status === 'processing';
  const hasActiveDeletion =
    latestDeletionRequest?.status === 'pending' || latestDeletionRequest?.status === 'processing';

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
              {/* Export row + status badge */}
              <Row
                icon="download-outline"
                label={t('settings.exportMyData')}
                onPress={hasActiveExport ? undefined : handleExportData}
                right={
                  hasActiveExport ? (
                    <View className="h-2 w-2 rounded-full" style={{ backgroundColor: c.warning }} />
                  ) : undefined
                }
              />
              {latestExportRequest ? (
                <PrivacyRequestBadge request={latestExportRequest} type="export" />
              ) : null}
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
                onPress={hasActiveDeletion ? undefined : handleDeleteAccount}
                right={
                  hasActiveDeletion ? (
                    <View className="h-2 w-2 rounded-full" style={{ backgroundColor: c.warning }} />
                  ) : undefined
                }
              />
              {latestDeletionRequest ? (
                <PrivacyRequestBadge request={latestDeletionRequest} type="deletion" />
              ) : null}
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
