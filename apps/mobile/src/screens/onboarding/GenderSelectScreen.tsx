import { View, Text, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import type { Gender } from '../../stores/profile.store';
import { useProfileStore } from '../../stores/profile.store';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 11;

type GenderOption = {
  id: Gender;
  labelKey: string;
};

const OPTIONS: GenderOption[] = [
  { id: 'male', labelKey: 'onboarding.genderMale' },
  { id: 'female', labelKey: 'onboarding.genderFemale' },
  { id: 'other', labelKey: 'onboarding.genderOther' },
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'GenderSelect'>;

export function GenderSelectScreen({ navigation }: Props) {
  const gender = useProfileStore((s) => s.gender);
  const setGender = useProfileStore((s) => s.setGender);
  const { t } = useLocale();

  const handleSelect = (id: Gender) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGender(id);
  };

  return (
    <OnboardingLayout
      step={3}
      totalSteps={TOTAL_STEPS}
      title={t('onboarding.genderTitle')}
      subtitle={t('onboarding.genderSubtitle')}
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('BirthDateSelect')}
      continueDisabled={!gender}
    >
      <View className="flex-1 justify-center">
        <View className="gap-3">
          {OPTIONS.map((opt) => {
            const selected = gender === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => handleSelect(opt.id)}
                className={`rounded-2xl items-center justify-center py-[26px] active:opacity-85 ${
                  selected ? 'bg-primary-500' : 'bg-surface-card'
                }`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(opt.labelKey)}
              >
                <Text
                  className={`text-[17px] tracking-wide ${
                    selected ? 'font-sans-bold text-on-primary' : 'font-sans-medium text-text'
                  }`}
                >
                  {t(opt.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </OnboardingLayout>
  );
}
