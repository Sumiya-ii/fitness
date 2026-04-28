import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../api/client';
import { getFirebaseAuth } from '../lib/firebase';

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
 * Force-refresh the Firebase ID token and persist it so the push token
 * registration request uses a fresh token, not a cached (potentially stale) one.
 */
async function ensureFreshToken(): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return;
  try {
    const freshToken = await user.getIdToken(true);
    await api.setToken(freshToken);
  } catch {
    // Non-fatal: if refresh fails, fall back to stored token
  }
}

/**
 * Silently refresh the push token if the user has already granted permission.
 * Does NOT request permission — that is the primer screen's job.
 */
async function refreshTokenIfGranted(): Promise<void> {
  if (Constants.appOwnership === 'expo') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  try {
    await ensureFreshToken();
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
    await ensureFreshToken();
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
 * Hook used in RootNavigator. Silently refreshes the push token on mount,
 * refreshes on foreground, and navigates to the correct screen when the user
 * taps a push notification.
 */
export function usePushNotifications() {
  const responseListener = useRef<Notifications.Subscription | null>(null);
  // Tracks whether the component is still mounted so the async notification
  // response handler does not navigate or update state after unmount.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    refreshTokenIfGranted();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshTokenIfGranted();
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      void data;
    });

    return () => {
      mounted.current = false;
      appStateSubscription.remove();
      // responseListener.current may be null if addNotificationResponseReceivedListener
      // threw before assigning; optional chaining handles that safely.
      responseListener.current?.remove();
    };
  }, []);
}
