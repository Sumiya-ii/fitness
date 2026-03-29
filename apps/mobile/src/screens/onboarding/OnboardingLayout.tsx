import { View, Text, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';

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
  continueLabel,
  continueDisabled = false,
  children,
}: OnboardingLayoutProps) {
  const c = useColors();
  const { t } = useLocale();
  const progress = step / totalSteps;
  const label = continueLabel ?? t('onboarding.next');

  const handleContinue = () => {
    if (continueDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onContinue();
  };

  const handleBack = () => {
    if (!onBack) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onBack();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <SafeAreaView className="flex-1 bg-surface-app">
        {/* Header: back button + progress bar */}
        <View className="flex-row items-center px-5 pt-4 pb-2 gap-3.5">
          {onBack ? (
            <Pressable
              onPress={handleBack}
              className="w-11 h-11 rounded-full border border-surface-border bg-surface-app items-center justify-center active:opacity-60"
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name="chevron-back" size={20} color={c.text} />
            </Pressable>
          ) : (
            <View className="w-11 h-11" />
          )}

          {/* Progress bar */}
          <View className="flex-1 h-1 bg-surface-border rounded-full overflow-hidden">
            <Animated.View
              className="h-full rounded-full bg-primary-500"
              style={{ width: `${progress * 100}%` }}
            />
          </View>
        </View>

        {/* Title + subtitle */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)} className="px-6 pt-5 pb-6">
          <Text
            className="text-[28px] font-sans-bold text-text leading-[34px] mb-2"
            accessibilityRole="header"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-[15px] text-text-tertiary leading-[22px]">{subtitle}</Text>
          ) : null}
        </Animated.View>

        {/* Content */}
        <View className="flex-1 px-6">{children}</View>

        {/* Continue button */}
        <View className="px-6 pb-10 pt-4">
          <Pressable
            onPress={handleContinue}
            disabled={continueDisabled}
            className={`rounded-full items-center justify-center py-[18px] ${
              continueDisabled ? 'bg-surface-muted' : 'bg-primary-500 active:opacity-90'
            }`}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: continueDisabled }}
          >
            <Text
              className={`text-[17px] font-sans-bold tracking-wide ${
                continueDisabled ? 'text-text-tertiary' : 'text-on-primary'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
