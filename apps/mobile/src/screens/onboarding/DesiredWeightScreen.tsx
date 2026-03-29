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

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DesiredWeight'>;

export function DesiredWeightScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.goalWeightKg);
  const setGoalWeightKg = useProfileStore((s) => s.setGoalWeightKg);
  const goalType = useProfileStore((s) => s.goalType);
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const c = useColors();
  const { t } = useLocale();

  const range = weightRange(unitSystem);
  const initialDisplay = stored ? displayWeight(stored, unitSystem).toString() : '';
  const [value, setValue] = useState(initialDisplay);

  const weight = parseFloat(value);
  const isValid = !isNaN(weight) && weight >= range.min && weight <= range.max;

  const handleContinue = () => {
    if (isValid) {
      setGoalWeightKg(inputToKg(weight, unitSystem));
      navigation.navigate('WeeklyRate');
    }
  };

  const goalLabelKey =
    goalType === 'lose_fat'
      ? 'onboarding.desiredWeightTarget'
      : goalType === 'gain'
        ? 'onboarding.desiredWeightGoal'
        : 'onboarding.desiredWeightIdeal';

  const title = t('onboarding.desiredWeightTitle').replace('{{label}}', t(goalLabelKey));

  return (
    <OnboardingLayout
      step={3}
      totalSteps={TOTAL_STEPS}
      title={title}
      subtitle={t('onboarding.desiredWeightSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      <View className="flex-1 justify-center items-center">
        <View className="items-center mb-8">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-6"
            style={{ backgroundColor: `${c.primary}1a` }}
          >
            <Ionicons name="flag-outline" size={40} color={c.primary} />
          </View>

          <View className="flex-row items-end">
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder={range.placeholder}
              placeholderTextColor={c.textTertiary}
              className="text-5xl font-sans-bold text-text text-center min-w-[120px]"
              maxLength={6}
              autoFocus
              accessibilityLabel={t('onboarding.desiredWeightTitle').replace('{{label}}', '')}
            />
            <Text className="text-2xl font-sans-medium text-text-secondary ml-2 mb-2">
              {weightUnit(unitSystem)}
            </Text>
          </View>
        </View>
      </View>
    </OnboardingLayout>
  );
}
