import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type Props = NativeStackScreenProps<SetupStackParamList, 'DesiredWeight'>;

export function DesiredWeightScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.goalWeightKg);
  const setGoalWeightKg = useProfileStore((s) => s.setGoalWeightKg);
  const goalType = useProfileStore((s) => s.goalType);
  const [value, setValue] = useState(stored?.toString() ?? '');

  const weight = parseFloat(value);
  const isValid = !isNaN(weight) && weight >= 20 && weight <= 500;

  const handleContinue = () => {
    if (isValid) {
      setGoalWeightKg(weight);
      navigation.navigate('WeeklyRate');
    }
  };

  const goalLabel =
    goalType === 'lose_fat'
      ? 'target'
      : goalType === 'gain'
        ? 'goal'
        : 'ideal';

  return (
    <OnboardingLayout
      step={2}
      totalSteps={TOTAL_STEPS}
      title={`What's your ${goalLabel} weight?`}
      subtitle="This helps us calculate how much you need to adjust"
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      <View className="flex-1 justify-center items-center">
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-primary-500/15 items-center justify-center mb-6">
            <Ionicons name="flag-outline" size={40} color="#1f2028" />
          </View>

          <View className="flex-row items-end">
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              placeholder="70"
              placeholderTextColor="#9a9caa"
              className="text-5xl font-sans-bold text-text text-center min-w-[120px]"
              maxLength={5}
              autoFocus
            />
            <Text className="text-2xl font-sans-medium text-text-secondary ml-2 mb-2">
              kg
            </Text>
          </View>
        </View>
      </View>
    </OnboardingLayout>
  );
}
