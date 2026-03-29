import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useSettingsStore } from '../../stores/settings.store';
import { displayWeeklyRate, weeklyRateUnit } from '../../utils/units';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 11;

type RateOption = {
  value: number;
  descKey: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const LOSE_RATES: RateOption[] = [
  { value: 0.25, descKey: 'onboarding.weeklyRateSlowSteady', icon: 'walk-outline' },
  { value: 0.5, descKey: 'onboarding.weeklyRateRecommended', icon: 'bicycle-outline' },
  { value: 0.75, descKey: 'onboarding.weeklyRateModerate', icon: 'fitness-outline' },
  { value: 1.0, descKey: 'onboarding.weeklyRateAggressive', icon: 'flash-outline' },
];

const GAIN_RATES: RateOption[] = [
  { value: 0.25, descKey: 'onboarding.weeklyRateLeanBulk', icon: 'walk-outline' },
  { value: 0.5, descKey: 'onboarding.weeklyRateRecommended', icon: 'bicycle-outline' },
  { value: 0.75, descKey: 'onboarding.weeklyRateFastBulk', icon: 'fitness-outline' },
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'WeeklyRate'>;

export function WeeklyRateScreen({ navigation }: Props) {
  const goalType = useProfileStore((s) => s.goalType);
  const stored = useProfileStore((s) => s.weeklyRateKg);
  const setWeeklyRateKg = useProfileStore((s) => s.setWeeklyRateKg);
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const c = useColors();
  const { t } = useLocale();
  const [selected, setSelected] = useState<number | null>(stored);

  const rateLabel = weeklyRateUnit(unitSystem);
  const rates = goalType === 'gain' ? GAIN_RATES : LOSE_RATES;
  const isMaintain = goalType === 'maintain';

  const handleSelect = (value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(value);
  };

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
        title={t('onboarding.weeklyRateMaintainTitle')}
        subtitle={t('onboarding.weeklyRateMaintainSubtitle')}
        onBack={() => navigation.goBack()}
        onContinue={handleContinue}
      >
        <View className="flex-1 justify-center items-center">
          <View
            className="w-24 h-24 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: `${c.primary}1a` }}
          >
            <Ionicons name="scale-outline" size={48} color={c.textSecondary} />
          </View>
          <Text className="text-lg font-sans-medium text-text text-center">
            {t('onboarding.weeklyRateNoChange')}
          </Text>
        </View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      step={4}
      totalSteps={TOTAL_STEPS}
      title={t('onboarding.weeklyRateTitle')}
      subtitle={
        goalType === 'lose_fat'
          ? t('onboarding.weeklyRateLoseSubtitle')
          : t('onboarding.weeklyRateGainSubtitle')
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
                onPress={() => handleSelect(rate.value)}
                className="flex-row items-center p-4 rounded-2xl border-2 bg-surface-card active:opacity-85"
                style={{ borderColor: isSelected ? c.primary : c.border }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${label} ${t(rate.descKey)}`}
              >
                <View className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-surface-secondary">
                  <Ionicons
                    name={rate.icon}
                    size={20}
                    color={isSelected ? c.primary : c.textSecondary}
                  />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-sans-semibold text-text">{label}</Text>
                    {isRecommended && (
                      <View
                        className="ml-2 px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${c.primary}26` }}
                      >
                        <Text className="text-xs font-sans-medium" style={{ color: c.primary }}>
                          {t('onboarding.weeklyRateRecommended')}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-text-secondary">{t(rate.descKey)}</Text>
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
