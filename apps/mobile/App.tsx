import './global.css';
import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SyncBanner } from './src/components/ui/SyncBanner';
import { useAuthStore } from './src/stores/auth.store';
import { useSubscriptionStore } from './src/stores/subscription.store';
import { appNavigationTheme } from './src/theme';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  enableLogs: true,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
});

export default Sentry.wrap(function App() {
  const loadToken = useAuthStore((s) => s.loadToken);
  const authUser = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchSubscriptionStatus = useSubscriptionStore((s) => s.fetchStatus);
  const resetSubscription = useSubscriptionStore((s) => s.reset);

  // Initialize RevenueCat SDK on first render
  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
    if (!apiKey) return;

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey });
  }, []);

  // Sync RevenueCat login state with our auth state
  useEffect(() => {
    if (isAuthenticated && authUser) {
      Purchases.logIn(authUser.id).catch(() => {
        // Non-fatal — SDK will use anonymous ID if login fails
      });
      fetchSubscriptionStatus();
    } else {
      Purchases.logOut().catch(() => {});
      resetSubscription();
    }
  }, [isAuthenticated, authUser, fetchSubscriptionStatus, resetSubscription]);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={appNavigationTheme}>
          <RootNavigator />
          <SyncBanner />
          <StatusBar style="dark" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
