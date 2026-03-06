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
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bgClass: string;
};

const OPTIONS: GenderOption[] = [
  {
    id: 'male',
    icon: 'male',
    label: 'Male',
    color: '#3b82f6',
    bgClass: 'bg-blue-500/15',
  },
  {
    id: 'female',
    icon: 'female',
    label: 'Female',
    color: '#ec4899',
    bgClass: 'bg-pink-500/15',
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
      title="What's your biological sex?"
      subtitle="This affects your metabolic rate calculation"
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('BirthDateSelect')}
      continueDisabled={!gender}
    >
      <View className="flex-1 justify-center">
        <View className="flex-row gap-4">
          {OPTIONS.map((opt) => {
            const selected = gender === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setGender(opt.id)}
                className={`flex-1 items-center py-8 rounded-2xl border-2 bg-slate-900/80 ${
                  selected
                    ? 'border-primary-500'
                    : 'border-slate-800'
                }`}
              >
                <View
                  className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${opt.bgClass}`}
                >
                  <Ionicons name={opt.icon} size={40} color={opt.color} />
                </View>
                <Text className="text-lg font-sans-semibold text-white">
                  {opt.label}
                </Text>
                {selected && (
                  <View className="absolute top-3 right-3">
                    <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
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
