import { useState } from 'react';
import { View, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';
import { ScrollPicker } from '../../components/ui';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'WeightSelect'>;

const MIN_WEIGHT = 30;
const MAX_WEIGHT = 200;
const DEFAULT_WEIGHT = 70;

// Whole-kg items only.
const WEIGHT_ITEMS = Array.from({ length: MAX_WEIGHT - MIN_WEIGHT + 1 }, (_, i) => {
  const w = MIN_WEIGHT + i;
  return { label: w.toString(), value: w };
});

export function WeightSelectScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.weightKg);
  const setWeightKg = useProfileStore((s) => s.setWeightKg);
  const { t } = useLocale();

  const [selectedWeight, setSelectedWeight] = useState<number>(() => {
    if (stored && stored >= MIN_WEIGHT && stored <= MAX_WEIGHT) {
      return Math.round(stored);
    }
    return DEFAULT_WEIGHT;
  });

  const handleContinue = () => {
    setWeightKg(selectedWeight);
    navigation.navigate('DesiredWeight');
  };

  return (
    <OnboardingLayout
      route="WeightSelect"
      title={t('onboarding.weightTitle')}
      subtitle={t('onboarding.weightSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
    >
      <View className="flex-1 justify-center items-center">
        {/* Large value preview */}
        <Text className="text-[40px] font-sans-bold text-text leading-[44px] text-center mb-8">
          {selectedWeight} kg
        </Text>

        {/* Picker */}
        <View
          className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card"
          style={{ width: 120 }}
        >
          <ScrollPicker
            items={WEIGHT_ITEMS}
            selectedValue={selectedWeight}
            onValueChange={(v) => setSelectedWeight(v as number)}
            itemHeight={48}
            visibleItems={5}
            width={120}
            accessibilityLabel={t('onboarding.weightTitle')}
          />
        </View>
      </View>
    </OnboardingLayout>
  );
}
