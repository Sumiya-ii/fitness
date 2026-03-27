import { View, Text, Pressable, ScrollView } from 'react-native';
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
};

const OPTIONS: ActivityOption[] = [
  {
    id: 'sedentary',
    icon: 'desktop-outline',
    title: 'Sedentary',
    description: 'Desk job, little to no exercise',
  },
  {
    id: 'lightly_active',
    icon: 'walk-outline',
    title: 'Lightly Active',
    description: 'Light exercise 1–3 days/week',
  },
  {
    id: 'moderately_active',
    icon: 'bicycle-outline',
    title: 'Moderately Active',
    description: 'Moderate exercise 3–5 days/week',
  },
  {
    id: 'very_active',
    icon: 'fitness-outline',
    title: 'Very Active',
    description: 'Hard exercise 6–7 days/week',
  },
  {
    id: 'extra_active',
    icon: 'flame-outline',
    title: 'Extra Active',
    description: 'Physical job + intense daily training',
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View style={{ gap: 10 }}>
          {OPTIONS.map((opt) => {
            const selected = activityLevel === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setActivityLevel(opt.id)}
                style={({ pressed }) => ({
                  backgroundColor: selected ? '#ffffff' : '#1c1c1e',
                  borderRadius: 16,
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: selected ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={opt.icon} size={20} color={selected ? '#000000' : '#ffffff'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: selected ? '#000000' : '#ffffff',
                      marginBottom: 2,
                    }}
                  >
                    {opt.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: selected ? 'rgba(0,0,0,0.6)' : '#71717a',
                    }}
                  >
                    {opt.description}
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
