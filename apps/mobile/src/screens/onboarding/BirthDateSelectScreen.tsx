import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type Props = NativeStackScreenProps<SetupStackParamList, 'BirthDateSelect'>;

export function BirthDateSelectScreen({ navigation }: Props) {
  const stored = useProfileStore((s) => s.birthDate);
  const setBirthDate = useProfileStore((s) => s.setBirthDate);

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
      step={5}
      totalSteps={TOTAL_STEPS}
      title="When were you born?"
      subtitle="Your age affects your basal metabolic rate"
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueDisabled={!parsedDate}
    >
      <View className="flex-1 justify-center items-center">
        <View className="w-20 h-20 rounded-full bg-purple-500/15 items-center justify-center mb-8">
          <Ionicons name="calendar-outline" size={40} color="#8f93a4" />
        </View>

        <View className="flex-row items-center gap-3 mb-6">
          <View className="items-center">
            <Text className="text-xs font-sans-medium text-text-secondary mb-1">YEAR</Text>
            <TextInput
              value={year}
              onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="1990"
              placeholderTextColor="#9a9caa"
              className="text-2xl font-sans-bold text-text text-center bg-surface-card border border-surface-border rounded-xl px-4 py-3 min-w-[100px]"
              maxLength={4}
              autoFocus
            />
          </View>

          <Text className="text-2xl font-sans-bold text-text-tertiary mt-4">/</Text>

          <View className="items-center">
            <Text className="text-xs font-sans-medium text-text-secondary mb-1">MONTH</Text>
            <TextInput
              value={month}
              onChangeText={(t) => setMonth(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="06"
              placeholderTextColor="#9a9caa"
              className="text-2xl font-sans-bold text-text text-center bg-surface-card border border-surface-border rounded-xl px-4 py-3 min-w-[70px]"
              maxLength={2}
            />
          </View>

          <Text className="text-2xl font-sans-bold text-text-tertiary mt-4">/</Text>

          <View className="items-center">
            <Text className="text-xs font-sans-medium text-text-secondary mb-1">DAY</Text>
            <TextInput
              value={day}
              onChangeText={(t) => setDay(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="15"
              placeholderTextColor="#9a9caa"
              className="text-2xl font-sans-bold text-text text-center bg-surface-card border border-surface-border rounded-xl px-4 py-3 min-w-[70px]"
              maxLength={2}
            />
          </View>
        </View>

        {age !== null && age > 0 && (
          <Pressable disabled className="px-4 py-2 bg-primary-500/15 rounded-full">
            <Text className="text-sm font-sans-medium text-primary-600">{age} years old</Text>
          </Pressable>
        )}
      </View>
    </OnboardingLayout>
  );
}
