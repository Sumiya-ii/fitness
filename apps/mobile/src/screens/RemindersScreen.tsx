import { useCallback, useState } from 'react';
import { View, Text, Switch, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton, Button } from '../components/ui';
import { api } from '../api';
import { requestAndRegisterPushToken } from '../hooks/usePushNotifications';
import { useLocale } from '../i18n';
import { useColors } from '../theme';

interface NotificationPrefs {
  morningReminder: boolean;
  eveningReminder: boolean;
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
      // Check OS permission independently
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.put('/notifications/preferences', next);
    } catch {
      setNotifPrefs(prev);
    }
  };

  const renderPermissionState = () => {
    if (osPermission === 'denied') {
      return (
        <Animated.View entering={FadeInDown.duration(400).springify()}>
          <View className="bg-surface-card rounded-2xl border border-surface-border py-8 px-6 items-center">
            <View
              className="h-16 w-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: `${c.danger}15` }}
            >
              <Ionicons name="notifications-off-outline" size={32} color={c.danger} />
            </View>
            <Text className="text-lg leading-7 font-sans-semibold text-text text-center mb-2">
              {t('settings.notificationsBlocked')}
            </Text>
            <Text
              className="text-sm leading-5 font-sans-medium text-center mb-6 px-4"
              style={{ color: c.textSecondary }}
            >
              {t('settings.notificationsBlockedDesc')}
            </Text>
            <Button
              variant="secondary"
              size="md"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Linking.openSettings();
              }}
              accessibilityLabel={t('settings.openSettings')}
            >
              {t('settings.openSettings')}
            </Button>
          </View>
        </Animated.View>
      );
    }

    if (osPermission === 'undetermined') {
      return (
        <Animated.View entering={FadeInDown.duration(400).springify()}>
          <View className="bg-surface-card rounded-2xl border border-surface-border py-8 px-6 items-center">
            <View
              className="h-16 w-16 rounded-2xl items-center justify-center mb-4"
              style={{ backgroundColor: `${c.warning}15` }}
            >
              <Ionicons name="notifications-outline" size={32} color={c.warning} />
            </View>
            <Text className="text-lg leading-7 font-sans-semibold text-text text-center mb-2">
              {t('settings.enableNotifications')}
            </Text>
            <Text
              className="text-sm leading-5 font-sans-medium text-center mb-6 px-4"
              style={{ color: c.textSecondary }}
            >
              {t('settings.enableNotificationsDesc')}
            </Text>
            <Button
              variant="primary"
              size="md"
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                await requestAndRegisterPushToken();
                const { status } = await Notifications.getPermissionsAsync();
                setOsPermission(
                  status === 'granted'
                    ? 'granted'
                    : status === 'denied'
                      ? 'denied'
                      : 'undetermined',
                );
              }}
              accessibilityLabel={t('settings.turnOnNotifications')}
            >
              {t('settings.turnOnNotifications')}
            </Button>
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View entering={FadeInDown.duration(400).springify()}>
        <View className="bg-surface-card rounded-2xl px-4 border border-surface-border">
          {/* Morning reminder */}
          <View className="flex-row items-center py-3.5 min-h-[56px]">
            <View
              className="h-9 w-9 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: c.cardAlt }}
            >
              <Ionicons name="sunny-outline" size={18} color={c.textTertiary} />
            </View>
            <View className="flex-1 mr-3">
              <Text className="text-base leading-6 font-sans-medium text-text">
                {t('settings.morningReminder')}
              </Text>
              <Text
                className="text-xs leading-5 font-sans-medium mt-0.5"
                style={{ color: c.textTertiary }}
              >
                {t('settings.morningReminderDesc')}
              </Text>
            </View>
            <Switch
              value={notifPrefs.morningReminder}
              onValueChange={(v) => updateNotifPref('morningReminder', v)}
              trackColor={{ false: c.border, true: c.success }}
              thumbColor="#ffffff"
              accessibilityRole="switch"
              accessibilityLabel={t('settings.morningReminder')}
              accessibilityState={{ checked: notifPrefs.morningReminder }}
            />
          </View>

          <View className="h-px bg-surface-secondary" />

          {/* Evening reminder */}
          <View className="flex-row items-center py-3.5 min-h-[56px]">
            <View
              className="h-9 w-9 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: c.cardAlt }}
            >
              <Ionicons name="moon-outline" size={18} color={c.textTertiary} />
            </View>
            <View className="flex-1 mr-3">
              <Text className="text-base leading-6 font-sans-medium text-text">
                {t('settings.eveningReminder')}
              </Text>
              <Text
                className="text-xs leading-5 font-sans-medium mt-0.5"
                style={{ color: c.textTertiary }}
              >
                {t('settings.eveningReminderDesc')}
              </Text>
            </View>
            <Switch
              value={notifPrefs.eveningReminder}
              onValueChange={(v) => updateNotifPref('eveningReminder', v)}
              trackColor={{ false: c.border, true: c.success }}
              thumbColor="#ffffff"
              accessibilityRole="switch"
              accessibilityLabel={t('settings.eveningReminder')}
              accessibilityState={{ checked: notifPrefs.eveningReminder }}
            />
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
            {t('settings.reminders')}
          </Text>
        </View>

        <View className="px-5 pt-6">{renderPermissionState()}</View>
      </SafeAreaView>
    </View>
  );
}
