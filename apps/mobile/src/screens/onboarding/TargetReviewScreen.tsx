import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { MacroBar } from '../../components/ui/MacroBar';
import { Button } from '../../components/ui/Button';
import { useProfileStore, calculateTargets } from '../../stores/profile.store';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { useShallow } from 'zustand/react/shallow';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'TargetReview'>;

export function TargetReviewScreen({ navigation }: Props) {
  const { t } = useLocale();
  const data = useProfileStore(
    useShallow((s) => ({
      goalType: s.goalType,
      goalWeightKg: s.goalWeightKg,
      weeklyRateKg: s.weeklyRateKg,
      gender: s.gender,
      birthDate: s.birthDate,
      heightCm: s.heightCm,
      weightKg: s.weightKg,
      activityLevel: s.activityLevel,
      dietPreference: s.dietPreference,
    })),
  );
  const targets = calculateTargets(data);
  const c = useColors();

  const handleConfirm = () => {
    if (
      !data.goalType ||
      !data.goalWeightKg ||
      data.weeklyRateKg == null ||
      !data.gender ||
      !data.birthDate ||
      !data.heightCm ||
      !data.weightKg ||
      !data.activityLevel ||
      !data.dietPreference
    ) {
      Alert.alert('Incomplete', t('onboarding.targetIncompleteAlert'));
      return;
    }

    navigation.navigate('SignUp');
  };

  const handleAdjust = () => {
    navigation.goBack();
  };

  if (!targets) {
    return (
      <SafeAreaView className="flex-1 bg-surface-app items-center justify-center">
        <Ionicons name="alert-circle-outline" size={48} color={c.textSecondary} />
        <Text className="text-text-secondary mt-4 text-center px-8">
          {t('onboarding.targetIncomplete')}
        </Text>
        <Button
          onPress={() => navigation.popToTop()}
          variant="outline"
          className="mt-6"
          accessibilityLabel={t('onboarding.targetStartOver')}
        >
          {t('onboarding.targetStartOver')}
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-app">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View
          className="pt-8 pb-12 px-6 bg-surface-card"
          style={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
        >
          <Text className="text-2xl font-sans-bold text-text mb-1" accessibilityRole="header">
            {t('onboarding.targetTitle')}
          </Text>
          <Text className="text-base text-text-secondary">{t('onboarding.targetSubtitle')}</Text>
        </View>

        <View className="px-6 -mt-6">
          <View className="bg-surface-card rounded-2xl p-6 mb-6">
            <View className="items-center mb-6">
              <ProgressRing
                progress={1}
                size={160}
                color={c.primary}
                gradientEnd={c.primaryMuted}
                backgroundColor={c.border}
                centerLabel={`${targets.calories}`}
                centerSubLabel={t('onboarding.targetKcalDay')}
              />
            </View>

            <View className="gap-4">
              <MacroBar
                label={t('onboarding.targetProtein')}
                current={targets.protein}
                target={targets.protein}
                color={c.primary}
                size="large"
              />
              <MacroBar
                label={t('onboarding.targetCarbs')}
                current={targets.carbs}
                target={targets.carbs}
                color={c.textSecondary}
              />
              <MacroBar
                label={t('onboarding.targetFat')}
                current={targets.fat}
                target={targets.fat}
                color={c.textTertiary}
              />
            </View>
          </View>

          <View className="bg-surface-card rounded-2xl p-4 mb-6">
            <Text className="text-sm font-sans-semibold text-text mb-3">
              {t('onboarding.targetProfileSummary')}
            </Text>
            <View className="gap-2">
              <SummaryRow
                label={t('onboarding.targetGoalLabel')}
                value={formatGoalType(data.goalType, t)}
                colors={c}
              />
              <SummaryRow
                label={t('onboarding.targetCurrentToTarget')}
                value={`${data.weightKg} kg \u2192 ${data.goalWeightKg} kg`}
                colors={c}
              />
              <SummaryRow
                label={t('onboarding.targetWeeklyRate')}
                value={
                  data.weeklyRateKg === 0
                    ? t('onboarding.targetMaintain')
                    : t('onboarding.targetKgWeek').replace('{{rate}}', String(data.weeklyRateKg))
                }
                colors={c}
              />
              <SummaryRow
                label={t('onboarding.targetDietStyle')}
                value={formatDietPref(data.dietPreference, t)}
                colors={c}
              />
            </View>
          </View>

          <View
            className="flex-row items-start rounded-2xl p-4 mb-6 border"
            style={{
              backgroundColor: `${c.primary}1a`,
              borderColor: `${c.primary}33`,
            }}
          >
            <Ionicons
              name="information-circle"
              size={20}
              color={c.primary}
              style={{ marginTop: 1 }}
            />
            <Text className="text-xs text-text-secondary ml-2 flex-1 leading-5">
              {t('onboarding.targetInfoNote')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className="px-6 pb-8 pt-4 gap-3">
        <Button
          onPress={handleConfirm}
          size="lg"
          className="w-full"
          accessibilityLabel={t('onboarding.targetConfirm')}
        >
          {t('onboarding.targetConfirm')}
        </Button>
        <Button
          onPress={handleAdjust}
          variant="outline"
          size="md"
          className="w-full"
          accessibilityLabel={t('onboarding.targetAdjust')}
        >
          {t('onboarding.targetAdjust')}
        </Button>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-xs text-text-secondary">{label}</Text>
      <Text className="text-xs font-sans-medium text-text">{value ?? '\u2014'}</Text>
    </View>
  );
}

function formatGoalType(goal: string | null, t: (key: string) => string): string {
  switch (goal) {
    case 'lose_fat':
      return t('onboarding.goalLoseFat');
    case 'maintain':
      return t('onboarding.goalMaintain');
    case 'gain':
      return t('onboarding.goalGain');
    default:
      return '\u2014';
  }
}

function formatDietPref(pref: string | null, t: (key: string) => string): string {
  switch (pref) {
    case 'standard':
      return t('onboarding.dietStandard');
    case 'high_protein':
      return t('onboarding.dietHighProtein');
    case 'low_carb':
      return t('onboarding.dietLowCarb');
    case 'low_fat':
      return t('onboarding.dietLowFat');
    default:
      return '\u2014';
  }
}
