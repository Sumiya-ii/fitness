import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
import { AuthStack } from './AuthStack';
import { SetupStack } from './SetupStack';
import { MainStack } from './MainStack';
import { useColors } from '../theme';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useSyncQueue } from '../hooks/useSyncQueue';

function RootContent() {
  const c = useColors();
  const profileSetupComplete = useOnboardingStore((s) => s.profileSetupComplete);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) return <AuthStack />;
  if (profileSetupComplete === null) {
    return (
      <View className="flex-1 bg-surface-app items-center justify-center">
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }
  if (!profileSetupComplete) return <SetupStack />;
  return <MainStack />;
}

export function RootNavigator() {
  const c = useColors();
  const loadOnboardingStatus = useOnboardingStore((s) => s.loadOnboardingStatus);
  const syncProfileSetupStatus = useOnboardingStore((s) => s.syncProfileSetupStatus);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  usePushNotifications();
  useSyncQueue();

  useEffect(() => {
    loadOnboardingStatus();
  }, [loadOnboardingStatus]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void syncProfileSetupStatus();
  }, [isAuthenticated, syncProfileSetupStatus]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface-app items-center justify-center">
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return <RootContent />;
}
