import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import type { GoalType } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type GoalOption = {
  id: GoalType;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  gradient: [string, string];
};

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'lose_fat',
    icon: 'trending-down-outline',
    title: 'Lose Fat',
    description: 'Burn fat and get leaner with a calorie deficit',
    gradient: ['#22c55e', '#16a34a'],
  },
  {
    id: 'maintain',
    icon: 'scale-outline',
    title: 'Maintain Weight',
    description: 'Keep your current weight with balanced nutrition',
    gradient: ['#0ea5e9', '#0284c7'],
  },
  {
    id: 'gain',
    icon: 'trending-up-outline',
    title: 'Build Muscle',
    description: 'Gain lean mass with a controlled calorie surplus',
    gradient: ['#f59e0b', '#d97706'],
  },
];

type Props = NativeStackScreenProps<SetupStackParamList, 'GoalSetup'>;

export function GoalSetupScreen({ navigation }: Props) {
  const goalType = useProfileStore((s) => s.goalType);
  const setGoalType = useProfileStore((s) => s.setGoalType);

  return (
    <OnboardingLayout
      step={1}
      totalSteps={TOTAL_STEPS}
      title="What's your goal?"
      subtitle="We'll create a personalized plan just for you"
      onContinue={() => navigation.navigate('DesiredWeight')}
      continueDisabled={!goalType}
    >
      <View className="gap-4">
        {GOAL_OPTIONS.map((option) => {
          const selected = goalType === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setGoalType(option.id)}
              className={`flex-row items-center p-4 rounded-2xl border-2 bg-slate-900/80 ${
                selected
                  ? 'border-primary-500'
                  : 'border-slate-800'
              }`}
            >
              <LinearGradient
                colors={option.gradient}
                className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                style={{ borderRadius: 12 }}
              >
                <Ionicons name={option.icon} size={28} color="white" />
              </LinearGradient>
              <View className="flex-1">
                <Text className="text-lg font-sans-semibold text-white">
                  {option.title}
                </Text>
                <Text className="text-sm text-slate-400 mt-0.5">
                  {option.description}
                </Text>
              </View>
              {selected && (
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
              )}
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}
