import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import type { GoalType } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';
import { OptionRow } from './components/OptionRow';

type GoalOption = {
  id: GoalType;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
};

const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'lose_fat',
    icon: 'flame-outline',
    titleKey: 'onboarding.goalLoseFat',
  },
  {
    id: 'maintain',
    icon: 'scale-outline',
    titleKey: 'onboarding.goalMaintain',
  },
  {
    id: 'gain',
    icon: 'barbell-outline',
    titleKey: 'onboarding.goalGain',
  },
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'GoalSetup'>;

export function GoalSetupScreen({ navigation }: Props) {
  const goalType = useProfileStore((s) => s.goalType);
  const setGoalType = useProfileStore((s) => s.setGoalType);
  const c = useColors();
  const { t } = useLocale();

  const handleSelect = (id: GoalType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGoalType(id);
  };

  return (
    <OnboardingLayout
      route="GoalSetup"
      title={t('onboarding.goalTitle')}
      subtitle={t('onboarding.goalSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('GenderSelect')}
      continueDisabled={!goalType}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View className="gap-3">
          {GOAL_OPTIONS.map((option, i) => {
            const selected = goalType === option.id;
            return (
              <OptionRow key={option.id} index={i}>
                <Pressable
                  onPress={() => handleSelect(option.id)}
                  className={`rounded-2xl py-5 px-5 flex-row items-center gap-3.5 active:opacity-85 ${
                    selected ? 'bg-primary-500' : 'bg-surface-card'
                  }`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(option.titleKey)}
                >
                  <View
                    className="w-11 h-11 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: selected ? `${c.onPrimary}26` : `${c.text}14`,
                    }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={22}
                      color={selected ? c.onPrimary : c.text}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-base font-sans-bold ${
                        selected ? 'text-on-primary' : 'text-text'
                      }`}
                    >
                      {t(option.titleKey)}
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
