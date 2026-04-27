import { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';
import { ScrollPicker } from '../../components/ui';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'BirthDateSelect'>;

// ── static data ───────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1940;
const MAX_YEAR = CURRENT_YEAR - 13; // user must be at least 13

const YEAR_ITEMS = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => {
  const y = MIN_YEAR + i;
  return { label: y.toString(), value: y };
});

const MONTH_ITEMS = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1;
  return { label: m.toString().padStart(2, '0'), value: m };
});

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ─────────────────────────────────────────────────────────────────────────────

export function BirthDateSelectScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.birthDate);
  const setBirthDate = useProfileStore((s) => s.setBirthDate);
  const c = useColors();
  const { t } = useLocale();

  // Initialise from stored profile date, or sensible defaults.
  const [selectedYear, setSelectedYear] = useState<number>(stored ? stored.getFullYear() : 1995);
  const [selectedMonth, setSelectedMonth] = useState<number>(stored ? stored.getMonth() + 1 : 6);
  const [selectedDay, setSelectedDay] = useState<number>(stored ? stored.getDate() : 15);

  // Day list is dynamic: depends on selected year + month.
  const dayItems = useMemo(() => {
    const count = daysInMonth(selectedYear, selectedMonth);
    return Array.from({ length: count }, (_, i) => {
      const d = i + 1;
      return { label: d.toString().padStart(2, '0'), value: d };
    });
  }, [selectedYear, selectedMonth]);

  // Clamp day so it stays valid when month/year changes.
  const clampedDay = Math.min(selectedDay, dayItems.length);

  const parsedDate = useMemo(() => {
    const date = new Date(selectedYear, selectedMonth - 1, clampedDay);
    if (date.getMonth() !== selectedMonth - 1) return null; // overflow guard
    return date;
  }, [selectedYear, selectedMonth, clampedDay]);

  const age = useMemo(() => {
    if (!parsedDate) return null;
    return Math.floor((Date.now() - parsedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }, [parsedDate]);

  const isValid = parsedDate !== null && age !== null && age >= 13;

  const handleContinue = () => {
    if (isValid && parsedDate) {
      setBirthDate(parsedDate);
      navigation.navigate('HeightSelect');
    }
  };

  return (
    <OnboardingLayout
      route="BirthDateSelect"
      title={t('onboarding.birthDateTitle')}
      subtitle={t('onboarding.birthDateSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!isValid}
    >
      <View className="flex-1 justify-center items-center">
        {/* Column labels */}
        <View className="flex-row mb-1" style={{ width: 300 }}>
          <View style={{ width: 120 }} className="items-center">
            <Text className="text-xs font-sans-medium text-text-secondary">
              {t('onboarding.birthDateYear')}
            </Text>
          </View>
          <View style={{ width: 90 }} className="items-center">
            <Text className="text-xs font-sans-medium text-text-secondary">
              {t('onboarding.birthDateMonth')}
            </Text>
          </View>
          <View style={{ width: 90 }} className="items-center">
            <Text className="text-xs font-sans-medium text-text-secondary">
              {t('onboarding.birthDateDay')}
            </Text>
          </View>
        </View>

        {/* Three pickers side-by-side */}
        <View
          className="flex-row overflow-hidden rounded-2xl border border-surface-border bg-surface-card"
          style={{ width: 300 }}
        >
          <ScrollPicker
            items={YEAR_ITEMS}
            selectedValue={selectedYear}
            onValueChange={(v) => setSelectedYear(v as number)}
            itemHeight={48}
            visibleItems={5}
            width={120}
            accessibilityLabel={t('onboarding.birthDateYear')}
          />

          <View className="w-px bg-surface-border" />

          <ScrollPicker
            items={MONTH_ITEMS}
            selectedValue={selectedMonth}
            onValueChange={(v) => setSelectedMonth(v as number)}
            itemHeight={48}
            visibleItems={5}
            width={90}
            accessibilityLabel={t('onboarding.birthDateMonth')}
          />

          <View className="w-px bg-surface-border" />

          <ScrollPicker
            items={dayItems}
            selectedValue={clampedDay}
            onValueChange={(v) => setSelectedDay(v as number)}
            itemHeight={48}
            visibleItems={5}
            width={90}
            accessibilityLabel={t('onboarding.birthDateDay')}
          />
        </View>

        {/* Age badge */}
        {age !== null && age >= 13 && (
          <View
            className="mt-6 px-4 py-2 rounded-full"
            style={{ backgroundColor: `${c.primary}1a` }}
          >
            <Text className="text-sm font-sans-medium" style={{ color: c.primary }}>
              {t('onboarding.birthDateAge').replace('{{age}}', age.toString())}
            </Text>
          </View>
        )}
      </View>
    </OnboardingLayout>
  );
}
