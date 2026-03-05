import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import type { ActivityLevel } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type ActivityOption = {
  id: ActivityLevel;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  examples: string;
};

const OPTIONS: ActivityOption[] = [
  {
    id: 'sedentary',
    icon: 'desktop-outline',
    title: 'Sedentary',
    description: 'Little to no exercise',
    examples: 'Desk job, no workouts',
  },
  {
    id: 'lightly_active',
    icon: 'walk-outline',
    title: 'Lightly Active',
    description: 'Light exercise 1-3 days/week',
    examples: 'Walking, light yoga',
  },
  {
    id: 'moderately_active',
    icon: 'bicycle-outline',
    title: 'Moderately Active',
    description: 'Moderate exercise 3-5 days/week',
    examples: 'Gym sessions, running',
  },
  {
    id: 'very_active',
    icon: 'fitness-outline',
    title: 'Very Active',
    description: 'Hard exercise 6-7 days/week',
    examples: 'Intense training, sports',
  },
  {
    id: 'extra_active',
    icon: 'flame-outline',
    title: 'Extra Active',
    description: 'Very hard exercise + physical job',
    examples: 'Athlete, construction worker',
  },
];

type Props = NativeStackScreenProps<SetupStackParamList, 'ActivityLevelSelect'>;

export function ActivityLevelSelectScreen({ navigation }: Props) {
  const activityLevel = useProfileStore((s) => s.activityLevel);
  const setActivityLevel = useProfileStore((s) => s.setActivityLevel);

  return (
    <OnboardingLayout
      step={8}
      totalSteps={TOTAL_STEPS}
      title="How active are you?"
      subtitle="This determines your daily calorie burn"
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('DietPreferenceSelect')}
      continueDisabled={!activityLevel}
    >
      <View className="gap-3">
        {OPTIONS.map((opt) => {
          const selected = activityLevel === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setActivityLevel(opt.id)}
              className={`flex-row items-center p-3.5 rounded-2xl border-2 bg-white dark:bg-slate-800 ${
                selected
                  ? 'border-primary-500 dark:border-primary-400'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <View className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 items-center justify-center mr-3">
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={selected ? '#22c55e' : '#64748b'}
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-sans-semibold text-text dark:text-slate-100">
                  {opt.title}
                </Text>
                <Text className="text-xs text-text-secondary dark:text-slate-400">
                  {opt.description} · {opt.examples}
                </Text>
              </View>
              {selected && (
                <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
              )}
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}
