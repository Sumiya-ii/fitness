import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type Props = NativeStackScreenProps<SetupStackParamList, 'Motivation'>;

export function MotivationScreen({ navigation }: Props) {
  const goalType = useProfileStore((s) => s.goalType);
  const weightKg = useProfileStore((s) => s.weightKg);
  const goalWeightKg = useProfileStore((s) => s.goalWeightKg);
  const weeklyRateKg = useProfileStore((s) => s.weeklyRateKg);

  const diff =
    weightKg && goalWeightKg ? Math.abs(weightKg - goalWeightKg) : null;
  const weeks =
    diff && weeklyRateKg && weeklyRateKg > 0
      ? Math.ceil(diff / weeklyRateKg)
      : null;

  const goalMessage =
    goalType === 'lose_fat'
      ? 'Your goal is totally realistic!'
      : goalType === 'gain'
        ? 'Great goal — let\'s build some muscle!'
        : 'Maintaining is the smartest move!';

  return (
    <OnboardingLayout
      step={10}
      totalSteps={TOTAL_STEPS}
      title="You're all set!"
      subtitle="Let's review what we've built for you"
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('TargetReview')}
      continueLabel="See My Plan"
    >
      <View className="flex-1 justify-center">
        <LinearGradient
          colors={['#1f2028', '#15161d']}
          className="rounded-3xl p-6 mb-6"
          style={{ borderRadius: 24 }}
        >
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center mb-3">
              <Ionicons name="checkmark-done" size={36} color="white" />
            </View>
            <Text className="text-xl font-sans-bold text-text text-center">
              {goalMessage}
            </Text>
          </View>

          {weeks && goalType !== 'maintain' && (
            <View className="bg-white/15 rounded-2xl p-4">
              <Text className="text-sm text-text/80 text-center mb-1">
                Estimated time to reach your goal
              </Text>
              <Text className="text-3xl font-sans-bold text-text text-center">
                {weeks} weeks
              </Text>
              <Text className="text-xs text-text/70 text-center mt-1">
                {diff?.toFixed(1)} kg · {weeklyRateKg} kg/week
              </Text>
            </View>
          )}
        </LinearGradient>

        <View className="gap-3">
          {[
            {
              icon: 'sparkles' as const,
              text: 'AI-powered food logging with photo & voice',
            },
            {
              icon: 'analytics' as const,
              text: 'Daily tracking with macro breakdowns',
            },
            {
              icon: 'chatbubbles' as const,
              text: 'Telegram coach for daily accountability',
            },
          ].map((item, i) => (
            <View key={i} className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-primary-500/15 items-center justify-center mr-3">
                <Ionicons name={item.icon} size={16} color="#1f2028" />
              </View>
              <Text className="text-sm font-sans-medium text-text flex-1">
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </OnboardingLayout>
  );
}
