import { useCallback, useState } from 'react';
import { View, Text, Pressable, Switch, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { BackButton } from '../components/ui';
import { api } from '../api';
import { requestAndRegisterPushToken } from '../hooks/usePushNotifications';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

interface NotificationPrefs {
  morningReminder: boolean;
  eveningReminder: boolean;
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

export function RemindersScreen() {
  const c = useColors();
  const { t } = useLocale();
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    morningReminder: true,
    eveningReminder: true,
  });
  const [osPermission, setOsPermission] = useState<'granted' | 'denied' | 'undetermined'>(
    'undetermined',
  );

  useFocusEffect(
    useCallback(() => {
      // Check OS permission independently — an API failure must not hide the real status
      Notifications.getPermissionsAsync()
        .then((permResult) => {
          setOsPermission(
            permResult.status === 'granted'
              ? 'granted'
              : permResult.status === 'denied'
                ? 'denied'
                : 'undetermined',
          );
        })
        .catch(() => {});

      api
        .get<{ data: NotificationPrefs }>('/notifications/preferences')
        .then((notifRes) => setNotifPrefs(notifRes.data))
        .catch(() => {});
    }, []),
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

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <BackButton />
          <Text className="flex-1 text-lg font-sans-bold text-text text-center mr-10">
            {t('settings.reminders')}
          </Text>
        </View>

        <View className="px-4 pt-6">
          {osPermission === 'denied' ? (
            <Section>
              <View className="py-6 items-center">
                <Ionicons name="notifications-off-outline" size={40} color={c.danger} />
                <Text className="text-[15px] font-sans-semibold text-text mt-3 text-center">
                  {t('settings.notificationsBlocked')}
                </Text>
                <Text className="text-[13px] text-text-tertiary font-sans-medium mt-2 text-center px-4">
                  {t('settings.notificationsBlockedDesc')}
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    Linking.openSettings();
                  }}
                  className="mt-4 bg-surface-secondary rounded-xl px-6 py-3"
                >
                  <Text className="text-[14px] font-sans-semibold text-primary-500">
                    {t('settings.openSettings')}
                  </Text>
                </Pressable>
              </View>
            </Section>
          ) : osPermission === 'undetermined' ? (
            <Section>
              <View className="py-6 items-center">
                <Ionicons name="notifications-outline" size={40} color={c.warning} />
                <Text className="text-[15px] font-sans-semibold text-text mt-3 text-center">
                  {t('settings.enableNotifications')}
                </Text>
                <Text className="text-[13px] text-text-tertiary font-sans-medium mt-2 text-center px-4">
                  {t('settings.enableNotificationsDesc')}
                </Text>
                <Pressable
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    await requestAndRegisterPushToken();
                    // Re-check actual OS permission instead of relying on token registration success
                    const { status } = await Notifications.getPermissionsAsync();
                    setOsPermission(
                      status === 'granted'
                        ? 'granted'
                        : status === 'denied'
                          ? 'denied'
                          : 'undetermined',
                    );
                  }}
                  className="mt-4 bg-primary-500 rounded-xl px-6 py-3"
                >
                  <Text className="text-[14px] font-sans-bold text-white">
                    {t('settings.turnOnNotifications')}
                  </Text>
                </Pressable>
              </View>
            </Section>
          ) : (
            <Section>
              <View className="flex-row items-center py-[14px]">
                <Ionicons
                  name="sunny-outline"
                  size={20}
                  color={c.textTertiary}
                  style={{ width: 28 }}
                />
                <View className="flex-1">
                  <Text className="text-[15px] font-sans-medium text-text">
                    {t('settings.morningReminder')}
                  </Text>
                  <Text className="text-[12px] text-text-tertiary font-sans-medium mt-0.5">
                    {t('settings.morningReminderDesc')}
                  </Text>
                </View>
                <Switch
                  value={notifPrefs.morningReminder}
                  onValueChange={(v) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateNotifPref('morningReminder', v);
                  }}
                  trackColor={{ false: c.border, true: c.primary }}
                  thumbColor={c.primary}
                />
              </View>
              <Divider />
              <View className="flex-row items-center py-[14px]">
                <Ionicons
                  name="moon-outline"
                  size={20}
                  color={c.textTertiary}
                  style={{ width: 28 }}
                />
                <View className="flex-1">
                  <Text className="text-[15px] font-sans-medium text-text">
                    {t('settings.eveningReminder')}
                  </Text>
                  <Text className="text-[12px] text-text-tertiary font-sans-medium mt-0.5">
                    {t('settings.eveningReminderDesc')}
                  </Text>
                </View>
                <Switch
                  value={notifPrefs.eveningReminder}
                  onValueChange={(v) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateNotifPref('eveningReminder', v);
                  }}
                  trackColor={{ false: c.border, true: c.primary }}
                  thumbColor={c.primary}
                />
              </View>
            </Section>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
