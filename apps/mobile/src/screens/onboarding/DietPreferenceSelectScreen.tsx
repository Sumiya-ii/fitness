import { View, Text, Pressable, ScrollView } from 'react-native';
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
};

const OPTIONS: DietOption[] = [
  {
    id: 'standard',
    icon: 'restaurant-outline',
    title: 'Standard',
    description: 'Balanced macro split for most people',
    macroSplit: '25% P · 55% C · 20% F',
  },
  {
    id: 'high_protein',
    icon: 'barbell-outline',
    title: 'High Protein',
    description: 'More protein to preserve and build muscle',
    macroSplit: '35% P · 40% C · 25% F',
  },
  {
    id: 'low_carb',
    icon: 'leaf-outline',
    title: 'Low Carb',
    description: 'Reduced carbs with higher fat intake',
    macroSplit: '30% P · 30% C · 40% F',
  },
  {
    id: 'low_fat',
    icon: 'heart-outline',
    title: 'Low Fat',
    description: 'Reduced fat for heart-healthy eating',
    macroSplit: '30% P · 55% C · 15% F',
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View style={{ gap: 10 }}>
          {OPTIONS.map((opt) => {
            const selected = dietPreference === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => setDietPreference(opt.id)}
                style={({ pressed }) => ({
                  backgroundColor: selected ? '#0f172a' : '#f5f5f7',
                  borderRadius: 16,
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: selected ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.08)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name={opt.icon} size={22} color={selected ? '#ffffff' : '#0b1220'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: selected ? '#ffffff' : '#0b1220',
                      marginBottom: 2,
                    }}
                  >
                    {opt.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: selected ? 'rgba(255,255,255,0.6)' : '#7687a2',
                      marginBottom: 2,
                    }}
                  >
                    {opt.description}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: selected ? 'rgba(255,255,255,0.5)' : '#0b1220',
                      opacity: 0.7,
                    }}
                  >
                    {opt.macroSplit}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </OnboardingLayout>
  );
}
