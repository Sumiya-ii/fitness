import { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackButton } from '../components/ui';
import { useThemeStore, type ThemeMode } from '../stores/theme.store';
import { api } from '../api';
import { useLocale, type Locale } from '../i18n';
import { useColors } from '../theme';

interface ProfileData {
  locale: string;
}

function Pill({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const c = useColors();
  return (
    <View className="flex-row rounded-xl p-1 bg-surface-secondary">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(opt.value);
            }}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
            className="px-4 py-2 rounded-[10px] min-h-[36px] items-center justify-center"
            style={active ? { backgroundColor: c.card } : undefined}
          >
            <Text
              className="text-sm leading-5 font-sans-semibold"
              style={{ color: active ? c.text : c.textTertiary }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SettingRow({
  icon,
  label,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <View className="flex-row items-center py-3.5 min-h-[52px]">
      <View
        className="h-9 w-9 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: c.cardAlt }}
      >
        <Ionicons name={icon} size={18} color={c.textTertiary} />
      </View>
      <Text className="flex-1 text-base leading-6 font-sans-medium text-text">{label}</Text>
      {children}
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-surface-secondary" />;
}

export function AppSettingsScreen() {
  const { locale: currentLocale, setLocale, t } = useLocale();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

  useFocusEffect(
    useCallback(() => {
      api
        .get<{ data: ProfileData }>('/profile')
        .then((res) => setProfile(res.data))
        .catch(() => {});
    }, []),
  );

  const handleLanguageSelect = async (locale: string) => {
    await setLocale(locale as Locale);
    try {
      await api.put('/profile', { locale });
      setProfile((p) => (p ? { ...p, locale } : p));
    } catch {
      /* keep local */
    }
  };

  const currentLang = profile?.locale ?? currentLocale;

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-5 py-3">
          <BackButton />
          <Text className="flex-1 text-lg leading-7 font-sans-bold text-text text-center mr-11">
            {t('settings.preferences')}
          </Text>
        </View>

        <View className="px-5 pt-6">
          <Animated.View entering={FadeInDown.duration(400).springify()}>
            <View className="bg-surface-card rounded-2xl px-4 border border-surface-border">
              {/* Language */}
              <SettingRow icon="language-outline" label={t('settings.language')}>
                <Pill
                  options={[
                    { label: 'EN', value: 'en' },
                    { label: 'MN', value: 'mn' },
                  ]}
                  value={currentLang}
                  onChange={handleLanguageSelect}
                />
              </SettingRow>

              <Divider />

              {/* Appearance */}
              <SettingRow icon="moon-outline" label={t('settings.appearance')}>
                <Pill
                  options={[
                    { label: t('onboarding.themeLight'), value: 'light' },
                    { label: t('onboarding.themeDark'), value: 'dark' },
                    { label: t('onboarding.themeSystem').split(' ')[0], value: 'system' },
                  ]}
                  value={themeMode}
                  onChange={(v) => setThemeMode(v as ThemeMode)}
                />
              </SettingRow>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
