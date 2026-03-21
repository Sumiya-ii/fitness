import './global.css';
import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/stores/auth.store';
import { appNavigationTheme } from './src/theme';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

export default Sentry.wrap(function App() {
  const loadToken = useAuthStore((s) => s.loadToken);

  useEffect(() => {
    loadToken();
  }, [loadToken]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={appNavigationTheme}>
          <RootNavigator />
          <StatusBar style="dark" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});
