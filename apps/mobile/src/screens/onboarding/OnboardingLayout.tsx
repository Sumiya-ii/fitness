import { useEffect } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { PrimaryPillButton } from '../../components/ui/PrimaryPillButton';
import type { OnboardingStackParamList } from '../../navigation/types';
import { getProgress } from './steps';

type RouteName = keyof OnboardingStackParamList;

interface OnboardingLayoutProps {
  /** When provided, progress is looked up from `steps.ts`. */
  route?: RouteName;
  /** Override progress (0–1). Takes precedence over `route`. */
  progress?: number;
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
  route,
  progress: progressOverride,
  title,
  subtitle,
  onBack,
  onContinue,
  continueLabel,
  continueDisabled = false,
  continueLoading = false,
  children,
}: OnboardingLayoutProps) {
  const c = useColors();
  const { t } = useLocale();
  const label = continueLabel ?? t('onboarding.next');

  const computedProgress =
    progressOverride !== undefined
      ? progressOverride
      : route
        ? (getProgress(route)?.percent ?? null)
        : null;
  const showBar = computedProgress !== null;

  const progressValue = useSharedValue(computedProgress ?? 0);

  useEffect(() => {
    progressValue.value = withTiming(computedProgress ?? 0, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });
  }, [computedProgress, progressValue]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

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

          {showBar ? (
            <View className="flex-1 h-1 bg-surface-border rounded-full overflow-hidden">
              <Animated.View
                className="h-full rounded-full bg-primary-500"
                style={progressBarStyle}
              />
            </View>
          ) : (
            <View className="flex-1" />
          )}
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
          <PrimaryPillButton
            label={label}
            onPress={onContinue}
            disabled={continueDisabled}
            loading={continueLoading}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
