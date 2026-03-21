import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '../../components/ui/BackButton';
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
    <SafeAreaView className="flex-1 bg-surface-app">
      <View className="px-6 pt-4">
        <View className="flex-row items-center mb-6">
          {onBack ? <BackButton onPress={onBack} /> : <View className="w-12" />}

          <View className="flex-1 mx-4">
            <View className="h-1.5 bg-surface-border rounded-full overflow-hidden">
              <View
                className="h-full bg-primary-500 rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </View>
          </View>

          <Text className="text-xs font-sans-medium text-text-secondary">
            {step}/{totalSteps}
          </Text>
        </View>
      </View>

      <View className="px-6 mb-6">
        <Text className="text-2xl font-sans-bold text-text mb-2">{title}</Text>
        {subtitle && <Text className="text-base text-text-secondary leading-6">{subtitle}</Text>}
      </View>

      <View className="flex-1 px-6">{children}</View>

      <View className="px-6 pb-8 pt-4 border-t border-surface-border">
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
