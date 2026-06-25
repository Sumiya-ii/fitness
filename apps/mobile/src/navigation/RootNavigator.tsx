import { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { useAuthStore } from '../stores/auth.store';
import { useOnboardingStore } from '../stores/onboarding.store';
import { useProfileStore } from '../stores/profile.store';
import { OnboardingStack } from './OnboardingStack';
import { MainStack } from './MainStack';
import { useColors } from '../theme';
import { useLocale } from '../i18n';
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
  const { t } = useLocale();
  const loadOnboardingStatus = useOnboardingStore((s) => s.loadOnboardingStatus);
  const syncProfileSetupStatus = useOnboardingStore((s) => s.syncProfileSetupStatus);
  const profileSetupComplete = useOnboardingStore((s) => s.profileSetupComplete);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const trySubmitCached = useCallback(async () => {
    setSubmitError(null);
    try {
      await submitCachedOnboardingData();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t('common.errorUnknown'));
    }
  }, [submitCachedOnboardingData, t]);

  // Auto-submit cached onboarding data when user is authenticated but profile not yet saved
  useEffect(() => {
    if (!isAuthenticated || profileSetupComplete !== false) return;
    if (useProfileStore.getState().isComplete()) {
      void trySubmitCached();
    }
  }, [isAuthenticated, profileSetupComplete, trySubmitCached]);

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface-app items-center justify-center">
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  if (submitError) {
    return (
      <View className="flex-1 bg-surface-app items-center justify-center px-6 gap-4">
        <Text className="text-base text-text text-center">{t('common.errorSavingProfile')}</Text>
        <Text className="text-sm text-text-tertiary text-center">{submitError}</Text>
        <Pressable
          onPress={() => void trySubmitCached()}
          className="bg-primary rounded-lg px-6 py-3 active:opacity-80"
          accessibilityRole="button"
        >
          <Text className="text-base font-sans-semibold text-on-primary">{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  }

  return <RootContent />;
}
