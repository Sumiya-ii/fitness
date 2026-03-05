import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';

interface OnboardingLayoutProps {
  step: number;
  totalSteps: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  children: React.ReactNode;
}

export function OnboardingLayout({
  step,
  totalSteps,
  title,
  subtitle,
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
  continueLoading = false,
  children,
}: OnboardingLayoutProps) {
  const progress = step / totalSteps;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900">
      <View className="px-6 pt-4">
        <View className="flex-row items-center mb-6">
          {onBack ? (
            <Pressable
              onPress={onBack}
              className="w-10 h-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 active:opacity-70"
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={20} color="#64748b" />
            </Pressable>
          ) : (
            <View className="w-10" />
          )}

          <View className="flex-1 mx-4">
            <View className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary-500 rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </View>
          </View>

          <Text className="text-xs font-sans-medium text-text-secondary dark:text-slate-400">
            {step}/{totalSteps}
          </Text>
        </View>
      </View>

      <View className="px-6 mb-6">
        <Text className="text-2xl font-sans-bold text-text dark:text-slate-100 mb-2">
          {title}
        </Text>
        {subtitle && (
          <Text className="text-base text-text-secondary dark:text-slate-400 leading-6">
            {subtitle}
          </Text>
        )}
      </View>

      <View className="flex-1 px-6">{children}</View>

      <View className="px-6 pb-8 pt-4">
        <Button
          onPress={onContinue}
          size="lg"
          disabled={continueDisabled}
          loading={continueLoading}
          className="w-full"
        >
          {continueLabel}
        </Button>
      </View>
    </SafeAreaView>
  );
}
