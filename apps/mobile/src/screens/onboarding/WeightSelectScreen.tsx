import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useSettingsStore } from '../../stores/settings.store';
import { displayWeight, inputToKg, weightUnit, weightRange } from '../../utils/units';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 11;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'WeightSelect'>;

export function WeightSelectScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.weightKg);
  const setWeightKg = useProfileStore((s) => s.setWeightKg);
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const c = useColors();
  const { t } = useLocale();

  const range = weightRange(unitSystem);
  const initialDisplay = stored ? displayWeight(stored, unitSystem).toString() : '';
  const [value, setValue] = useState(initialDisplay);

  const parsed = parseFloat(value);
  const isValid = !isNaN(parsed) && parsed >= range.min && parsed <= range.max;

  const altValue = isValid
    ? unitSystem === 'metric'
      ? `\u2248 ${Math.round(parsed * 2.205)} lbs`
      : `\u2248 ${inputToKg(parsed, 'imperial').toFixed(1)} kg`
    : null;

  const handleContinue = () => {
    if (isValid) {
      setWeightKg(inputToKg(parsed, unitSystem));
      navigation.navigate('ActivityLevelSelect');
    }
  };

  return (
    <OnboardingLayout
      step={8}
      totalSteps={TOTAL_STEPS}
      title={t('onboarding.weightTitle')}
      subtitle={t('onboarding.weightSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      <View className="flex-1 justify-center items-center">
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-8"
          style={{ backgroundColor: `${c.primary}1a` }}
        >
          <Ionicons name="barbell-outline" size={40} color={c.primary} />
        </View>

        <View className="flex-row items-end mb-4">
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder={range.placeholder}
            placeholderTextColor={c.textTertiary}
            className="text-5xl font-sans-bold text-text text-center min-w-[120px]"
            maxLength={6}
            autoFocus
            accessibilityLabel={t('onboarding.weightTitle')}
          />
          <Text className="text-2xl font-sans-medium text-text-secondary ml-2 mb-2">
            {weightUnit(unitSystem)}
          </Text>
        </View>

        {altValue && (
          <Text className="text-sm font-sans-medium text-text-secondary">{altValue}</Text>
        )}
      </View>
    </OnboardingLayout>
  );
}
