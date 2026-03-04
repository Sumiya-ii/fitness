import { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import type { GoalType } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';

type GoalOption = {
  id: GoalType;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  gradient: [string, string];
};

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'lose',
    icon: 'trending-down-outline',
    title: 'Lose Fat',
    description: 'Create a calorie deficit to lose weight gradually and sustainably.',
    gradient: ['#22c55e', '#16a34a'],
  },
  {
    id: 'maintain',
    icon: 'scale-outline',
    title: 'Maintain',
    description: 'Keep your current weight with balanced nutrition and consistent habits.',
    gradient: ['#0ea5e9', '#0284c7'],
  },
  {
    id: 'gain',
    icon: 'trending-up-outline',
    title: 'Gain',
    description: 'Build muscle and gain weight with a controlled calorie surplus.',
    gradient: ['#f59e0b', '#d97706'],
  },
];

type Props = NativeStackScreenProps<any, 'GoalSetup'>;

export function GoalSetupScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<GoalType | null>(null);
  const setGoal = useProfileStore((s) => s.setGoal);

  const handleContinue = () => {
    if (selected) {
      setGoal(selected);
      navigation.navigate('ProfileSetup');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900" edges={['top']}>
      <LinearGradient
        colors={['#22c55e', '#16a34a']}
        className="pt-8 pb-12 px-6"
        style={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
      >
        <Text className="text-2xl font-sans-bold text-white mb-1">Choose Your Goal</Text>
        <Text className="text-base text-white/90">
          We'll personalize your targets based on this
        </Text>
      </LinearGradient>

      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        {GOAL_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <Card
              key={option.id}
              pressable
              onPress={() => setSelected(option.id)}
              className={`mb-4 overflow-hidden border-2 ${
                isSelected ? 'border-primary-500' : 'border-transparent'
              }`}
            >
              <View className="flex-row items-center">
                <LinearGradient
                  colors={option.gradient}
                  className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                >
                  <Ionicons name={option.icon} size={28} color="white" />
                </LinearGradient>
                <View className="flex-1">
                  <Text className="text-lg font-sans-semibold text-text dark:text-slate-100">
                    {option.title}
                  </Text>
                  <Text className="text-sm text-text-secondary mt-0.5 dark:text-slate-400">
                    {option.description}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                )}
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <View className="px-6 pb-8 pt-4">
        <Button
          onPress={handleContinue}
          size="lg"
          disabled={!selected}
          className="w-full"
        >
          Continue
        </Button>
      </View>
    </SafeAreaView>
  );
}
