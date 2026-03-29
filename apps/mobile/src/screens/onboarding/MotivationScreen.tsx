import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useSettingsStore } from '../../stores/settings.store';
import { displayWeight, displayWeeklyRate, weightUnit, weeklyRateUnit } from '../../utils/units';
import { useColors } from '../../theme';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 11;

type Props = NativeStackScreenProps<SetupStackParamList, 'Motivation'>;

export function MotivationScreen({ navigation }: Props) {
  const goalType = useProfileStore((s) => s.goalType);
  const weightKg = useProfileStore((s) => s.weightKg);
  const goalWeightKg = useProfileStore((s) => s.goalWeightKg);
  const weeklyRateKg = useProfileStore((s) => s.weeklyRateKg);
  const c = useColors();

  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const diff = weightKg && goalWeightKg ? Math.abs(weightKg - goalWeightKg) : null;
  const weeks = diff && weeklyRateKg && weeklyRateKg > 0 ? Math.ceil(diff / weeklyRateKg) : null;

  const goalMessage =
    goalType === 'lose_fat'
      ? 'Your goal is totally realistic!'
      : goalType === 'gain'
        ? "Great goal — let's build some muscle!"
        : 'Maintaining is the smartest move!';

  return (
    <OnboardingLayout
      step={11}
      totalSteps={TOTAL_STEPS}
      title="You're all set!"
      subtitle="Let's review what we've built for you"
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('TargetReview')}
      continueLabel="See My Plan"
    >
      <View className="flex-1 justify-center">
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 24,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <View className="items-center mb-4">
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: `${c.primary}33`,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name="checkmark-done" size={36} color={c.primary} />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                color: c.text,
                textAlign: 'center',
              }}
            >
              {goalMessage}
            </Text>
          </View>

          {weeks && goalType !== 'maintain' && (
            <View
              style={{
                backgroundColor: `${c.primary}26`,
                borderRadius: 16,
                padding: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: c.textSecondary,
                  textAlign: 'center',
                  marginBottom: 4,
                }}
              >
                Estimated time to reach your goal
              </Text>
              <Text
                style={{
                  fontSize: 30,
                  fontWeight: '700',
                  color: c.text,
                  textAlign: 'center',
                }}
              >
                {weeks} weeks
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: c.textTertiary,
                  textAlign: 'center',
                  marginTop: 4,
                }}
              >
                {diff ? displayWeight(diff, unitSystem) : ''} {weightUnit(unitSystem)} ·{' '}
                {weeklyRateKg ? displayWeeklyRate(weeklyRateKg, unitSystem) : ''}{' '}
                {weeklyRateUnit(unitSystem)}
              </Text>
            </View>
          )}
        </View>

        <View style={{ gap: 12 }}>
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
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: `${c.primary}26`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Ionicons name={item.icon} size={16} color={c.primary} />
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: c.text,
                  flex: 1,
                }}
              >
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </OnboardingLayout>
  );
}
