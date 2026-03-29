import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../../navigation/types';
import { useThemeStore, type ThemeMode } from '../../stores/theme.store';
import { useColors } from '../../theme';
import { useLocale } from '../../i18n';
import { OnboardingLayout } from './OnboardingLayout';

const TOTAL_STEPS = 11;

type ThemeOption = {
  id: ThemeMode;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  descKey: string;
};

const OPTIONS: ThemeOption[] = [
  {
    id: 'system',
    icon: 'phone-portrait-outline',
    titleKey: 'onboarding.themeSystem',
    descKey: 'onboarding.themeSystemDesc',
  },
  {
    id: 'light',
    icon: 'sunny-outline',
    titleKey: 'onboarding.themeLight',
    descKey: 'onboarding.themeLightDesc',
  },
  {
    id: 'dark',
    icon: 'moon-outline',
    titleKey: 'onboarding.themeDark',
    descKey: 'onboarding.themeDarkDesc',
  },
];

type Props = NativeStackScreenProps<OnboardingStackParamList, 'ThemeSelect'>;

export function ThemeSelectScreen({ navigation }: Props) {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const c = useColors();
  const { t } = useLocale();

  const handleSelect = (id: ThemeMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(id);
  };

  return (
    <OnboardingLayout
      step={1}
      totalSteps={TOTAL_STEPS}
      title={t('onboarding.themeTitle')}
      subtitle={t('onboarding.themeSubtitle')}
      onContinue={() => navigation.navigate('GoalSetup')}
    >
      <View className="flex-1 justify-center">
        <View className="gap-3">
          {OPTIONS.map((opt) => {
            const selected = mode === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => handleSelect(opt.id)}
                className={`rounded-2xl py-[22px] px-5 flex-row items-center gap-3.5 active:opacity-85 ${
                  selected ? 'bg-primary-500' : 'bg-surface-card'
                }`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(opt.titleKey)}
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
                    className={`text-base mb-0.5 ${
                      selected ? 'font-sans-bold text-on-primary' : 'font-sans-medium text-text'
                    }`}
                  >
                    {t(opt.titleKey)}
                  </Text>
                  <Text
                    className="text-[13px] leading-[18px]"
                    style={{
                      color: selected ? `${c.onPrimary}a6` : c.textTertiary,
                    }}
                  >
                    {t(opt.descKey)}
                  </Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={24} color={c.onPrimary} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    </OnboardingLayout>
  );
}
