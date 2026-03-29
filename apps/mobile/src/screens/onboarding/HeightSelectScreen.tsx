import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useSettingsStore } from '../../stores/settings.store';
import { cmToFeetInches, feetInchesToCm } from '../../utils/units';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 11;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'HeightSelect'>;

export function HeightSelectScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.heightCm);
  const setHeightCm = useProfileStore((s) => s.setHeightCm);
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const c = useColors();
  const { t } = useLocale();

  const storedFtIn = stored ? cmToFeetInches(stored) : null;
  const [cmValue, setCmValue] = useState(stored?.toString() ?? '');
  const [feetValue, setFeetValue] = useState(storedFtIn ? storedFtIn.feet.toString() : '');
  const [inchesValue, setInchesValue] = useState(storedFtIn ? storedFtIn.inches.toString() : '');

  const isMetric = unitSystem === 'metric';

  let heightCm: number;
  let isValid: boolean;
  let altDisplay: string | null = null;

  if (isMetric) {
    heightCm = parseInt(cmValue, 10);
    isValid = !isNaN(heightCm) && heightCm >= 50 && heightCm <= 300;
    if (isValid) {
      const { feet, inches } = cmToFeetInches(heightCm);
      altDisplay = `\u2248 ${feet}'${inches}"`;
    }
  } else {
    const ft = parseInt(feetValue, 10);
    const inches = parseInt(inchesValue, 10) || 0;
    heightCm = feetInchesToCm(isNaN(ft) ? 0 : ft, inches);
    isValid = !isNaN(ft) && ft >= 1 && ft <= 9 && inches >= 0 && inches <= 11 && heightCm >= 50;
    if (isValid) {
      altDisplay = `\u2248 ${heightCm} cm`;
    }
  }

  const handleContinue = () => {
    if (isValid) {
      setHeightCm(heightCm);
      navigation.navigate('WeightSelect');
    }
  };

  return (
    <OnboardingLayout
      step={7}
      totalSteps={TOTAL_STEPS}
      title={t('onboarding.heightTitle')}
      subtitle={t('onboarding.heightSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      <View className="flex-1 justify-center items-center">
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-8"
          style={{ backgroundColor: `${c.primary}1a` }}
        >
          <Ionicons name="resize-outline" size={40} color={c.primary} />
        </View>

        {isMetric ? (
          <View className="flex-row items-end mb-4">
            <TextInput
              value={cmValue}
              onChangeText={(v) => setCmValue(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="170"
              placeholderTextColor={c.textTertiary}
              className="text-5xl font-sans-bold text-text text-center min-w-[120px]"
              maxLength={3}
              autoFocus
              accessibilityLabel={t('onboarding.heightTitle')}
            />
            <Text className="text-2xl font-sans-medium text-text-secondary ml-2 mb-2">cm</Text>
          </View>
        ) : (
          <View className="flex-row items-end mb-4 gap-3">
            <View className="flex-row items-end">
              <TextInput
                value={feetValue}
                onChangeText={(v) => setFeetValue(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="5"
                placeholderTextColor={c.textTertiary}
                className="text-5xl font-sans-bold text-text text-center min-w-[60px]"
                maxLength={1}
                autoFocus
                accessibilityLabel="Feet"
              />
              <Text className="text-2xl font-sans-medium text-text-secondary ml-1 mb-2">ft</Text>
            </View>
            <View className="flex-row items-end">
              <TextInput
                value={inchesValue}
                onChangeText={(v) => setInchesValue(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="8"
                placeholderTextColor={c.textTertiary}
                className="text-5xl font-sans-bold text-text text-center min-w-[60px]"
                maxLength={2}
                accessibilityLabel="Inches"
              />
              <Text className="text-2xl font-sans-medium text-text-secondary ml-1 mb-2">in</Text>
            </View>
          </View>
        )}

        {altDisplay && (
          <Text className="text-sm font-sans-medium text-text-secondary">{altDisplay}</Text>
        )}
      </View>
    </OnboardingLayout>
  );
}
