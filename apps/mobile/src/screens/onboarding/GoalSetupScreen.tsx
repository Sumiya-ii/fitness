import { View, Text, Pressable, ScrollView } from 'react-native';
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
};

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'lose_fat',
    icon: 'trending-down-outline',
    title: 'Lose Fat',
    description: 'Burn fat and get leaner with a calorie deficit',
  },
  {
    id: 'maintain',
    icon: 'scale-outline',
    title: 'Maintain Weight',
    description: 'Keep your current weight with balanced nutrition',
  },
  {
    id: 'gain',
    icon: 'trending-up-outline',
    title: 'Build Muscle',
    description: 'Gain lean mass with a controlled calorie surplus',
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
        <View style={{ gap: 12 }}>
          {GOAL_OPTIONS.map((option) => {
            const selected = goalType === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setGoalType(option.id)}
                style={({ pressed }) => ({
                  backgroundColor: selected ? '#ffffff' : '#1c1c1e',
                  borderRadius: 18,
                  paddingVertical: 20,
                  paddingHorizontal: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: selected ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={option.icon} size={22} color={selected ? '#000000' : '#ffffff'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: selected ? '#000000' : '#ffffff',
                      marginBottom: 3,
                    }}
                  >
                    {option.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: selected ? 'rgba(0,0,0,0.65)' : '#71717a',
                      lineHeight: 18,
                    }}
                  >
                    {option.description}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </OnboardingLayout>
  );
}
