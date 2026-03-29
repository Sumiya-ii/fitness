import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useSettingsStore } from '../../stores/settings.store';
import { displayWeeklyRate, weeklyRateUnit } from '../../utils/units';
import { useColors } from '../../theme';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 11;

type RateOption = {
  /** Rate in kg/week (always stored as kg) */
  value: number;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const LOSE_RATES: RateOption[] = [
  { value: 0.25, description: 'Slow & steady', icon: 'walk-outline' },
  { value: 0.5, description: 'Recommended', icon: 'bicycle-outline' },
  { value: 0.75, description: 'Moderate', icon: 'fitness-outline' },
  { value: 1.0, description: 'Aggressive', icon: 'flash-outline' },
];

const GAIN_RATES: RateOption[] = [
  { value: 0.25, description: 'Lean bulk', icon: 'walk-outline' },
  { value: 0.5, description: 'Recommended', icon: 'bicycle-outline' },
  { value: 0.75, description: 'Fast bulk', icon: 'fitness-outline' },
];

type Props = NativeStackScreenProps<SetupStackParamList, 'WeeklyRate'>;

export function WeeklyRateScreen({ navigation }: Props) {
  const goalType = useProfileStore((s) => s.goalType);
  const stored = useProfileStore((s) => s.weeklyRateKg);
  const setWeeklyRateKg = useProfileStore((s) => s.setWeeklyRateKg);
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const c = useColors();
  const [selected, setSelected] = useState<number | null>(stored);

  const rateLabel = weeklyRateUnit(unitSystem);
  const rates = goalType === 'gain' ? GAIN_RATES : LOSE_RATES;
  const isMaintain = goalType === 'maintain';

  const handleContinue = () => {
    if (isMaintain) {
      setWeeklyRateKg(0);
      navigation.navigate('GenderSelect');
    } else if (selected !== null) {
      setWeeklyRateKg(selected);
      navigation.navigate('GenderSelect');
    }
  };

  if (isMaintain) {
    return (
      <OnboardingLayout
        step={4}
        totalSteps={TOTAL_STEPS}
        title="Great choice!"
        subtitle="We'll maintain your current weight by matching your calorie intake to your daily burn"
        onBack={() => navigation.goBack()}
        onContinue={handleContinue}
      >
        <View className="flex-1 justify-center items-center">
          <View className="w-24 h-24 rounded-full bg-sky-500/15 items-center justify-center mb-4">
            <Ionicons name="scale-outline" size={48} color={c.textSecondary} />
          </View>
          <Text className="text-lg font-sans-medium text-text text-center">
            No weekly change target needed
          </Text>
        </View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      step={4}
      totalSteps={TOTAL_STEPS}
      title="How fast do you want results?"
      subtitle={
        goalType === 'lose_fat'
          ? 'Slower rates preserve more muscle mass'
          : 'Slower rates minimize fat gain'
      }
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={selected === null}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View className="gap-3">
          {rates.map((rate) => {
            const isSelected = selected === rate.value;
            const isRecommended = rate.value === 0.5;
            const label = `${displayWeeklyRate(rate.value, unitSystem)} ${rateLabel}`;

            return (
              <Pressable
                key={rate.value}
                onPress={() => setSelected(rate.value)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  backgroundColor: c.card,
                  borderColor: isSelected ? c.primary : c.border,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: c.cardAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Ionicons
                    name={rate.icon}
                    size={20}
                    color={isSelected ? c.primary : c.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: c.text,
                      }}
                    >
                      {label}
                    </Text>
                    {isRecommended && (
                      <View
                        style={{
                          marginLeft: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          backgroundColor: `${c.primary}26`,
                          borderRadius: 100,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '500',
                            color: c.primary,
                          }}
                        >
                          Recommended
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 14, color: c.textSecondary }}>{rate.description}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={22} color={c.primary} />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </OnboardingLayout>
  );
}
