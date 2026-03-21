import { View, Text, Pressable, ScrollView } from 'react-native';
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
    gradient: ['#1f2028', '#15161d'],
  },
  {
    id: 'maintain',
    icon: 'scale-outline',
    title: 'Maintain Weight',
    description: 'Keep your current weight with balanced nutrition',
    gradient: ['#8b8fa0', '#767b8f'],
  },
  {
    id: 'gain',
    icon: 'trending-up-outline',
    title: 'Build Muscle',
    description: 'Gain lean mass with a controlled calorie surplus',
    gradient: ['#8f93a4', '#797d90'],
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View className="gap-4">
          {GOAL_OPTIONS.map((option) => {
            const selected = goalType === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setGoalType(option.id)}
                className={`flex-row items-center p-4 rounded-2xl border-2 bg-surface-card ${
                  selected ? 'border-primary-500' : 'border-surface-border'
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
                  <Text className="text-lg font-sans-semibold text-text">{option.title}</Text>
                  <Text className="text-sm text-text-secondary mt-0.5">{option.description}</Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={24} color="#1f2028" />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </OnboardingLayout>
  );
}
