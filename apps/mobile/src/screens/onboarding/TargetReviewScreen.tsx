import { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { MacroBar } from '../../components/ui/MacroBar';
import { Button } from '../../components/ui/Button';
import { useProfileStore, calculateTargets } from '../../stores/profile.store';
import { useColors } from '../../theme';
import { api } from '../../api/client';
import { useShallow } from 'zustand/react/shallow';

type Props = NativeStackScreenProps<SetupStackParamList, 'TargetReview'>;

export function TargetReviewScreen({ navigation }: Props) {
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
  const [loading, setLoading] = useState(false);
  const c = useColors();

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
      // Navigate only after the backend confirms data was saved
      navigation.navigate('SubscriptionPitch');
    } catch {
      Alert.alert(
        'Something went wrong',
        "We couldn't save your profile. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = () => {
    navigation.goBack();
  };

  if (!targets) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="alert-circle-outline" size={48} color={c.textSecondary} />
        <Text
          style={{
            color: c.textSecondary,
            marginTop: 16,
            textAlign: 'center',
            paddingHorizontal: 32,
          }}
        >
          No targets calculated. Please go back and complete all steps.
        </Text>
        <Button onPress={() => navigation.popToTop()} variant="outline" className="mt-6">
          Start Over
        </Button>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View
          style={{
            backgroundColor: c.card,
            paddingTop: 32,
            paddingBottom: 48,
            paddingHorizontal: 24,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', color: c.text, marginBottom: 4 }}>
            Your Personalized Plan
          </Text>
          <Text style={{ fontSize: 16, color: c.textSecondary }}>
            Based on your profile and goals
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: -24 }}>
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <ProgressRing
                progress={1}
                size={160}
                color={c.primary}
                gradientEnd={c.primaryMuted}
                backgroundColor={c.border}
                centerLabel={`${targets.calories}`}
                centerSubLabel="kcal / day"
              />
            </View>

            <View style={{ gap: 16 }}>
              <MacroBar
                label="Protein"
                current={targets.protein}
                target={targets.protein}
                color={c.primary}
                size="large"
              />
              <MacroBar
                label="Carbs"
                current={targets.carbs}
                target={targets.carbs}
                color={c.textSecondary}
              />
              <MacroBar
                label="Fat"
                current={targets.fat}
                target={targets.fat}
                color={c.textTertiary}
              />
            </View>
          </View>

          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: c.text,
                marginBottom: 12,
              }}
            >
              Your Profile Summary
            </Text>
            <View style={{ gap: 8 }}>
              <SummaryRow label="Goal" value={formatGoalType(data.goalType)} colors={c} />
              <SummaryRow
                label="Current → Target"
                value={`${data.weightKg} kg → ${data.goalWeightKg} kg`}
                colors={c}
              />
              <SummaryRow
                label="Weekly Rate"
                value={data.weeklyRateKg === 0 ? 'Maintain' : `${data.weeklyRateKg} kg/week`}
                colors={c}
              />
              <SummaryRow
                label="Diet Style"
                value={formatDietPref(data.dietPreference)}
                colors={c}
              />
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              backgroundColor: `${c.primary}1a`,
              borderWidth: 1,
              borderColor: `${c.primary}33`,
              borderRadius: 16,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <Ionicons
              name="information-circle"
              size={20}
              color={c.primary}
              style={{ marginTop: 1 }}
            />
            <Text
              style={{
                fontSize: 12,
                color: c.textSecondary,
                marginLeft: 8,
                flex: 1,
                lineHeight: 20,
              }}
            >
              These targets are AI-generated recommendations. You can always adjust them later in
              Settings.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16, gap: 12 }}>
        <Button onPress={handleConfirm} size="lg" loading={loading} className="w-full">
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

function SummaryRow({
  label,
  value,
  colors: c,
}: {
  label: string;
  value: string | null | undefined;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontSize: 12, color: c.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '500', color: c.text }}>{value ?? '—'}</Text>
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
