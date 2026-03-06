import './global.css';
import { useEffect } from 'react';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthStore } from './src/stores/auth.store';

export default function App() {
  const loadToken = useAuthStore((s) => s.loadToken);
  const appTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: '#22c55e',
      background: '#020617',
      card: '#0f172a',
      border: '#1e293b',
      text: '#f8fafc',
      notification: '#22c55e',
    },
  };

  useEffect(() => {
    loadToken();
  }, [loadToken]);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer theme={appTheme}>
          <RootNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
