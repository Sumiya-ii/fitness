import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
import { useProfileStore } from '../stores/profile.store';
import { OnboardingStack } from './OnboardingStack';
import { MainStack } from './MainStack';
import { useColors } from '../theme';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useSyncQueue } from '../hooks/useSyncQueue';

function RootContent() {
  const c = useColors();
  const profileSetupComplete = useOnboardingStore((s) => s.profileSetupComplete);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Authenticated and profile complete -> main app
  if (isAuthenticated && profileSetupComplete) return <MainStack />;

  // Authenticated but still syncing profile status
  if (isAuthenticated && profileSetupComplete === null) {
    return (
      <View className="flex-1 bg-surface-app items-center justify-center">
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  // Authenticated but profile not complete -> auto-submit cached data
  // (handled via syncProfileSetupStatus + submitCachedOnboardingData in the effect below)
  if (isAuthenticated && !profileSetupComplete) return <OnboardingStack />;

  // Not authenticated -> full onboarding flow (Welcome -> profile screens -> SignUp)
  return <OnboardingStack />;
}

export function RootNavigator() {
  const c = useColors();
  const loadOnboardingStatus = useOnboardingStore((s) => s.loadOnboardingStatus);
  const syncProfileSetupStatus = useOnboardingStore((s) => s.syncProfileSetupStatus);
  const profileSetupComplete = useOnboardingStore((s) => s.profileSetupComplete);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  usePushNotifications();
  useSyncQueue();

  useEffect(() => {
    loadOnboardingStatus();
  }, [loadOnboardingStatus]);

  const submitCachedOnboardingData = useOnboardingStore((s) => s.submitCachedOnboardingData);

  useEffect(() => {
    if (!isAuthenticated) return;
    void syncProfileSetupStatus();
  }, [isAuthenticated, syncProfileSetupStatus]);

  // Auto-submit cached onboarding data when user is authenticated but profile not yet saved
  useEffect(() => {
    if (!isAuthenticated || profileSetupComplete !== false) return;
    if (useProfileStore.getState().isComplete()) {
      void submitCachedOnboardingData();
    }
  }, [isAuthenticated, profileSetupComplete, submitCachedOnboardingData]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface-app items-center justify-center">
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return <RootContent />;
}
