import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import type { Gender } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type GenderOption = {
  id: Gender;
  label: string;
};

const OPTIONS: GenderOption[] = [
  {
    id: 'male',
    label: 'Male',
  },
  {
    id: 'female',
    label: 'Female',
  },
];

type Props = NativeStackScreenProps<SetupStackParamList, 'GenderSelect'>;

export function GenderSelectScreen({ navigation }: Props) {
  const gender = useProfileStore((s) => s.gender);
  const setGender = useProfileStore((s) => s.setGender);

  return (
    <OnboardingLayout
      step={4}
      totalSteps={TOTAL_STEPS}
      title="Choose your Gender"
      subtitle="This will be used to calibrate your custom plan."
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('BirthDateSelect')}
      continueDisabled={!gender}
    >
      <View className="flex-1 justify-center">
        <View className="gap-4">
          {OPTIONS.map((opt) => {
            const selected = gender === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setGender(opt.id)}
                className={`items-center py-8 rounded-3xl border ${
                  selected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-surface-border bg-surface-card'
                }`}
              >
                <Text className="text-xl font-sans-semibold text-text">
                  {opt.label}
                </Text>
                {selected && (
                  <View className="absolute top-3 right-3">
                    <Ionicons name="checkmark-circle" size={22} color="#1f2028" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </OnboardingLayout>
  );
}
