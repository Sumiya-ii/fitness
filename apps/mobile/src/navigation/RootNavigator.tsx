import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
import { AuthStack } from './AuthStack';
import { SetupStack } from './SetupStack';
import { MainStack } from './MainStack';

function RootContent() {
  const profileSetupComplete = useOnboardingStore((s) => s.profileSetupComplete);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) return <AuthStack />;
  if (!profileSetupComplete) return <SetupStack />;
  return <MainStack />;
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
      <View className="flex-1 bg-slate-950 items-center justify-center">
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return <RootContent />;
}
