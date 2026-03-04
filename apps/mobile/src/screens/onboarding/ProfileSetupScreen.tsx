import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { Gender, ActivityLevel } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';

const ACTIVITY_LEVELS: { id: ActivityLevel; label: string }[] = [
  { id: 'sedentary', label: 'Sedentary' },
  { id: 'light', label: 'Light' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'active', label: 'Active' },
  { id: 'very_active', label: 'Very Active' },
];

type Props = NativeStackScreenProps<any, 'ProfileSetup'>;

export function ProfileSetupScreen({ navigation }: Props) {
  const profile = useProfileStore((s) => s);
  const setProfile = useProfileStore((s) => s.setProfile);

  const [gender, setGender] = useState<Gender | null>(profile.gender ?? null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toString() ?? '');
  const [weightKg, setWeightKg] = useState(profile.weightKg?.toString() ?? '');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    profile.activityLevel ?? null
  );

  const parseDate = (str: string): Date | null => {
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, y, m, d] = match;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    return isNaN(date.getTime()) ? null : date;
  };

  const handleCalculate = () => {
    const dob = parseDate(dateOfBirth);
    const h = parseInt(heightCm, 10);
    const w = parseFloat(weightKg);

    if (!gender || !dob || !h || !w || !activityLevel) return;

    setProfile({
      gender,
      dateOfBirth: dob,
      heightCm: h,
      weightKg: w,
      activityLevel,
    });
    navigation.navigate('TargetReview');
  };

  const isValid =
    gender &&
    dateOfBirth &&
    parseDate(dateOfBirth) &&
    heightCm &&
    parseInt(heightCm, 10) > 0 &&
    weightKg &&
    parseFloat(weightKg) > 0 &&
    activityLevel;

  return (
    <SafeAreaView className="flex-1 bg-surface dark:bg-slate-900" edges={['top']}>
      <View className="relative">
        <LinearGradient
        colors={['#0ea5e9', '#0284c7']}
        className="pt-8 pb-12 px-6"
        style={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
      >
        <Text className="text-2xl font-sans-bold text-white mb-1">Your Profile</Text>
        <Text className="text-base text-white/90">
          We need a few details to calculate your targets
        </Text>
      </LinearGradient>
        <Pressable
          onPress={() => navigation.goBack()}
          className="absolute top-4 left-6 p-2 -m-2"
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        <Text className="text-sm font-sans-medium text-text mb-2 dark:text-slate-200">
          Gender
        </Text>
        <View className="flex-row gap-3 mb-6">
          <Pressable
            onPress={() => setGender('male')}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border-2 ${
              gender === 'male' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white'
            } dark:bg-slate-800 dark:border-slate-600`}
          >
            <Ionicons
              name="male"
              size={20}
              color={gender === 'male' ? '#22c55e' : '#64748b'}
            />
            <Text
              className={`ml-2 font-sans-medium ${
                gender === 'male' ? 'text-primary-600' : 'text-text-secondary'
              } dark:text-slate-400`}
            >
              Male
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setGender('female')}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border-2 ${
              gender === 'female' ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white'
            } dark:bg-slate-800 dark:border-slate-600`}
          >
            <Ionicons
              name="female"
              size={20}
              color={gender === 'female' ? '#22c55e' : '#64748b'}
            />
            <Text
              className={`ml-2 font-sans-medium ${
                gender === 'female' ? 'text-primary-600' : 'text-text-secondary'
              } dark:text-slate-400`}
            >
              Female
            </Text>
          </Pressable>
        </View>

        <Input
          label="Date of Birth"
          placeholder="YYYY-MM-DD"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          keyboardType="numbers-and-punctuation"
          containerClassName="mb-4"
        />

        <View className="flex-row gap-4 mb-4">
          <View className="flex-1">
            <Input
              label="Height (cm)"
              placeholder="170"
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <Input
              label="Weight (kg)"
              placeholder="70"
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <Text className="text-sm font-sans-medium text-text mb-2 dark:text-slate-200">
          Activity Level
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-6 -mx-6 px-6"
        >
          {ACTIVITY_LEVELS.map((level) => {
            const isSelected = activityLevel === level.id;
            return (
              <Pressable
                key={level.id}
                onPress={() => setActivityLevel(level.id)}
                className={`mr-3 px-4 py-2.5 rounded-full ${
                  isSelected ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <Text
                  className={`text-sm font-sans-medium ${
                    isSelected ? 'text-white' : 'text-text dark:text-slate-300'
                  }`}
                >
                  {level.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </ScrollView>

      <View className="px-6 pb-8 pt-4">
        <Button
          onPress={handleCalculate}
          size="lg"
          disabled={!isValid}
          className="w-full"
        >
          Calculate My Targets
        </Button>
      </View>
    </SafeAreaView>
  );
}
