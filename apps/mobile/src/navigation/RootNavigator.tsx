import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
import { AuthStack } from './AuthStack';
import { SetupStack } from './SetupStack';
import { MainTabs } from './MainTabs';

function RootContent() {
  const onboardingComplete = useOnboardingStore((s) => s.onboardingComplete);
  const profileSetupComplete = useOnboardingStore((s) => s.profileSetupComplete);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) return <AuthStack />;
  if (!profileSetupComplete) return <SetupStack />;
  return <MainTabs />;
}

export function RootNavigator() {
  const loadOnboardingStatus = useOnboardingStore((s) => s.loadOnboardingStatus);
  const onboardingComplete = useOnboardingStore((s) => s.onboardingComplete);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    loadOnboardingStatus();
  }, [loadOnboardingStatus]);

  if (onboardingComplete === null || isLoading) {
    return (
      <View className="flex-1 bg-surface dark:bg-slate-900 items-center justify-center">
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return <RootContent />;
}
