import { useEffect } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { PrimaryPillButton } from '../../components/ui/PrimaryPillButton';
import { useProfileStore, calculateTargets } from '../../stores/profile.store';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { Button } from '../../components/ui/Button';
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

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

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
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="px-6 pt-10 pb-6">
          {/* Hero calorie block */}
          <Text className="text-[14px] uppercase tracking-wider text-text-tertiary text-center mb-2">
            {t('onboarding.targetCaloriesLabel')}
          </Text>
          <Text className="text-[64px] font-sans-bold text-text leading-[68px] text-center">
            {targets.calories}
          </Text>
          <Text className="text-[14px] text-text-tertiary text-center mt-1">
            {t('onboarding.targetKcalDay')}
          </Text>
        </View>

        {/* Macro grid */}
        <View className="flex-row px-5 mb-6">
          <MacroCell label={t('onboarding.targetProtein')} value={targets.protein} />
          <MacroCell label={t('onboarding.targetCarbs')} value={targets.carbs} />
          <MacroCell label={t('onboarding.targetFat')} value={targets.fat} />
        </View>

        {/* Profile summary card */}
        <View className="rounded-2xl bg-surface-card p-5 mx-5 mt-2 gap-3">
          <SummaryRow
            label={t('onboarding.targetGoalLabel')}
            value={formatGoalType(data.goalType, t)}
          />
          <SummaryRow
            label={t('onboarding.targetCurrentToTarget')}
            value={`${data.weightKg} kg → ${data.goalWeightKg} kg`}
          />
          <SummaryRow
            label={t('onboarding.targetWeeklyRate')}
            value={
              data.weeklyRateKg === 0
                ? t('onboarding.targetMaintain')
                : t('onboarding.targetKgWeek').replace('{{rate}}', String(data.weeklyRateKg))
            }
          />
          <SummaryRow
            label={t('onboarding.targetDietStyle')}
            value={formatDietPref(data.dietPreference, t)}
          />
        </View>
      </ScrollView>

      {/* CTAs */}
      <View className="px-5 pb-8 pt-4 gap-1">
        <PrimaryPillButton
          label={t('onboarding.targetConfirm')}
          onPress={handleConfirm}
          accessibilityLabel={t('onboarding.targetConfirm')}
        />
        <Pressable className="py-3 mt-1" onPress={() => navigation.goBack()}>
          <Text className="text-text-tertiary text-center text-[14px]">
            {t('onboarding.targetAdjust')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function MacroCell({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 items-center py-4 rounded-2xl bg-surface-card mx-1">
      <Text className="text-[24px] font-sans-bold text-text">{value}g</Text>
      <Text className="text-[12px] text-text-tertiary mt-1">{label}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-text-tertiary">{label}</Text>
      <Text className="text-text font-sans-medium">{value ?? '—'}</Text>
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
      return '—';
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
      return '—';
  }
}
