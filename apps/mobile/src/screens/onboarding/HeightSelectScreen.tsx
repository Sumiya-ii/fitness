import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type Props = NativeStackScreenProps<SetupStackParamList, 'HeightSelect'>;

export function HeightSelectScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.heightCm);
  const setHeightCm = useProfileStore((s) => s.setHeightCm);
  const [value, setValue] = useState(stored?.toString() ?? '');

  const height = parseInt(value, 10);
  const isValid = !isNaN(height) && height >= 50 && height <= 300;

  const feetInches = isValid
    ? {
        feet: Math.floor(height / 30.48),
        inches: Math.round((height % 30.48) / 2.54),
      }
    : null;

  const handleContinue = () => {
    if (isValid) {
      setHeightCm(height);
      navigation.navigate('WeightSelect');
    }
  };

  return (
    <OnboardingLayout
      step={6}
      totalSteps={TOTAL_STEPS}
      title="How tall are you?"
      subtitle="Height is used in the Mifflin-St Jeor formula"
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      <View className="flex-1 justify-center items-center">
        <View className="w-20 h-20 rounded-full bg-amber-500/15 items-center justify-center mb-8">
          <Ionicons name="resize-outline" size={40} color="#8f93a4" />
        </View>

        <View className="flex-row items-end mb-4">
          <TextInput
            value={value}
            onChangeText={(t) => setValue(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="170"
            placeholderTextColor="#94a3b8"
            className="text-5xl font-sans-bold text-text text-center min-w-[120px]"
            maxLength={3}
            autoFocus
          />
          <Text className="text-2xl font-sans-medium text-text-secondary ml-2 mb-2">
            cm
          </Text>
        </View>

        {feetInches && (
          <Text className="text-sm font-sans-medium text-text-secondary">
            ≈ {feetInches.feet}'{feetInches.inches}"
          </Text>
        )}
      </View>
    </OnboardingLayout>
  );
}
