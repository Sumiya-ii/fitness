import { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';
import { ScrollPicker } from '../../components/ui';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DesiredWeight'>;

const MIN_WEIGHT = 30;
const MAX_WEIGHT = 200;

export function DesiredWeightScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.goalWeightKg);
  const setGoalWeightKg = useProfileStore((s) => s.setGoalWeightKg);
  const goalType = useProfileStore((s) => s.goalType);
  const currentWeight = useProfileStore((s) => s.weightKg);
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

  // Delta from current weight.
  const delta = currentWeight != null ? selectedWeight - Math.round(currentWeight) : null;

  return (
    <OnboardingLayout
      route="DesiredWeight"
      title={title}
      subtitle={t('onboarding.desiredWeightSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
    >
      <View className="flex-1 justify-center items-center">
        {/* Large value preview */}
        <Text className="text-[40px] font-sans-bold text-text leading-[44px] text-center mb-2">
          {selectedWeight} kg
        </Text>

        {/* Delta line — only when value differs from current */}
        {delta !== null && delta !== 0 ? (
          <Text className="text-[14px] text-text-tertiary text-center mb-8">
            {delta > 0 ? '+' : ''}
            {delta} kg from current
          </Text>
        ) : (
          <View className="mb-8" />
        )}

        {/* Picker */}
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
      </View>
    </OnboardingLayout>
  );
}
