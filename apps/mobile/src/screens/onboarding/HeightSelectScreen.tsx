import { useState } from 'react';
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

type Props = NativeStackScreenProps<OnboardingStackParamList, 'HeightSelect'>;

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 230;
const DEFAULT_HEIGHT = 170;

// Static list built once at module level — no hook required.
const HEIGHT_ITEMS = Array.from({ length: MAX_HEIGHT - MIN_HEIGHT + 1 }, (_, i) => {
  const h = MIN_HEIGHT + i;
  return { label: h.toString(), value: h };
});

export function HeightSelectScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.heightCm);
  const setHeightCm = useProfileStore((s) => s.setHeightCm);
  const c = useColors();
  const { t } = useLocale();

  const [selectedHeight, setSelectedHeight] = useState<number>(
    stored && stored >= MIN_HEIGHT && stored <= MAX_HEIGHT ? stored : DEFAULT_HEIGHT,
  );

  const handleContinue = () => {
    setHeightCm(selectedHeight);
    navigation.navigate('WeightSelect');
  };

  return (
    <OnboardingLayout
      step={7}
      totalSteps={TOTAL_STEPS}
      title={t('onboarding.heightTitle')}
      subtitle={t('onboarding.heightSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
    >
      <View className="flex-1 justify-center items-center">
        {/* Icon */}
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-10"
          style={{ backgroundColor: `${c.primary}1a` }}
        >
          <Ionicons name="resize-outline" size={40} color={c.primary} />
        </View>

        {/* Picker + unit label */}
        <View className="flex-row items-center gap-4">
          <View
            className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card"
            style={{ width: 120 }}
          >
            <ScrollPicker
              items={HEIGHT_ITEMS}
              selectedValue={selectedHeight}
              onValueChange={(v) => setSelectedHeight(v as number)}
              itemHeight={48}
              visibleItems={5}
              width={120}
              accessibilityLabel={t('onboarding.heightTitle')}
            />
          </View>

          <Text className="text-2xl font-sans-semibold text-text-secondary">cm</Text>
        </View>
      </View>
    </OnboardingLayout>
  );
}
