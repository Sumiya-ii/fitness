import './global.css';
import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SyncBanner } from './src/components/ui/SyncBanner';
import { PaywallModal } from './src/components/PaywallModal';
import { useAuthStore } from './src/stores/auth.store';
import { useSubscriptionStore } from './src/stores/subscription.store';
import { useSettingsStore } from './src/stores/settings.store';
import { setPaywallCallback } from './src/api/client';
import { useColors, buildNavigationTheme } from './src/theme';
import { useThemeStore } from './src/stores/theme.store';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  enableLogs: true,
  integrations: [Sentry.feedbackIntegration()],
});

export default Sentry.wrap(function App() {
  const loadToken = useAuthStore((s) => s.loadToken);
  const authUser = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchSubscriptionStatus = useSubscriptionStore((s) => s.fetchStatus);
  const resetSubscription = useSubscriptionStore((s) => s.reset);
  const showPaywall = useSubscriptionStore((s) => s.showPaywall);
  const handleCustomerInfoUpdate = useSubscriptionStore((s) => s.handleCustomerInfoUpdate);
  const startForegroundListener = useSubscriptionStore((s) => s.startForegroundListener);

  // Register paywall callback so the API client can trigger it on 403
  useEffect(() => {
    setPaywallCallback(showPaywall, () => {
      // Suppress paywall if client already knows user is pro (webhook may lag)
      return useSubscriptionStore.getState().tier === 'pro';
    });
  }, [showPaywall]);

  // Initialize RevenueCat SDK on first render
  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS;
    if (!apiKey) return;

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    Purchases.configure({ apiKey });

    // Listen for real-time entitlement changes (purchase, renewal, expiration)
    const listener = (info: CustomerInfo) => {
      handleCustomerInfoUpdate(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [handleCustomerInfoUpdate]);

  // Load unit system preference when authenticated
  const loadUnitSystem = useSettingsStore((s) => s.loadUnitSystem);
  useEffect(() => {
    if (isAuthenticated) {
      loadUnitSystem();
    }
  }, [isAuthenticated, loadUnitSystem]);

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

  // Refresh subscription status when app returns to foreground
  useEffect(() => {
    if (!isAuthenticated) return;
    return startForegroundListener();
  }, [isAuthenticated, startForegroundListener]);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  const colors = useColors();
  const navTheme = buildNavigationTheme(colors);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
          <SyncBanner />
          <PaywallModal />
          <StatusBar style={colors.statusBarStyle} />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
