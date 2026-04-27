import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { displayWeeklyRate } from '../../utils/units';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';
import { OptionRow } from './components/OptionRow';

type RateOption = {
  value: number;
  descKey: string;
};

const LOSE_RATES: RateOption[] = [
  { value: 0.25, descKey: 'onboarding.weeklyRateSlowSteady' },
  { value: 0.5, descKey: 'onboarding.weeklyRateRecommended' },
  { value: 0.75, descKey: 'onboarding.weeklyRateModerate' },
  { value: 1.0, descKey: 'onboarding.weeklyRateAggressive' },
];

const GAIN_RATES: RateOption[] = [
  { value: 0.25, descKey: 'onboarding.weeklyRateLeanBulk' },
  { value: 0.5, descKey: 'onboarding.weeklyRateRecommended' },
  { value: 0.75, descKey: 'onboarding.weeklyRateFastBulk' },
];

const DEFAULT_RATE = 0.5;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'WeeklyRate'>;

export function WeeklyRateScreen({ navigation }: Props) {
  const goalType = useProfileStore((s) => s.goalType);
  const stored = useProfileStore((s) => s.weeklyRateKg);
  const setWeeklyRateKg = useProfileStore((s) => s.setWeeklyRateKg);
  const c = useColors();
  const { t } = useLocale();

  const rates = goalType === 'gain' ? GAIN_RATES : LOSE_RATES;
  const isMaintain = goalType === 'maintain';

  // Default to 0.5 kg/week when unset.
  const [selected, setSelected] = useState<number>(stored ?? DEFAULT_RATE);

  const handleSelect = (value: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(value);
  };

  const handleContinue = () => {
    setWeeklyRateKg(isMaintain ? 0 : selected);
    navigation.navigate('ActivityLevelSelect');
  };

  if (isMaintain) {
    return (
      <OnboardingLayout
        route="WeeklyRate"
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
      route="WeeklyRate"
      title={t('onboarding.weeklyRateTitle')}
      subtitle={
        goalType === 'lose_fat'
          ? t('onboarding.weeklyRateLoseSubtitle')
          : t('onboarding.weeklyRateGainSubtitle')
      }
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View className="gap-3">
          {rates.map((rate, i) => {
            const isSelected = selected === rate.value;
            const isRecommended = rate.value === 0.5;
            const label = `${displayWeeklyRate(rate.value)} kg/week`;

            return (
              <OptionRow key={rate.value} index={i}>
                <Pressable
                  onPress={() => handleSelect(rate.value)}
                  className={`rounded-2xl py-4 px-4 flex-row items-center gap-3 active:opacity-85 ${
                    isSelected ? 'bg-primary-500' : 'bg-surface-card'
                  }`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${label} ${t(rate.descKey)}`}
                >
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text
                        className={`text-base font-sans-semibold ${
                          isSelected ? 'text-on-primary' : 'text-text'
                        }`}
                      >
                        {label}
                      </Text>
                      {isRecommended && (
                        <View
                          className="ml-2 px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: isSelected ? `${c.onPrimary}26` : `${c.primary}26`,
                          }}
                        >
                          <Text
                            className="text-xs font-sans-medium"
                            style={{ color: isSelected ? c.onPrimary : c.primary }}
                          >
                            {t('onboarding.weeklyRateRecommended')}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      className="text-sm"
                      style={{
                        color: isSelected ? `${c.onPrimary}b3` : c.textTertiary,
                      }}
                    >
                      {t(rate.descKey)}
                    </Text>
                  </View>
                </Pressable>
              </OptionRow>
            );
          })}
        </View>
      </ScrollView>
    </OnboardingLayout>
  );
}
