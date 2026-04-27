import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { displayWeight, displayWeeklyRate } from '../../utils/units';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Motivation'>;

export function MotivationScreen({ navigation }: Props) {
  const goalType = useProfileStore((s) => s.goalType);
  const weightKg = useProfileStore((s) => s.weightKg);
  const goalWeightKg = useProfileStore((s) => s.goalWeightKg);
  const weeklyRateKg = useProfileStore((s) => s.weeklyRateKg);
  const c = useColors();
  const { t } = useLocale();

  const diff = weightKg && goalWeightKg ? Math.abs(weightKg - goalWeightKg) : null;
  const weeks = diff && weeklyRateKg && weeklyRateKg > 0 ? Math.ceil(diff / weeklyRateKg) : null;

  const goalMessageKey =
    goalType === 'lose_fat'
      ? 'onboarding.motivationLoseFat'
      : goalType === 'gain'
        ? 'onboarding.motivationGain'
        : 'onboarding.motivationMaintain';

  const features = [
    { icon: 'sparkles' as const, textKey: 'onboarding.motivationAI' },
    { icon: 'analytics' as const, textKey: 'onboarding.motivationTracking' },
    { icon: 'chatbubbles' as const, textKey: 'onboarding.motivationTelegram' },
  ];

  return (
    <OnboardingLayout
      route="Motivation"
      title={t('onboarding.motivationTitle')}
      subtitle={t('onboarding.motivationSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('GeneratingPlan')}
      continueLabel={t('onboarding.motivationSeePlan')}
    >
      <View className="flex-1 justify-center">
        <View className="bg-surface-card rounded-3xl p-6 mb-6">
          <View className="items-center mb-4">
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: `${c.primary}33` }}
            >
              <Ionicons name="checkmark-done" size={36} color={c.primary} />
            </View>
            <Text
              className="text-xl font-sans-bold text-text text-center"
              accessibilityRole="header"
            >
              {t(goalMessageKey)}
            </Text>
          </View>

          {weeks != null && goalType !== 'maintain' && (
            <View className="rounded-2xl p-4" style={{ backgroundColor: `${c.primary}26` }}>
              <Text className="text-sm text-text-secondary text-center mb-1">
                {t('onboarding.motivationEstimate')}
              </Text>
              <Text className="text-[30px] font-sans-bold text-text text-center">
                {t('onboarding.motivationWeeks').replace('{{weeks}}', weeks.toString())}
              </Text>
              <Text className="text-xs text-text-tertiary text-center mt-1">
                {diff ? displayWeight(diff) : ''} kg {'\u00b7'}{' '}
                {weeklyRateKg ? displayWeeklyRate(weeklyRateKg) : ''} kg/week
              </Text>
            </View>
          )}
        </View>

        <View className="gap-3">
          {features.map((item, i) => (
            <View key={i} className="flex-row items-center">
              <View
                className="w-8 h-8 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: `${c.primary}26` }}
              >
                <Ionicons name={item.icon} size={16} color={c.primary} />
              </View>
              <Text className="text-sm font-sans-medium text-text flex-1">{t(item.textKey)}</Text>
            </View>
          ))}
        </View>
      </View>
    </OnboardingLayout>
  );
}
