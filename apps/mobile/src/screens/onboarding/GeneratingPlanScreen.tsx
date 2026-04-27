import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'GeneratingPlan'>;

type StepStatus = 'pending' | 'loading' | 'done';

// Timing: [startLoading, doneTo] in ms
const STEP_TIMING = [
  { start: 0, done: 600 },
  { start: 600, done: 1400 },
  { start: 1400, done: 2300 },
  { start: 2300, done: 3300 },
];
const NAVIGATE_AT = 3500;

export function GeneratingPlanScreen({ navigation }: Props) {
  const c = useColors();
  const { t } = useLocale();

  const [statuses, setStatuses] = useState<StepStatus[]>([
    'pending',
    'pending',
    'pending',
    'pending',
  ]);

  const stepLabels = [
    t('onboarding.generatingAnalyze'),
    t('onboarding.generatingBmr'),
    t('onboarding.generatingMacros'),
    t('onboarding.generatingPersonalize'),
  ];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEP_TIMING.forEach(({ start, done }, i) => {
      // Transition to loading
      timers.push(
        setTimeout(() => {
          setStatuses((prev) => {
            const next = [...prev] as StepStatus[];
            next[i] = 'loading';
            return next;
          });
        }, start),
      );

      // Transition to done + haptic
      timers.push(
        setTimeout(() => {
          setStatuses((prev) => {
            const next = [...prev] as StepStatus[];
            next[i] = 'done';
            return next;
          });
          Haptics.selectionAsync();
        }, done),
      );
    });

    // Navigate after hold
    timers.push(
      setTimeout(() => {
        navigation.replace('TargetReview');
      }, NAVIGATE_AT),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [navigation]);

  return (
    <SafeAreaView className="flex-1 bg-surface-app items-center justify-center px-8">
      <Text className="text-[28px] font-sans-bold text-text leading-[34px] text-center mb-10">
        {t('onboarding.generatingTitle')}
      </Text>

      <View className="w-full gap-1">
        {stepLabels.map((label, i) => (
          <View key={i} className="flex-row items-center gap-3 py-2">
            <StepIndicator status={statuses[i]} primaryColor={c.primary} accentColor={c.accent} />
            <Text className="text-[16px] text-text">{label}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

function StepIndicator({
  status,
  primaryColor,
  accentColor,
}: {
  status: StepStatus;
  primaryColor: string;
  accentColor: string;
}) {
  if (status === 'done') {
    return <Ionicons name="checkmark-circle" size={24} color={accentColor} />;
  }
  if (status === 'loading') {
    return <ActivityIndicator size="small" color={primaryColor} />;
  }
  return <View className="w-6 h-6 rounded-full border-2 border-surface-border" />;
}
