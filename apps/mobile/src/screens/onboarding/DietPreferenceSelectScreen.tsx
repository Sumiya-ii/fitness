import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SetupStackParamList } from '../../navigation/types';
import type { DietPreference } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 10;

type DietOption = {
  id: DietPreference;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  macroSplit: string;
  gradient: [string, string];
};

const OPTIONS: DietOption[] = [
  {
    id: 'standard',
    icon: 'restaurant-outline',
    title: 'Standard',
    description: 'Balanced macro split for most people',
    macroSplit: '25% P · 55% C · 20% F',
    gradient: ['#22c55e', '#16a34a'],
  },
  {
    id: 'high_protein',
    icon: 'barbell-outline',
    title: 'High Protein',
    description: 'More protein to preserve and build muscle',
    macroSplit: '35% P · 40% C · 25% F',
    gradient: ['#3b82f6', '#2563eb'],
  },
  {
    id: 'low_carb',
    icon: 'leaf-outline',
    title: 'Low Carb',
    description: 'Reduced carbs with higher fat intake',
    macroSplit: '30% P · 30% C · 40% F',
    gradient: ['#a855f7', '#7e22ce'],
  },
  {
    id: 'low_fat',
    icon: 'heart-outline',
    title: 'Low Fat',
    description: 'Reduced fat for heart-healthy eating',
    macroSplit: '30% P · 55% C · 15% F',
    gradient: ['#f59e0b', '#d97706'],
  },
];

type Props = NativeStackScreenProps<SetupStackParamList, 'DietPreferenceSelect'>;

export function DietPreferenceSelectScreen({ navigation }: Props) {
  const dietPreference = useProfileStore((s) => s.dietPreference);
  const setDietPreference = useProfileStore((s) => s.setDietPreference);

  return (
    <OnboardingLayout
      step={9}
      totalSteps={TOTAL_STEPS}
      title="Choose your eating style"
      subtitle="This adjusts how we split your calories into macros"
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('Motivation')}
      continueDisabled={!dietPreference}
    >
      <View className="gap-4">
        {OPTIONS.map((opt) => {
          const selected = dietPreference === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setDietPreference(opt.id)}
              className={`flex-row items-center p-4 rounded-2xl border-2 bg-slate-900/80 ${
                selected
                  ? 'border-primary-500'
                  : 'border-slate-800'
              }`}
            >
              <LinearGradient
                colors={opt.gradient}
                className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                style={{ borderRadius: 12 }}
              >
                <Ionicons name={opt.icon} size={24} color="white" />
              </LinearGradient>
              <View className="flex-1">
                <Text className="text-base font-sans-semibold text-white">
                  {opt.title}
                </Text>
                <Text className="text-xs text-slate-400 mt-0.5">
                  {opt.description}
                </Text>
                <Text className="text-xs font-sans-medium text-primary-600 mt-1">
                  {opt.macroSplit}
                </Text>
              </View>
              {selected && (
                <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
              )}
            </Pressable>
          );
        })}
      </View>
    </OnboardingLayout>
  );
}
