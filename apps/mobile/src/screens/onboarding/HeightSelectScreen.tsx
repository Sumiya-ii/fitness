import { useState } from 'react';
import { View, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';
import { ScrollPicker } from '../../components/ui';

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
      route="HeightSelect"
      title={t('onboarding.heightTitle')}
      subtitle={t('onboarding.heightSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
    >
      <View className="flex-1 justify-center items-center">
        {/* Large value preview */}
        <Text className="text-[40px] font-sans-bold text-text leading-[44px] text-center mb-8">
          {selectedHeight} cm
        </Text>

        {/* Picker */}
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
      </View>
    </OnboardingLayout>
  );
}
