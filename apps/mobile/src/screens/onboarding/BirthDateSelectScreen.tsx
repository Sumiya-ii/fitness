import { useState, useMemo } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 11;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BirthDateSelect'>;

export function BirthDateSelectScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.birthDate);
  const setBirthDate = useProfileStore((s) => s.setBirthDate);
  const c = useColors();
  const { t } = useLocale();

  const [year, setYear] = useState(stored ? stored.getFullYear().toString() : '');
  const [month, setMonth] = useState(
    stored ? (stored.getMonth() + 1).toString().padStart(2, '0') : '',
  );
  const [day, setDay] = useState(stored ? stored.getDate().toString().padStart(2, '0') : '');

  const parsedDate = useMemo(() => {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (!y || !m || !d) return null;
    if (y < 1900 || y > new Date().getFullYear() - 13) return null;
    if (m < 1 || m > 12) return null;
    if (d < 1 || d > 31) return null;
    const date = new Date(y, m - 1, d);
    if (date.getMonth() !== m - 1) return null;
    return date;
  }, [year, month, day]);

  const age = useMemo(() => {
    if (!parsedDate) return null;
    return Math.floor((Date.now() - parsedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }, [parsedDate]);

  const handleContinue = () => {
    if (parsedDate) {
      setBirthDate(parsedDate);
      navigation.navigate('HeightSelect');
    }
  };

  return (
    <OnboardingLayout
      step={6}
      totalSteps={TOTAL_STEPS}
      title={t('onboarding.birthDateTitle')}
      subtitle={t('onboarding.birthDateSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!parsedDate}
    >
      <View className="flex-1 justify-center items-center">
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-8"
          style={{ backgroundColor: `${c.primary}1a` }}
        >
          <Ionicons name="calendar-outline" size={40} color={c.primary} />
        </View>

        <View className="flex-row items-center gap-3 mb-6">
          <View className="items-center">
            <Text className="text-xs font-sans-medium text-text-secondary mb-1">
              {t('onboarding.birthDateYear')}
            </Text>
            <TextInput
              value={year}
              onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="1990"
              placeholderTextColor={c.textTertiary}
              className="text-2xl font-sans-bold text-text text-center bg-surface-card border border-surface-border rounded-xl px-4 py-3 min-w-[100px]"
              maxLength={4}
              autoFocus
              accessibilityLabel={t('onboarding.birthDateYear')}
            />
          </View>

          <Text className="text-2xl font-sans-bold text-text-tertiary mt-4">/</Text>

          <View className="items-center">
            <Text className="text-xs font-sans-medium text-text-secondary mb-1">
              {t('onboarding.birthDateMonth')}
            </Text>
            <TextInput
              value={month}
              onChangeText={(v) => setMonth(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="06"
              placeholderTextColor={c.textTertiary}
              className="text-2xl font-sans-bold text-text text-center bg-surface-card border border-surface-border rounded-xl px-4 py-3 min-w-[70px]"
              maxLength={2}
              accessibilityLabel={t('onboarding.birthDateMonth')}
            />
          </View>

          <Text className="text-2xl font-sans-bold text-text-tertiary mt-4">/</Text>

          <View className="items-center">
            <Text className="text-xs font-sans-medium text-text-secondary mb-1">
              {t('onboarding.birthDateDay')}
            </Text>
            <TextInput
              value={day}
              onChangeText={(v) => setDay(v.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="15"
              placeholderTextColor={c.textTertiary}
              className="text-2xl font-sans-bold text-text text-center bg-surface-card border border-surface-border rounded-xl px-4 py-3 min-w-[70px]"
              maxLength={2}
              accessibilityLabel={t('onboarding.birthDateDay')}
            />
          </View>
        </View>

        {age !== null && age > 0 && (
          <View className="px-4 py-2 rounded-full" style={{ backgroundColor: `${c.primary}1a` }}>
            <Text className="text-sm font-sans-medium" style={{ color: c.primary }}>
              {t('onboarding.birthDateAge').replace('{{age}}', age.toString())}
            </Text>
          </View>
        )}
      </View>
    </OnboardingLayout>
  );
}
