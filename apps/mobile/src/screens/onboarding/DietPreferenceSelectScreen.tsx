import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import type { DietPreference } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';
import { OptionRow } from './components/OptionRow';

type DietOption = {
  id: DietPreference;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descKey: string;
  macroSplit: string;
};

const OPTIONS: DietOption[] = [
  {
    id: 'standard',
    icon: 'restaurant-outline',
    titleKey: 'onboarding.dietStandard',
    descKey: 'onboarding.dietStandardDesc',
    macroSplit: '25% P \u00b7 55% C \u00b7 20% F',
  },
  {
    id: 'high_protein',
    icon: 'barbell-outline',
    titleKey: 'onboarding.dietHighProtein',
    descKey: 'onboarding.dietHighProteinDesc',
    macroSplit: '35% P \u00b7 40% C \u00b7 25% F',
  },
  {
    id: 'low_carb',
    icon: 'leaf-outline',
    titleKey: 'onboarding.dietLowCarb',
    descKey: 'onboarding.dietLowCarbDesc',
    macroSplit: '30% P \u00b7 30% C \u00b7 40% F',
  },
  {
    id: 'low_fat',
    icon: 'heart-outline',
    titleKey: 'onboarding.dietLowFat',
    descKey: 'onboarding.dietLowFatDesc',
    macroSplit: '30% P \u00b7 55% C \u00b7 15% F',
  },
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'DietPreferenceSelect'>;

export function DietPreferenceSelectScreen({ navigation }: Props) {
  const dietPreference = useProfileStore((s) => s.dietPreference);
  const setDietPreference = useProfileStore((s) => s.setDietPreference);
  const c = useColors();
  const { t } = useLocale();

  const handleSelect = (id: DietPreference) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDietPreference(id);
  };

  return (
    <OnboardingLayout
      route="DietPreferenceSelect"
      title={t('onboarding.dietTitle')}
      subtitle={t('onboarding.dietSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('Motivation')}
      continueDisabled={!dietPreference}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View className="gap-2.5">
          {OPTIONS.map((opt, i) => {
            const selected = dietPreference === opt.id;
            return (
              <OptionRow key={opt.id} index={i}>
                <Pressable
                  onPress={() => handleSelect(opt.id)}
                  className={`rounded-2xl py-4 px-4 flex-row items-center gap-3 active:opacity-85 ${
                    selected ? 'bg-primary-500' : 'bg-surface-card'
                  }`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${t(opt.titleKey)} ${t(opt.descKey)}`}
                >
                  <View
                    className="w-11 h-11 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: selected ? `${c.onPrimary}26` : `${c.text}14`,
                    }}
                  >
                    <Ionicons name={opt.icon} size={22} color={selected ? c.onPrimary : c.text} />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-[15px] font-sans-bold mb-0.5 ${
                        selected ? 'text-on-primary' : 'text-text'
                      }`}
                    >
                      {t(opt.titleKey)}
                    </Text>
                    <Text
                      className="text-xs mb-0.5"
                      style={{
                        color: selected ? `${c.onPrimary}99` : c.textTertiary,
                      }}
                    >
                      {t(opt.descKey)}
                    </Text>
                    <Text
                      className="text-[11px] font-sans-semibold"
                      style={{
                        color: selected ? `${c.onPrimary}b3` : c.textSecondary,
                      }}
                    >
                      {opt.macroSplit}
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
