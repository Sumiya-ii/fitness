import { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { MacroBar } from '../../components/ui/MacroBar';
import { Button } from '../../components/ui/Button';
import { useProfileStore } from '../../stores/profile.store';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { api } from '../../api/client';

type Props = NativeStackScreenProps<SetupStackParamList, 'TargetReview'>;

export function TargetReviewScreen({ navigation }: Props) {
  const targets = useProfileStore((s) => s.getTargets());
  const data = useProfileStore((s) => s.getOnboardingData());
  const reset = useProfileStore((s) => s.reset);
  const setProfileSetupComplete = useOnboardingStore(
    (s) => s.setProfileSetupComplete,
  );
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
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
      Alert.alert('Incomplete', 'Please go back and fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/onboarding/complete', {
        goalType: data.goalType,
        goalWeightKg: data.goalWeightKg,
        weeklyRateKg: data.weeklyRateKg,
        gender: data.gender,
        birthDate: data.birthDate.toISOString().split('T')[0],
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        activityLevel: data.activityLevel,
        dietPreference: data.dietPreference,
      });

      await setProfileSetupComplete();
    } catch {
      // If API call fails, still complete onboarding locally
      // Backend sync can happen later when connection is available
      await setProfileSetupComplete();
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = () => {
    navigation.goBack();
  };

  if (!targets) {
    return (
      <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900 items-center justify-center">
        <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
        <Text className="text-text-secondary dark:text-slate-400 mt-4 text-center px-8">
          No targets calculated. Please go back and complete all steps.
        </Text>
        <Button onPress={() => navigation.popToTop()} variant="outline" className="mt-6">
          Start Over
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <LinearGradient
          colors={['#22c55e', '#16a34a']}
          className="pt-8 pb-12 px-6"
          style={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
        >
          <Text className="text-2xl font-sans-bold text-white mb-1">
            Your Personalized Plan
          </Text>
          <Text className="text-base text-white/90">
            Based on your profile and goals
          </Text>
        </LinearGradient>

        <View className="px-6 -mt-6">
          <View className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg shadow-black/5 mb-6">
            <View className="items-center mb-6">
              <ProgressRing
                progress={1}
                size={160}
                color="#22c55e"
                gradientEnd="#16a34a"
                backgroundColor="#e2e8f0"
                centerLabel={`${targets.calories}`}
                centerSubLabel="kcal / day"
              />
            </View>

            <View className="gap-4">
              <MacroBar
                label="Protein"
                current={targets.protein}
                target={targets.protein}
                color="#22c55e"
                size="large"
              />
              <MacroBar
                label="Carbs"
                current={targets.carbs}
                target={targets.carbs}
                color="#0ea5e9"
              />
              <MacroBar
                label="Fat"
                current={targets.fat}
                target={targets.fat}
                color="#f59e0b"
              />
            </View>
          </View>

          <View className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6">
            <Text className="text-sm font-sans-semibold text-text dark:text-slate-200 mb-3">
              Your Profile Summary
            </Text>
            <View className="gap-2">
              <SummaryRow label="Goal" value={formatGoalType(data.goalType)} />
              <SummaryRow
                label="Current → Target"
                value={`${data.weightKg} kg → ${data.goalWeightKg} kg`}
              />
              <SummaryRow
                label="Weekly Rate"
                value={
                  data.weeklyRateKg === 0
                    ? 'Maintain'
                    : `${data.weeklyRateKg} kg/week`
                }
              />
              <SummaryRow label="Diet Style" value={formatDietPref(data.dietPreference)} />
            </View>
          </View>

          <View className="flex-row items-start bg-primary-50 dark:bg-primary-900/20 rounded-2xl p-4 mb-6">
            <Ionicons
              name="information-circle"
              size={20}
              color="#22c55e"
              style={{ marginTop: 1 }}
            />
            <Text className="text-xs text-text-secondary dark:text-slate-400 ml-2 flex-1 leading-5">
              These targets are AI-generated recommendations. You can always
              adjust them later in Settings.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className="px-6 pb-8 pt-4 gap-3">
        <Button
          onPress={handleConfirm}
          size="lg"
          loading={loading}
          className="w-full"
        >
          Looks Good — Let's Go!
        </Button>
        <Button
          onPress={handleAdjust}
          variant="outline"
          size="md"
          className="w-full"
          disabled={loading}
        >
          Adjust
        </Button>
      </View>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-xs text-text-secondary dark:text-slate-400">{label}</Text>
      <Text className="text-xs font-sans-medium text-text dark:text-slate-200">
        {value ?? '—'}
      </Text>
    </View>
  );
}

function formatGoalType(goal: string | null): string {
  switch (goal) {
    case 'lose_fat':
      return 'Lose Fat';
    case 'maintain':
      return 'Maintain';
    case 'gain':
      return 'Build Muscle';
    default:
      return '—';
  }
}

function formatDietPref(pref: string | null): string {
  switch (pref) {
    case 'standard':
      return 'Standard';
    case 'high_protein':
      return 'High Protein';
    case 'low_carb':
      return 'Low Carb';
    case 'low_fat':
      return 'Low Fat';
    default:
      return '—';
  }
}
