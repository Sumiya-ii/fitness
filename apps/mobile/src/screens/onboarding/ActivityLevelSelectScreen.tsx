import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import type { ActivityLevel } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';
import { OptionRow } from './components/OptionRow';

type ActivityOption = {
  id: ActivityLevel;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descKey: string;
};

const OPTIONS: ActivityOption[] = [
  {
    id: 'sedentary',
    icon: 'desktop-outline',
    titleKey: 'onboarding.activitySedentary',
    descKey: 'onboarding.activitySedentaryDesc',
  },
  {
    id: 'lightly_active',
    icon: 'walk-outline',
    titleKey: 'onboarding.activityLightly',
    descKey: 'onboarding.activityLightlyDesc',
  },
  {
    id: 'moderately_active',
    icon: 'bicycle-outline',
    titleKey: 'onboarding.activityModerately',
    descKey: 'onboarding.activityModeratelyDesc',
  },
  {
    id: 'very_active',
    icon: 'fitness-outline',
    titleKey: 'onboarding.activityVery',
    descKey: 'onboarding.activityVeryDesc',
  },
  {
    id: 'extra_active',
    icon: 'flame-outline',
    titleKey: 'onboarding.activityExtra',
    descKey: 'onboarding.activityExtraDesc',
  },
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ActivityLevelSelect'>;

export function ActivityLevelSelectScreen({ navigation }: Props) {
  const activityLevel = useProfileStore((s) => s.activityLevel);
  const setActivityLevel = useProfileStore((s) => s.setActivityLevel);
  const c = useColors();
  const { t } = useLocale();

  const handleSelect = (id: ActivityLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActivityLevel(id);
  };

  return (
    <OnboardingLayout
      route="ActivityLevelSelect"
      title={t('onboarding.activityTitle')}
      subtitle={t('onboarding.activitySubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('DietPreferenceSelect')}
      continueDisabled={!activityLevel}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <View className="gap-2.5">
          {OPTIONS.map((opt, i) => {
            const selected = activityLevel === opt.id;
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
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: selected ? `${c.onPrimary}26` : `${c.text}14`,
                    }}
                  >
                    <Ionicons name={opt.icon} size={20} color={selected ? c.onPrimary : c.text} />
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
                      className="text-xs"
                      style={{
                        color: selected ? `${c.onPrimary}99` : c.textTertiary,
                      }}
                    >
                      {t(opt.descKey)}
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
