import { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';
import { ScrollPicker } from '../../components/ui';

const TOTAL_STEPS = 11;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DesiredWeight'>;

const MIN_WEIGHT = 30;
const MAX_WEIGHT = 200;

export function DesiredWeightScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.goalWeightKg);
  const setGoalWeightKg = useProfileStore((s) => s.setGoalWeightKg);
  const goalType = useProfileStore((s) => s.goalType);
  const currentWeight = useProfileStore((s) => s.weightKg);
  const c = useColors();
  const { t } = useLocale();

  // Filter weight items based on goal type and current weight.
  const weightItems = useMemo(() => {
    const cw = currentWeight ?? 70;
    let min = MIN_WEIGHT;
    let max = MAX_WEIGHT;

    if (goalType === 'lose_fat') {
      max = cw - 1; // only weights below current
    } else if (goalType === 'gain') {
      min = cw + 1; // only weights above current
    }
    // maintain: show full range

    min = Math.max(min, MIN_WEIGHT);
    max = Math.min(max, MAX_WEIGHT);

    return Array.from({ length: max - min + 1 }, (_, i) => {
      const w = min + i;
      return { label: w.toString(), value: w };
    });
  }, [goalType, currentWeight]);

  // Smart default: midpoint of the filtered range.
  const defaultWeight = useMemo(() => {
    const cw = currentWeight ?? 70;
    if (goalType === 'lose_fat') return Math.max(MIN_WEIGHT, cw - 5);
    if (goalType === 'gain') return Math.min(MAX_WEIGHT, cw + 5);
    return cw;
  }, [goalType, currentWeight]);

  const [selectedWeight, setSelectedWeight] = useState<number>(() => {
    if (stored && weightItems.some((item) => item.value === Math.round(stored))) {
      return Math.round(stored);
    }
    return defaultWeight;
  });

  const handleContinue = () => {
    setGoalWeightKg(selectedWeight);
    navigation.navigate('WeeklyRate');
  };

  // Goal-type-dependent title label.
  const goalLabelKey =
    goalType === 'lose_fat'
      ? 'onboarding.desiredWeightTarget'
      : goalType === 'gain'
        ? 'onboarding.desiredWeightGoal'
        : 'onboarding.desiredWeightIdeal';

  const title = t('onboarding.desiredWeightTitle').replace('{{label}}', t(goalLabelKey));

  return (
    <OnboardingLayout
      step={7}
      totalSteps={TOTAL_STEPS}
      title={title}
      subtitle={t('onboarding.desiredWeightSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
    >
      <View className="flex-1 justify-center items-center">
        {/* Icon */}
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-10"
          style={{ backgroundColor: `${c.primary}1a` }}
        >
          <Ionicons name="flag-outline" size={40} color={c.primary} />
        </View>

        {/* Picker + unit label */}
        <View className="flex-row items-center gap-4">
          <View
            className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card"
            style={{ width: 120 }}
          >
            <ScrollPicker
              items={weightItems}
              selectedValue={selectedWeight}
              onValueChange={(v) => setSelectedWeight(v as number)}
              itemHeight={48}
              visibleItems={5}
              width={120}
              accessibilityLabel={title}
            />
          </View>

          <Text className="text-2xl font-sans-semibold text-text-secondary">kg</Text>
        </View>
      </View>
    </OnboardingLayout>
  );
}
