import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Silently refresh the push token if the user has already granted permission.
 * Does NOT request permission — that is the primer screen's job.
 */
async function refreshTokenIfGranted(): Promise<void> {
  if (Constants.appOwnership === 'expo') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await api.post('/notifications/device-token', {
      token: tokenData.data,
      platform: Platform.OS,
    });
  } catch {
    // Non-fatal: best-effort token refresh
  }
}

/**
 * Request permission (shows the OS dialog) then registers the token.
 * Called explicitly from the onboarding notification primer screen.
 */
export async function requestAndRegisterPushToken(): Promise<boolean> {
  if (Constants.appOwnership === 'expo') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return false;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await api.post('/notifications/device-token', {
      token: tokenData.data,
      platform: Platform.OS,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook used in RootNavigator. Silently refreshes the push token on mount
 * and whenever the app returns to the foreground — no permission prompt.
 */
export function usePushNotifications() {
  useEffect(() => {
    // Refresh on cold start (only if permission already granted)
    refreshTokenIfGranted();

    // Refresh whenever the app comes back to foreground
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshTokenIfGranted();
      }
    });

    return () => subscription.remove();
  }, []);
}
