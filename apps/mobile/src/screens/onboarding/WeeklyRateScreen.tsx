import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type RateOption = {
  value: number;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const LOSE_RATES: RateOption[] = [
  { value: 0.25, label: '0.25 kg/week', description: 'Slow & steady', icon: 'walk-outline' },
  { value: 0.5, label: '0.5 kg/week', description: 'Recommended', icon: 'bicycle-outline' },
  { value: 0.75, label: '0.75 kg/week', description: 'Moderate', icon: 'fitness-outline' },
  { value: 1.0, label: '1.0 kg/week', description: 'Aggressive', icon: 'flash-outline' },
];

const GAIN_RATES: RateOption[] = [
  { value: 0.25, label: '0.25 kg/week', description: 'Lean bulk', icon: 'walk-outline' },
  { value: 0.5, label: '0.5 kg/week', description: 'Recommended', icon: 'bicycle-outline' },
  { value: 0.75, label: '0.75 kg/week', description: 'Fast bulk', icon: 'fitness-outline' },
];

type Props = NativeStackScreenProps<SetupStackParamList, 'WeeklyRate'>;

export function WeeklyRateScreen({ navigation }: Props) {
  const goalType = useProfileStore((s) => s.goalType);
  const stored = useProfileStore((s) => s.weeklyRateKg);
  const setWeeklyRateKg = useProfileStore((s) => s.setWeeklyRateKg);
  const [selected, setSelected] = useState<number | null>(stored);

  const rates = goalType === 'gain' ? GAIN_RATES : LOSE_RATES;
  const isMaintain = goalType === 'maintain';

  const handleContinue = () => {
    if (isMaintain) {
      setWeeklyRateKg(0);
      navigation.navigate('GenderSelect');
    } else if (selected !== null) {
      setWeeklyRateKg(selected);
      navigation.navigate('GenderSelect');
    }
  };

  if (isMaintain) {
    return (
      <OnboardingLayout
        step={3}
        totalSteps={TOTAL_STEPS}
        title="Great choice!"
        subtitle="We'll maintain your current weight by matching your calorie intake to your daily burn"
        onBack={() => navigation.goBack()}
        onContinue={handleContinue}
      >
        <View className="flex-1 justify-center items-center">
          <View className="w-24 h-24 rounded-full bg-sky-100 dark:bg-sky-900/30 items-center justify-center mb-4">
            <Ionicons name="scale-outline" size={48} color="#0ea5e9" />
          </View>
          <Text className="text-lg font-sans-medium text-text dark:text-slate-200 text-center">
            No weekly change target needed
          </Text>
        </View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      step={3}
      totalSteps={TOTAL_STEPS}
      title="How fast do you want results?"
      subtitle={
        goalType === 'lose_fat'
          ? 'Slower rates preserve more muscle mass'
          : 'Slower rates minimize fat gain'
      }
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={selected === null}
    >
      <View className="gap-3">
        {rates.map((rate) => {
          const isSelected = selected === rate.value;
          const isRecommended = rate.value === 0.5;

          return (
            <Pressable
              key={rate.value}
              onPress={() => setSelected(rate.value)}
              className={`flex-row items-center p-4 rounded-2xl border-2 bg-white dark:bg-slate-800 ${
                isSelected
                  ? 'border-primary-500 dark:border-primary-400'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <View className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 items-center justify-center mr-3">
                <Ionicons
                  name={rate.icon}
                  size={20}
                  color={isSelected ? '#22c55e' : '#64748b'}
                />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="text-base font-sans-semibold text-text dark:text-slate-100">
                    {rate.label}
                  </Text>
                  {isRecommended && (
                    <View className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                      <Text className="text-xs font-sans-medium text-primary-600 dark:text-primary-400">
                        Recommended
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm text-text-secondary dark:text-slate-400">
                  {rate.description}
                </Text>
              </View>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
              )}
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}
