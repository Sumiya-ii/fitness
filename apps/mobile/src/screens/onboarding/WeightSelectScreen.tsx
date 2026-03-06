import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type Props = NativeStackScreenProps<SetupStackParamList, 'WeightSelect'>;

export function WeightSelectScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.weightKg);
  const setWeightKg = useProfileStore((s) => s.setWeightKg);
  const [value, setValue] = useState(stored?.toString() ?? '');

  const weight = parseFloat(value);
  const isValid = !isNaN(weight) && weight >= 20 && weight <= 500;

  const lbs = isValid ? Math.round(weight * 2.205) : null;

  const handleContinue = () => {
    if (isValid) {
      setWeightKg(weight);
      navigation.navigate('ActivityLevelSelect');
    }
  };

  return (
    <OnboardingLayout
      step={7}
      totalSteps={TOTAL_STEPS}
      title="What's your current weight?"
      subtitle="Be honest — this stays private and helps us calculate accurately"
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      <View className="flex-1 justify-center items-center">
        <View className="w-20 h-20 rounded-full bg-emerald-500/15 items-center justify-center mb-8">
          <Ionicons name="barbell-outline" size={40} color="#1f2028" />
        </View>

        <View className="flex-row items-end mb-4">
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="75"
            placeholderTextColor="#94a3b8"
            className="text-5xl font-sans-bold text-text text-center min-w-[120px]"
            maxLength={5}
            autoFocus
          />
          <Text className="text-2xl font-sans-medium text-text-secondary ml-2 mb-2">
            kg
          </Text>
        </View>

        {lbs && (
          <Text className="text-sm font-sans-medium text-text-secondary">
            ≈ {lbs} lbs
          </Text>
        )}
      </View>
    </OnboardingLayout>
  );
}
